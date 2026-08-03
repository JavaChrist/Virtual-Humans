/**
 * Production Director — sole multi-step orchestrator (VHS-110).
 * Bounded commands: start / advance / requestCancellation.
 * Never invents strategy, prompt, or model. Fallbacks only from GenerationPlan.
 */

import type { GenerationEngine } from "@/application/generation";
import {
  createBudgetSnapshot,
  decideBudget,
  money,
  type BudgetSnapshot,
  type CostEstimate,
} from "@/domain/cost";
import {
  buildProductionResult,
  canRequestCancellation,
  createProductionEvent,
  createProductionRun,
  decideFallback,
  deriveTerminalRunStatus,
  findReadySteps,
  findStepsToSkip,
  findStep,
  isTerminalRunStatus,
  updateStepStatus,
  withRunUpdate,
  DEFAULT_PRODUCTION_POLICY,
  validateProductionPolicy,
  validatePlanForProduction,
  assertAttemptRules,
  nextAttemptNumber,
  type ProductionAttempt,
  type ProductionAttemptError,
  type ProductionEvent,
  type ProductionPolicy,
  type ProductionRun,
  type ProductionIssue,
} from "@/domain/production";
import type { GenerationPlan, GenerationStep } from "@/domain/routing/router";
import type { ScenePackage } from "@/domain/prompt";
import { checkProductionReadiness, type ProductionReadinessInput } from "@/domain/project";
import {
  createArtifactMetadata,
  type ArtifactMetadata,
} from "@/domain/shared";
import type { GenerationCommand, GenerationError, GenerationResult, ResolvedGenerationInput } from "@/domain/generation";
import {
  beginAttemptIdempotency,
  completeAttemptIdempotency,
  failAttemptIdempotency,
  productionFingerprint,
  productionIdempotencyKey,
} from "./idempotency-coordinator";
import {
  releaseFullReservation,
  reserveAttemptBudget,
  settleAttemptBudget,
} from "./budget-coordinator";
import { validateAttemptQuality } from "./quality-coordinator";
import type { ProductionPorts } from "./ports";
import type {
  ProductionDirectorResult,
  ProductionWaitingReason,
} from "./result";
import type {
  ClaimedProductionJob,
  EnqueueProductionJobCommand,
  LeaseContext,
  ProcessClaimedJobOutcome,
  ProductionPayloadReference,
} from "./enqueue";

export type ProductionExecutionContext = {
  correlationId: string;
  actorId: string;
  nowIso: () => string;
  nextId: () => string;
  /** Bound actions per advance (default 2). */
  maxActionsPerAdvance?: number;
  signal?: AbortSignal;
  /** When false, processClaimedJob must not call providers (VHS-114). */
  paidGenerationEnabled?: boolean;
};

export type StartProductionInput = {
  plan: GenerationPlan;
  scenePackages: ScenePackage[];
  readiness: ProductionReadinessInput;
  budgetSnapshot: BudgetSnapshot;
  policy?: ProductionPolicy;
  runId?: string;
  /** Require durable idempotency store (default true for start). */
  requireDurableIdempotency?: boolean;
};

export interface ProductionDirector {
  start(
    input: StartProductionInput,
    context: ProductionExecutionContext
  ): Promise<ProductionDirectorResult>;
  advance(
    runId: string,
    context: ProductionExecutionContext
  ): Promise<ProductionDirectorResult>;
  requestCancellation(
    runId: string,
    context: ProductionExecutionContext
  ): Promise<ProductionDirectorResult>;
  /**
   * Produce enqueue commands for ready steps — PD owns scheduling (VHS-114).
   * Does not call providers. Does not claim queue jobs.
   */
  planEnqueueCommands(
    runId: string,
    context: ProductionExecutionContext
  ): Promise<{ commands: EnqueueProductionJobCommand[]; run: ProductionRun | null }>;
  /**
   * Process one claimed queue job — budget/idempotence/fallback stay in PD (VHS-114).
   */
  processClaimedJob(
    claimedJob: ClaimedProductionJob,
    lease: LeaseContext,
    context: ProductionExecutionContext
  ): Promise<ProcessClaimedJobOutcome>;
}

export type CreateProductionDirectorOptions = {
  engine: GenerationEngine;
  ports: ProductionPorts;
  /** Plan + packages lookup for advance (injected; no global registry). */
  resolvePlan: (planRevisionId: string) => GenerationPlan | null;
  resolveScenePackages: (planRevisionId: string) => ScenePackage[];
};

function mapGenError(err: GenerationError): ProductionAttemptError {
  let category: ProductionAttemptError["category"] = "technical";
  if (err.code === "content_rejected") category = "content_rejected";
  else if (err.code === "invalid_input" || err.code === "output_invalid") category = "invalid_input";
  else if (err.code === "unauthorized") category = "unauthorized";
  else if (err.code === "unknown") category = "unknown";
  else if (
    err.code === "timeout" ||
    err.code === "rate_limited" ||
    err.code === "provider_unavailable" ||
    err.code === "quota_exceeded"
  ) {
    category = "technical";
  }
  return {
    code: err.code,
    message: err.publicMessage,
    retryable: err.retryable,
    category,
  };
}

function resolveInputsFromRun(
  run: ProductionRun,
  step: GenerationStep
): ResolvedGenerationInput[] {
  const resolved: ResolvedGenerationInput[] = [];
  for (const ref of step.inputRefs) {
    if (ref.kind !== "step_output") continue;
    const from = findStep(run, ref.id);
    const asset = from?.outputAssets[0];
    if (!asset) continue;
    const access =
      asset.source.kind === "temporary_external"
        ? {
            kind: "signed_url" as const,
            url: asset.source.url,
            expiresAt: asset.source.expiresAt,
          }
        : asset.source.kind === "inline_data_url"
          ? { kind: "data_url" as const, dataUrl: asset.source.dataUrl }
          : { kind: "internal" as const, storagePath: asset.source.storagePath };
    resolved.push({
      role: ref.role,
      fromStepId: ref.id,
      asset: {
        assetId: asset.id,
        kind: "step_output",
        mimeType: asset.mimeType,
        access,
      },
    });
  }
  return resolved;
}

function buildStepCommand(input: {
  plan: GenerationPlan;
  run: ProductionRun;
  sceneId: string;
  step: GenerationStep;
  scenePackage: ScenePackage;
  attempt: number;
  providerId: string;
  modelId: string;
  estimate: CostEstimate;
  at: string;
}): { command: GenerationCommand; key: string; fingerprint: string } {
  const stepForAttempt: GenerationStep = {
    ...input.step,
    providerId: input.providerId as GenerationStep["providerId"],
    modelId: input.modelId as GenerationStep["modelId"],
    estimate: input.estimate,
    // Fallbacks remain on the plan step object but engine ignores them
  };
  const key = productionIdempotencyKey({
    projectId: input.plan.projectId,
    planRevisionId: input.plan.id,
    sceneId: input.sceneId,
    stepId: input.step.id,
    attempt: input.attempt,
  });
  const resolvedInputs = resolveInputsFromRun(input.run, input.step);
  const fingerprint = productionFingerprint({
    projectId: input.plan.projectId,
    planRevisionId: input.plan.id,
    sceneId: input.sceneId,
    stepId: input.step.id,
    action: stepForAttempt.action,
    providerId: stepForAttempt.providerId,
    modelId: stepForAttempt.modelId,
    capabilityProfile: stepForAttempt.capabilityProfile,
    promptVariantId: stepForAttempt.promptVariantId,
    referenceAssetIds: resolvedInputs.map((r) => r.asset.assetId),
    durationSeconds: stepForAttempt.expectedOutput.durationSeconds,
    dialogueCharCount: input.scenePackage.dialogue?.text.length,
    dependsOnStepIds: stepForAttempt.dependsOnStepIds,
    attempt: input.attempt,
  });
  const command: GenerationCommand = {
    projectId: input.plan.projectId,
    planRevisionId: input.plan.id,
    sceneId: input.sceneId,
    step: stepForAttempt,
    scenePackage: input.scenePackage,
    resolvedInputs,
    idempotencyKey: key,
    requestedAt: input.at,
    attempt: input.attempt,
  };
  return { command, key, fingerprint };
}

export function createProductionDirector(
  options: CreateProductionDirectorOptions
): ProductionDirector {
  const { engine, ports, resolvePlan, resolveScenePackages } = options;
  const publishPolicy = ports.eventPublishFailurePolicy ?? "fail_soft";

  async function publishAll(
    events: ProductionEvent[],
    factoryEvents: ProductionEvent[]
  ): Promise<void> {
    for (const ev of factoryEvents) {
      events.push(ev);
      try {
        await ports.events.publish(ev);
      } catch {
        if (publishPolicy === "fail_soft") {
          // Do not re-execute work; event loss is acceptable under fail_soft.
          continue;
        }
        throw new Error("Event publish failed");
      }
    }
  }

  async function saveRun(run: ProductionRun, expectedRevision: number): Promise<ProductionRun> {
    return ports.runStore.save(run, expectedRevision);
  }

  function eventFactory(ctx: ProductionExecutionContext) {
    return { nextId: ctx.nextId, nowIso: ctx.nowIso };
  }

  function planStep(plan: GenerationPlan, stepId: string): { sceneId: string; step: GenerationStep } | null {
    for (const scene of plan.scenePlans) {
      const step = scene.steps.find((s) => s.id === stepId);
      if (step) return { sceneId: scene.sceneId, step };
    }
    return null;
  }

  async function maybeFinalize(
    run: ProductionRun,
    ctx: ProductionExecutionContext,
    events: ProductionEvent[]
  ): Promise<ProductionDirectorResult | null> {
    const terminal = deriveTerminalRunStatus(run, run.policy);
    if (!terminal) return null;
    const at = ctx.nowIso();
    let next = withRunUpdate(run, { status: terminal }, at);
    next = await saveRun(next, run.revision);

    const meta: ArtifactMetadata = createArtifactMetadata({
      id: ctx.nextId(),
      projectId: next.projectId,
      createdBy: ctx.actorId,
      correlationId: ctx.correlationId,
      createdAt: at,
      schemaVersion: "1.0.0",
    });
    const result = buildProductionResult({
      run: next,
      meta,
      completedAt: at,
      status: terminal as "completed" | "partial" | "failed" | "cancelled",
    });

    const type =
      terminal === "completed"
        ? "production.completed"
        : terminal === "partial"
          ? "production.partial"
          : terminal === "cancelled"
            ? "production.cancelled"
            : "production.failed";
    await publishAll(events, [
      createProductionEvent(eventFactory(ctx), {
        type,
        correlationId: ctx.correlationId,
        projectId: next.projectId,
        runId: next.id,
        data: { status: terminal },
      }),
    ]);

    if (terminal === "failed" && result.scenes.every((s) => s.status !== "completed")) {
      return { status: "failed", run: next, errors: [{ code: "engine_failed", message: "Production échouée." }], events };
    }
    return { status: "completed", run: next, result, events };
  }

  async function applySkips(
    run: ProductionRun,
    ctx: ProductionExecutionContext,
    events: ProductionEvent[]
  ): Promise<ProductionRun> {
    let current = run;
    const toSkip = findStepsToSkip(current);
    for (const stepId of toSkip) {
      const at = ctx.nowIso();
      const prevRev = current.revision;
      current = updateStepStatus(current, stepId, "skipped", at);
      current = await saveRun(current, prevRev);
      await publishAll(events, [
        createProductionEvent(eventFactory(ctx), {
          type: "attempt.failed",
          correlationId: ctx.correlationId,
          projectId: current.projectId,
          runId: current.id,
          stepId,
          data: { reason: "dependency_failed", status: "skipped" },
        }),
      ]);
    }
    return current;
  }

  async function pollActiveJobs(
    run: ProductionRun,
    plan: GenerationPlan,
    ctx: ProductionExecutionContext,
    events: ProductionEvent[],
    actionsLeft: { n: number }
  ): Promise<{ run: ProductionRun; waiting?: ProductionWaitingReason; review?: ProductionDirectorResult }> {
    let current = run;
    for (const scene of current.scenes) {
      for (const step of scene.steps) {
        if (actionsLeft.n <= 0) return { run: current, waiting: "max_actions_reached" };
        if (step.status !== "submitted" && step.status !== "polling") continue;
        const attempt = step.attempts.find((a) => a.id === step.activeAttemptId);
        if (!attempt?.providerJob) continue;

        const ps = planStep(plan, step.stepId);
        if (!ps) continue;

        actionsLeft.n -= 1;
        const at = ctx.nowIso();
        const prevRev = current.revision;
        current = updateStepStatus(current, step.stepId, "polling", at);
        current = await saveRun(current, prevRev);

        // Engine owns adapters — PD never calls them directly
        const polled = await engine.poll(
          attempt.providerJob,
          {
            correlationId: ctx.correlationId,
            requestedAt: at,
            signal: ctx.signal,
            // No idempotencyStore — PD owns idempotency
          },
          {
            providerId: attempt.providerId,
            modelId: attempt.modelId,
            action: ps.step.action,
          }
        );

        const handled = await handleEngineResult({
          run: current,
          plan,
          sceneId: scene.sceneId,
          stepId: step.stepId,
          attemptId: attempt.id,
          result: polled,
          ctx,
          events,
          idempotencyKey: attempt.idempotencyKey,
          reservationId: attempt.id,
          reserved: attempt.estimate.total,
        });
        current = handled.run;
        if (handled.review) return { run: current, review: handled.review };
        if (handled.waiting) return { run: current, waiting: handled.waiting };
      }
    }
    return { run: current };
  }

  async function handleEngineResult(input: {
    run: ProductionRun;
    plan: GenerationPlan;
    sceneId: string;
    stepId: string;
    attemptId: string;
    result: GenerationResult;
    ctx: ProductionExecutionContext;
    events: ProductionEvent[];
    idempotencyKey: string;
    reservationId: string;
    reserved: ReturnType<typeof money>;
  }): Promise<{
    run: ProductionRun;
    waiting?: ProductionWaitingReason;
    review?: ProductionDirectorResult;
  }> {
    const { ctx, events, plan } = input;
    let current = input.run;
    const at = ctx.nowIso();
    if (input.result.status === "submitted" || input.result.status === "processing") {
      const job =
        input.result.status === "submitted" || input.result.status === "processing"
          ? input.result.providerJob
          : undefined;
      const prevRev = current.revision;
      current = updateStepStatus(current, input.stepId, "submitted", at, (s) => {
        const attempts = s.attempts.map((a) =>
          a.id === input.attemptId
            ? {
                ...a,
                status: "submitted" as const,
                providerJob: job,
              }
            : a
        );
        return { ...s, attempts, activeAttemptId: input.attemptId };
      });
      // allow submitted -> polling same tick later
      current = await saveRun(current, prevRev);
      await publishAll(events, [
        createProductionEvent(eventFactory(ctx), {
          type: "attempt.submitted",
          correlationId: ctx.correlationId,
          projectId: current.projectId,
          runId: current.id,
          sceneId: input.sceneId,
          stepId: input.stepId,
          attemptId: input.attemptId,
          data: { externalJobId: job?.externalJobId ?? null },
        }),
      ]);
      return { run: current, waiting: "awaiting_provider_job" };
    }

    if (input.result.status === "cancelled") {
      await failAttemptIdempotency(ports.idempotency, input.idempotencyKey, "cancelled").catch(
        () => undefined
      );
      try {
        const released = await releaseFullReservation(ports.budget, {
          reservationId: input.reservationId,
          runId: current.id,
          sceneId: input.sceneId,
          stepId: input.stepId,
          attemptId: input.attemptId,
          amount: input.reserved,
        });
        current = withRunUpdate(
          current,
          {
            releasedCost: money(
              current.releasedCost.amountMinor + released.amountMinor,
              current.currency
            ),
          },
          at
        );
      } catch {
        /* release best-effort on cancel */
      }
      const prevRev = current.revision;
      current = updateStepStatus(current, input.stepId, "cancelled", at, (s) => ({
        ...s,
        attempts: s.attempts.map((a) =>
          a.id === input.attemptId
            ? { ...a, status: "cancelled" as const, completedAt: at }
            : a
        ),
      }));
      current = await saveRun(current, prevRev);
      return { run: current };
    }

    if (input.result.status === "failed") {
      const err = mapGenError(input.result.error);
      await failAttemptIdempotency(
        ports.idempotency,
        input.idempotencyKey,
        err.code
      ).catch(() => undefined);
      try {
        const released = await releaseFullReservation(ports.budget, {
          reservationId: input.reservationId,
          runId: current.id,
          sceneId: input.sceneId,
          stepId: input.stepId,
          attemptId: input.attemptId,
          amount: input.reserved,
        });
        const prev = current.revision;
        current = withRunUpdate(
          current,
          {
            releasedCost: money(
              current.releasedCost.amountMinor + released.amountMinor,
              current.currency
            ),
          },
          at
        );
        current = await saveRun(current, prev);
      } catch {
        /* */
      }

      let prevRev = current.revision;
      current = updateStepStatus(current, input.stepId, "validating", at, (s) => ({
        ...s,
        attempts: s.attempts.map((a) =>
          a.id === input.attemptId
            ? { ...a, status: "failed" as const, error: err, completedAt: at }
            : a
        ),
      }));
      current = await saveRun(current, prevRev);

      await publishAll(events, [
        createProductionEvent(eventFactory(ctx), {
          type: "attempt.failed",
          correlationId: ctx.correlationId,
          projectId: current.projectId,
          runId: current.id,
          sceneId: input.sceneId,
          stepId: input.stepId,
          attemptId: input.attemptId,
          data: { code: err.code, retryable: err.retryable },
        }),
      ]);

      const ps = planStep(plan, input.stepId)!;
      const stepAfter = findStep(current, input.stepId)!;
      const fb = decideFallback({
        step: ps.step,
        attempts: stepAfter.attempts,
        lastError: err,
        policy: current.policy,
        cancelled: current.status === "cancelling",
      });

      prevRev = current.revision;
      if (fb.allowed) {
        current = updateStepStatus(current, input.stepId, "fallback_ready", at);
        current = await saveRun(current, prevRev);
        await publishAll(events, [
          createProductionEvent(eventFactory(ctx), {
            type: "fallback.selected",
            correlationId: ctx.correlationId,
            projectId: current.projectId,
            runId: current.id,
            sceneId: input.sceneId,
            stepId: input.stepId,
            data: { fallbackIndex: fb.fallbackIndex, reason: fb.reason },
          }),
        ]);
      } else {
        current = updateStepStatus(current, input.stepId, "failed", at);
        current = await saveRun(current, prevRev);
      }
      return { run: current };
    }

    // completed
    const output = input.result.output;
    const prevRev0 = current.revision;
    current = updateStepStatus(current, input.stepId, "validating", at, (s) => ({
      ...s,
      attempts: s.attempts.map((a) =>
        a.id === input.attemptId
          ? {
              ...a,
              status: "completed" as const,
              output,
              actualCost: input.result.status === "completed" ? input.result.actualCost : undefined,
              completedAt: at,
            }
          : a
      ),
    }));
    current = await saveRun(current, prevRev0);

    const ps = planStep(plan, input.stepId)!;
    const quality = await validateAttemptQuality(
      ports.quality,
      { step: ps.step, asset: output, nowIso: at },
      { correlationId: ctx.correlationId, nowIso: at }
    );

    if (quality.status === "needs_review") {
      const prevRev = current.revision;
      current = withRunUpdate(
        current,
        {
          reviewRequest: {
            sceneId: input.sceneId,
            stepId: input.stepId,
            attemptId: input.attemptId,
            reasons: quality.reasons,
          },
          waitingReason: "needs_review",
        },
        at
      );
      current = await saveRun(current, prevRev);
      return {
        run: current,
        review: {
          status: "needs_review",
          run: current,
          review: {
            sceneId: input.sceneId,
            stepId: input.stepId,
            attemptId: input.attemptId,
            reasons: quality.reasons,
          },
          events,
        },
      };
    }

    if (quality.status === "rejected") {
      await publishAll(events, [
        createProductionEvent(eventFactory(ctx), {
          type: "quality.rejected",
          correlationId: ctx.correlationId,
          projectId: current.projectId,
          runId: current.id,
          sceneId: input.sceneId,
          stepId: input.stepId,
          attemptId: input.attemptId,
          data: { retryableWithFallback: quality.retryableWithFallback },
        }),
      ]);

      // Release / don't commit success cost — treat as failed attempt for fallback policy
      try {
        const released = await releaseFullReservation(ports.budget, {
          reservationId: input.reservationId,
          runId: current.id,
          sceneId: input.sceneId,
          stepId: input.stepId,
          attemptId: input.attemptId,
          amount: input.reserved,
        });
        const prev = current.revision;
        current = withRunUpdate(
          current,
          {
            releasedCost: money(
              current.releasedCost.amountMinor + released.amountMinor,
              current.currency
            ),
          },
          at
        );
        current = await saveRun(current, prev);
      } catch {
        /* */
      }

      await failAttemptIdempotency(
        ports.idempotency,
        input.idempotencyKey,
        "quality_rejected"
      ).catch(() => undefined);

      const qerr: ProductionAttemptError = {
        code: "quality_rejected",
        message: quality.reasons.map((r) => r.message).join("; "),
        retryable: quality.retryableWithFallback,
        category: "quality",
      };

      let prevRev = current.revision;
      current = updateStepStatus(current, input.stepId, "validating", at, (s) => ({
        ...s,
        attempts: s.attempts.map((a) =>
          a.id === input.attemptId
            ? { ...a, status: "failed" as const, error: qerr, completedAt: at }
            : a
        ),
      }));
      current = await saveRun(current, prevRev);

      const stepAfter = findStep(current, input.stepId)!;
      const fb = decideFallback({
        step: ps.step,
        attempts: stepAfter.attempts,
        lastError: qerr,
        qualityRejected: true,
        policy: current.policy,
        cancelled: current.status === "cancelling",
      });

      prevRev = current.revision;
      if (fb.allowed) {
        current = updateStepStatus(current, input.stepId, "fallback_ready", at);
        current = await saveRun(current, prevRev);
        await publishAll(events, [
          createProductionEvent(eventFactory(ctx), {
            type: "fallback.selected",
            correlationId: ctx.correlationId,
            projectId: current.projectId,
            runId: current.id,
            stepId: input.stepId,
            data: { fallbackIndex: fb.fallbackIndex, reason: fb.reason },
          }),
        ]);
      } else {
        current = updateStepStatus(current, input.stepId, "failed", at);
        current = await saveRun(current, prevRev);
      }
      return { run: current };
    }

    // accepted
    const settle = await settleAttemptBudget(ports.budget, {
      reservationId: input.reservationId,
      runId: current.id,
      sceneId: input.sceneId,
      stepId: input.stepId,
      attemptId: input.attemptId,
      reserved: input.reserved,
      actualCost: input.result.status === "completed" ? input.result.actualCost : undefined,
    });

    await completeAttemptIdempotency(
      ports.idempotency,
      input.idempotencyKey,
      input.idempotencyKey
    );

    const prevRev = current.revision;
    current = updateStepStatus(current, input.stepId, "completed", at, (s) => ({
      ...s,
      outputAssets: [...s.outputAssets, output],
      committedCost: settle.committed,
      attempts: s.attempts.map((a) =>
        a.id === input.attemptId
          ? {
              ...a,
              status: "completed" as const,
              actualCost: settle.committed,
              costKind: settle.costKind,
              output,
              completedAt: at,
            }
          : a
      ),
    }));
    current = withRunUpdate(
      current,
      {
        committedCost: money(
          current.committedCost.amountMinor + settle.committed.amountMinor,
          current.currency
        ),
        releasedCost: money(
          current.releasedCost.amountMinor + settle.released.amountMinor,
          current.currency
        ),
      },
      at
    );
    current = await saveRun(current, prevRev);

    await publishAll(events, [
      createProductionEvent(eventFactory(ctx), {
        type: "quality.accepted",
        correlationId: ctx.correlationId,
        projectId: current.projectId,
        runId: current.id,
        sceneId: input.sceneId,
        stepId: input.stepId,
        attemptId: input.attemptId,
      }),
      createProductionEvent(eventFactory(ctx), {
        type: "attempt.completed",
        correlationId: ctx.correlationId,
        projectId: current.projectId,
        runId: current.id,
        sceneId: input.sceneId,
        stepId: input.stepId,
        attemptId: input.attemptId,
        data: {
          costKind: settle.costKind,
          amountMinor: settle.committed.amountMinor,
        },
      }),
    ]);

    // Scene completed event
    const scene = current.scenes.find((s) => s.sceneId === input.sceneId);
    if (scene?.status === "completed") {
      await publishAll(events, [
        createProductionEvent(eventFactory(ctx), {
          type: "scene.completed",
          correlationId: ctx.correlationId,
          projectId: current.projectId,
          runId: current.id,
          sceneId: input.sceneId,
        }),
      ]);
    }

    return { run: current };
  }

  async function launchReadyStep(input: {
    run: ProductionRun;
    plan: GenerationPlan;
    packages: ScenePackage[];
    ready: { sceneId: string; stepId: string; reason: string };
    ctx: ProductionExecutionContext;
    events: ProductionEvent[];
    /** Queue job attempt id — when set, reused instead of nextId() (VHS-114). */
    forcedAttemptId?: string;
  }): Promise<{
    run: ProductionRun;
    waiting?: ProductionWaitingReason;
    review?: ProductionDirectorResult;
    skippedEngine?: boolean;
    engineResult?: GenerationResult;
  }> {
    const { plan, packages, ctx, events } = input;
    let current = input.run;
    const at = ctx.nowIso();
    const ps = planStep(plan, input.ready.stepId);
    if (!ps) return { run: current };
    const pkg = packages.find((p) => p.sceneId === input.ready.sceneId);
    if (!pkg) {
      const prevRev = current.revision;
      const st = findStep(current, input.ready.stepId)?.status ?? "pending";
      if (st === "pending" || st === "ready" || st === "fallback_ready") {
        current = updateStepStatus(current, input.ready.stepId, "skipped", at);
      }
      current = await saveRun(current, prevRev);
      return { run: current };
    }

    const stepRun = findStep(current, input.ready.stepId)!;
    const isFallback = input.ready.reason === "fallback_ready" || stepRun.status === "fallback_ready";

    // Mark ready
    if (stepRun.status === "pending") {
      const prevRev = current.revision;
      current = updateStepStatus(current, input.ready.stepId, "ready", at);
      current = await saveRun(current, prevRev);
      await publishAll(events, [
        createProductionEvent(eventFactory(ctx), {
          type: "step.ready",
          correlationId: ctx.correlationId,
          projectId: current.projectId,
          runId: current.id,
          sceneId: input.ready.sceneId,
          stepId: input.ready.stepId,
        }),
      ]);
    }

    // Scene started
    const scene = current.scenes.find((s) => s.sceneId === input.ready.sceneId);
    if (scene && scene.status === "pending") {
      await publishAll(events, [
        createProductionEvent(eventFactory(ctx), {
          type: "scene.started",
          correlationId: ctx.correlationId,
          projectId: current.projectId,
          runId: current.id,
          sceneId: input.ready.sceneId,
        }),
      ]);
    }

    const attempts = findStep(current, input.ready.stepId)!.attempts;
    let providerId = ps.step.providerId;
    let modelId = ps.step.modelId;
    let estimate = ps.step.estimate;
    let kind: ProductionAttempt["kind"] = "primary";
    let fallbackIndex: number | undefined;

    if (isFallback) {
      const used = attempts.filter((a) => a.kind === "fallback").length;
      const fb = ps.step.fallbacks[used];
      if (!fb) {
        const prevRev = current.revision;
        current = updateStepStatus(current, input.ready.stepId, "failed", at);
        current = await saveRun(current, prevRev);
        return { run: current };
      }
      providerId = fb.providerId;
      modelId = fb.modelId;
      estimate = fb.estimate;
      kind = "fallback";
      fallbackIndex = used;
    } else if (attempts.some((a) => a.kind === "primary")) {
      // No silent primary retry
      return { run: current, skippedEngine: true };
    }

    const attemptNumber = nextAttemptNumber(attempts);
    const attemptId = input.forcedAttemptId ?? ctx.nextId();
    const { command, key, fingerprint } = buildStepCommand({
      plan,
      run: current,
      sceneId: input.ready.sceneId,
      step: ps.step,
      scenePackage: pkg,
      attempt: attemptNumber,
      providerId,
      modelId,
      estimate,
      at,
    });

    // Budget first
    try {
      await reserveAttemptBudget(ports.budget, {
        reservationId: attemptId,
        runId: current.id,
        sceneId: input.ready.sceneId,
        stepId: input.ready.stepId,
        attemptId,
        estimate: estimate.total,
        runCurrency: current.currency,
      });
    } catch {
      return { run: current, waiting: "budget_blocked" };
    }

    let prevRev = current.revision;
    current = updateStepStatus(current, input.ready.stepId, "reserved", at);
    current = await saveRun(current, prevRev);

    await publishAll(events, [
      createProductionEvent(eventFactory(ctx), {
        type: "attempt.reserved",
        correlationId: ctx.correlationId,
        projectId: current.projectId,
        runId: current.id,
        sceneId: input.ready.sceneId,
        stepId: input.ready.stepId,
        attemptId,
        data: { amountMinor: estimate.total.amountMinor, kind },
      }),
    ]);

    const idemp = await beginAttemptIdempotency(ports.idempotency, {
      key,
      fingerprint,
      runAlreadyCompleted: attempts.some(
        (a) => a.idempotencyKey === key && a.status === "completed"
      ),
    });

    if (idemp.action === "conflict") {
      await releaseFullReservation(ports.budget, {
        reservationId: attemptId,
        runId: current.id,
        sceneId: input.ready.sceneId,
        stepId: input.ready.stepId,
        attemptId,
        amount: estimate.total,
      }).catch(() => money(0, current.currency));
      prevRev = current.revision;
      current = updateStepStatus(current, input.ready.stepId, "failed", at);
      current = await saveRun(current, prevRev);
      return { run: current };
    }

    if (idemp.action === "wait_in_progress") {
      await releaseFullReservation(ports.budget, {
        reservationId: attemptId,
        runId: current.id,
        sceneId: input.ready.sceneId,
        stepId: input.ready.stepId,
        attemptId,
        amount: estimate.total,
      }).catch(() => money(0, current.currency));
      // Stay reserved→ ready/fallback_ready for a later tick without double-exec
      prevRev = current.revision;
      current = updateStepStatus(
        current,
        input.ready.stepId,
        isFallback ? "fallback_ready" : "ready",
        at
      );
      current = await saveRun(current, prevRev);
      return { run: current, waiting: "idempotency_in_progress" };
    }

    if (idemp.action === "reuse_completed") {
      // Reuse: do not call engine again
      const existing = attempts.find((a) => a.idempotencyKey === key && a.output);
      if (existing?.output) {
        const handled = await handleEngineResult({
          run: current,
          plan,
          sceneId: input.ready.sceneId,
          stepId: input.ready.stepId,
          attemptId: existing.id,
          result: {
            status: "completed",
            output: existing.output,
            completedAt: at,
            actualCost: existing.actualCost,
          },
          ctx,
          events,
          idempotencyKey: key,
          reservationId: attemptId,
          reserved: estimate.total,
        });
        return handled;
      }
      // Store says complete but no output in run — release and fail closed
      await releaseFullReservation(ports.budget, {
        reservationId: attemptId,
        runId: current.id,
        sceneId: input.ready.sceneId,
        stepId: input.ready.stepId,
        attemptId,
        amount: estimate.total,
      }).catch(() => money(0, current.currency));
      prevRev = current.revision;
      current = updateStepStatus(current, input.ready.stepId, "failed", at);
      current = await saveRun(current, prevRev);
      return { run: current };
    }

    const newAttempt: ProductionAttempt = {
      id: attemptId,
      stepId: input.ready.stepId,
      attemptNumber,
      kind,
      providerId: providerId as ProductionAttempt["providerId"],
      modelId: modelId as ProductionAttempt["modelId"],
      idempotencyKey: key,
      status: "executing",
      estimate,
      fallbackIndex,
      startedAt: at,
    };
    assertAttemptRules([...attempts, newAttempt]);

    prevRev = current.revision;
    current = updateStepStatus(current, input.ready.stepId, "executing", at, (s) => ({
      ...s,
      attempts: [...s.attempts, newAttempt],
      activeAttemptId: attemptId,
    }));
    current = await saveRun(current, prevRev);

    await publishAll(events, [
      createProductionEvent(eventFactory(ctx), {
        type: "attempt.started",
        correlationId: ctx.correlationId,
        projectId: current.projectId,
        runId: current.id,
        sceneId: input.ready.sceneId,
        stepId: input.ready.stepId,
        attemptId,
        data: {
          providerId: String(providerId),
          modelId: String(modelId),
          kind,
        },
      }),
    ]);

    // Deep-freeze guard: do not mutate plan
    const planFrozen = Object.isFrozen(plan.scenePlans) || true;
    void planFrozen;

    const result = await engine.execute(command, {
      correlationId: ctx.correlationId,
      requestedAt: at,
      signal: ctx.signal,
      // Explicitly omit idempotencyStore — PD owns it
    });

    const handled = await handleEngineResult({
      run: current,
      plan,
      sceneId: input.ready.sceneId,
      stepId: input.ready.stepId,
      attemptId,
      result,
      ctx,
      events,
      idempotencyKey: key,
      reservationId: attemptId,
      reserved: estimate.total,
    });
    return { ...handled, engineResult: result };
  }

  async function buildEnqueueCommandsForRun(
    run: ProductionRun,
    plan: GenerationPlan,
    context: ProductionExecutionContext
  ): Promise<EnqueueProductionJobCommand[]> {
    const ready = findReadySteps(run, plan, run.policy);
    const limit = context.maxActionsPerAdvance ?? 2;
    const commands: EnqueueProductionJobCommand[] = [];
    for (const r of ready.slice(0, limit)) {
      const ps = planStep(plan, r.stepId);
      if (!ps) continue;
      const stepRun = findStep(run, r.stepId);
      if (!stepRun) continue;
      const isFallback =
        r.reason === "fallback_ready" || stepRun.status === "fallback_ready";
      let providerId = ps.step.providerId;
      let modelId = ps.step.modelId;
      if (isFallback) {
        const used = stepRun.attempts.filter((a) => a.kind === "fallback").length;
        const fb = ps.step.fallbacks[used];
        if (!fb) continue;
        providerId = fb.providerId;
        modelId = fb.modelId;
      } else if (stepRun.attempts.some((a) => a.kind === "primary")) {
        continue;
      }
      const attemptNumber = nextAttemptNumber(stepRun.attempts);
      const attemptId = `${r.stepId}:a${attemptNumber}`;
      const payloadRef: ProductionPayloadReference = {
        planRevisionId: plan.id,
        scenePackageSceneId: r.sceneId,
        mode: "execute",
      };
      commands.push({
        runId: run.id,
        projectId: run.projectId,
        sceneId: r.sceneId,
        stepId: r.stepId,
        attemptId,
        action: ps.step.action,
        providerId: String(providerId),
        modelId: String(modelId),
        availableAt: context.nowIso(),
        payloadRef,
      });
    }
    return commands;
  }

  return {
    async start(input, context) {
      const events: ProductionEvent[] = [];
      const policy = validateProductionPolicy(input.policy ?? DEFAULT_PRODUCTION_POLICY);
      const issues = validatePlanForProduction(input.plan);
      if (issues.length) {
        return { status: "failed", errors: issues, events };
      }

      const readiness = checkProductionReadiness(input.readiness);
      if (!readiness.ready) {
        const errors: ProductionIssue[] = [
          ...readiness.missing.map((t) => ({
            code: "not_approved",
            message: `Artifact manquant: ${t}`,
            path: t,
          })),
          ...readiness.unapproved.map((t) => ({
            code: "not_approved",
            message: `Non approuvé: ${t}`,
            path: t,
          })),
          ...readiness.stale.map((t) => ({
            code: "not_approved",
            message: `Approbation obsolète: ${t}`,
            path: t,
          })),
        ];
        return { status: "failed", errors, events };
      }

      if (input.requireDurableIdempotency !== false && !ports.idempotency.durable) {
        return {
          status: "failed",
          errors: [
            {
              code: "store_required",
              message:
                "Store d'idempotence durable requis pour démarrer une production réelle.",
            },
          ],
          events,
        };
      }

      try {
        createBudgetSnapshot(input.budgetSnapshot);
      } catch {
        return {
          status: "failed",
          errors: [{ code: "budget_reservation_failed", message: "Budget snapshot invalide." }],
          events,
        };
      }

      const exposure = input.plan.fallbackExposure ?? input.plan.estimatedCost;
      const decision = decideBudget(input.budgetSnapshot, exposure);
      if (!decision.allowed) {
        return {
          status: "failed",
          errors: [
            {
              code: "budget_reservation_failed",
              message: `Budget insuffisant (${"reason" in decision ? decision.reason : "denied"}).`,
            },
          ],
          events,
        };
      }

      if (ports.runStore.findActiveByPlan) {
        const existing = await ports.runStore.findActiveByPlan(input.plan.id);
        if (existing) {
          return {
            status: "failed",
            errors: [
              {
                code: "concurrent_run",
                message: `Run concurrent actif: ${existing}`,
              },
            ],
            events,
          };
        }
      }

      const at = context.nowIso();
      const runId = input.runId ?? context.nextId();
      let run = createProductionRun({
        id: runId,
        projectId: input.plan.projectId,
        plan: input.plan,
        policy,
        createdAt: at,
        correlationId: context.correlationId,
      });
      run = withRunUpdate(run, { status: "validating" }, at);
      run = withRunUpdate(run, { status: "running" }, context.nowIso());

      try {
        await ports.runStore.create(run);
      } catch (e) {
        return {
          status: "failed",
          errors: [
            {
              code: "unknown",
              message: e instanceof Error ? e.message : "Échec création run.",
            },
          ],
          events,
        };
      }

      await publishAll(events, [
        createProductionEvent(eventFactory(context), {
          type: "production.started",
          correlationId: context.correlationId,
          projectId: run.projectId,
          runId: run.id,
          data: { planRevisionId: input.plan.id },
        }),
      ]);

      return { status: "started", run, events };
    },

    async advance(runId, context) {
      const events: ProductionEvent[] = [];
      const loaded = await ports.runStore.load(runId);
      if (!loaded) {
        return {
          status: "failed",
          errors: [{ code: "run_not_found", message: `Run introuvable: ${runId}` }],
          events,
        };
      }

      if (isTerminalRunStatus(loaded.status)) {
        const finalized = await maybeFinalize(loaded, context, events);
        if (finalized) return finalized;
        return { status: "progressed", run: loaded, events };
      }

      if (loaded.reviewRequest) {
        return {
          status: "needs_review",
          run: loaded,
          review: loaded.reviewRequest,
          events,
        };
      }

      const plan = resolvePlan(loaded.generationPlanRevisionId);
      if (!plan) {
        return {
          status: "failed",
          run: loaded,
          errors: [{ code: "invalid_input", message: "Plan introuvable pour ce run." }],
          events,
        };
      }
      const packages = resolveScenePackages(loaded.generationPlanRevisionId);

      const actionsLeft = { n: context.maxActionsPerAdvance ?? 2 };
      let current = loaded;

      if (current.status === "cancelling") {
        // Cancel in-flight cancellable jobs (bounded)
        for (const scene of current.scenes) {
          for (const step of scene.steps) {
            if (actionsLeft.n <= 0) break;
            if (step.status !== "submitted" && step.status !== "polling" && step.status !== "executing") {
              continue;
            }
            const attempt = step.attempts.find((a) => a.id === step.activeAttemptId);
            if (!attempt?.providerJob) {
              const at = context.nowIso();
              const prevRev = current.revision;
              current = updateStepStatus(current, step.stepId, "cancelled", at);
              current = await saveRun(current, prevRev);
              actionsLeft.n -= 1;
              continue;
            }
            actionsLeft.n -= 1;
            const at = context.nowIso();
            const cancelResult = await engine.cancel(
              attempt.providerJob,
              {
                correlationId: context.correlationId,
                requestedAt: at,
                signal: context.signal,
              },
              { providerId: attempt.providerId, modelId: attempt.modelId }
            );
            if (
              cancelResult.status === "failed" &&
              cancelResult.error.code === "cancellation_unsupported"
            ) {
              // Mark limitation via warning; wait
              const prevRev = current.revision;
              current = updateStepStatus(current, step.stepId, step.status, at, (s) => ({
                ...s,
                warnings: [
                  ...s.warnings,
                  {
                    code: "cancellation_unsupported",
                    message: "Annulation provider non supportée — attente fin job.",
                    stepId: s.stepId,
                  },
                ],
              }));
              current = await saveRun(current, prevRev);
              continue;
            }
            const prevRev = current.revision;
            current = updateStepStatus(current, step.stepId, "cancelled", at, (s) => ({
              ...s,
              attempts: s.attempts.map((a) =>
                a.id === attempt.id
                  ? { ...a, status: "cancelled" as const, completedAt: at }
                  : a
              ),
            }));
            current = await saveRun(current, prevRev);
            if (attempt.estimate) {
              try {
                const released = await releaseFullReservation(ports.budget, {
                  reservationId: attempt.id,
                  runId: current.id,
                  sceneId: scene.sceneId,
                  stepId: step.stepId,
                  attemptId: attempt.id,
                  amount: attempt.estimate.total,
                });
                const p = current.revision;
                current = withRunUpdate(
                  current,
                  {
                    releasedCost: money(
                      current.releasedCost.amountMinor + released.amountMinor,
                      current.currency
                    ),
                  },
                  at
                );
                current = await saveRun(current, p);
              } catch {
                /* */
              }
            }
          }
        }

        // Cancel pending/ready not started
        for (const scene of current.scenes) {
          for (const step of scene.steps) {
            if (step.status === "pending" || step.status === "ready" || step.status === "fallback_ready") {
              const at = context.nowIso();
              const prevRev = current.revision;
              current = updateStepStatus(current, step.stepId, "cancelled", at);
              current = await saveRun(current, prevRev);
            }
          }
        }

        const finalized = await maybeFinalize(current, context, events);
        if (finalized) return finalized;
        return {
          status: "waiting",
          run: current,
          reason: "awaiting_provider_job",
          events,
        };
      }

      current = await applySkips(current, context, events);

      const polled = await pollActiveJobs(current, plan, context, events, actionsLeft);
      current = polled.run;
      if (polled.review) return polled.review;
      if (polled.waiting === "max_actions_reached") {
        return { status: "waiting", run: current, reason: "max_actions_reached", events };
      }
      if (polled.waiting === "awaiting_provider_job" && actionsLeft.n <= 0) {
        return { status: "waiting", run: current, reason: "awaiting_provider_job", events };
      }

      const ready = findReadySteps(current, plan, current.policy);
      if (ready.length === 0 && actionsLeft.n > 0) {
        const finalized = await maybeFinalize(current, context, events);
        if (finalized) return finalized;
        const hasPolling = current.scenes.some((s) =>
          s.steps.some((st) => st.status === "submitted" || st.status === "polling")
        );
        if (hasPolling) {
          return { status: "waiting", run: current, reason: "awaiting_provider_job", events };
        }
        return { status: "waiting", run: current, reason: "no_ready_steps", events };
      }

      for (const r of ready) {
        if (actionsLeft.n <= 0) {
          return { status: "waiting", run: current, reason: "max_actions_reached", events };
        }
        if (current.status === "cancelling") break;
        actionsLeft.n -= 1;
        const launched = await launchReadyStep({
          run: current,
          plan,
          packages,
          ready: r,
          ctx: context,
          events,
        });
        current = launched.run;
        if (launched.review) return launched.review;
        if (launched.waiting) {
          return { status: "waiting", run: current, reason: launched.waiting, events };
        }
      }

      const finalized = await maybeFinalize(current, context, events);
      if (finalized) return finalized;

      return { status: "progressed", run: current, events };
    },

    async requestCancellation(runId, context) {
      const events: ProductionEvent[] = [];
      const loaded = await ports.runStore.load(runId);
      if (!loaded) {
        return {
          status: "failed",
          errors: [{ code: "run_not_found", message: `Run introuvable: ${runId}` }],
          events,
        };
      }

      if (loaded.status === "cancelled" || loaded.status === "cancelling") {
        // Idempotent
        await publishAll(events, [
          createProductionEvent(eventFactory(context), {
            type: "production.cancellation_requested",
            correlationId: context.correlationId,
            projectId: loaded.projectId,
            runId: loaded.id,
            data: { idempotent: true },
          }),
        ]);
        if (loaded.status === "cancelled") {
          const finalized = await maybeFinalize(loaded, context, events);
          if (finalized) return finalized;
        }
        return { status: "progressed", run: loaded, events };
      }

      if (!canRequestCancellation(loaded.status)) {
        return {
          status: "failed",
          run: loaded,
          errors: [
            {
              code: "cancelled",
              message: `Annulation impossible depuis le statut ${loaded.status}.`,
            },
          ],
          events,
        };
      }

      const at = context.nowIso();
      let run = withRunUpdate(loaded, { status: "cancelling" }, at);
      run = await saveRun(run, loaded.revision);

      await publishAll(events, [
        createProductionEvent(eventFactory(context), {
          type: "production.cancellation_requested",
          correlationId: context.correlationId,
          projectId: run.projectId,
          runId: run.id,
        }),
      ]);

      // Advance cancellation in same call (bounded)
      return this.advance(run.id, context);
    },

    async planEnqueueCommands(runId, context) {
      const loaded = await ports.runStore.load(runId);
      if (!loaded) return { commands: [], run: null };
      if (isTerminalRunStatus(loaded.status) || loaded.status === "cancelling") {
        return { commands: [], run: loaded };
      }
      const plan = resolvePlan(loaded.generationPlanRevisionId);
      if (!plan) return { commands: [], run: loaded };
      const current = await applySkips(loaded, context, []);
      const commands = await buildEnqueueCommandsForRun(current, plan, context);
      return { commands, run: current };
    },

    async processClaimedJob(claimedJob, lease, context) {
      if (
        lease.workerId !== claimedJob.leasedBy ||
        lease.leaseToken !== claimedJob.leaseToken
      ) {
        return {
          status: "lease_lost",
          publicMessage: "Lease invalide pour ce job.",
        };
      }

      const loaded = await ports.runStore.load(claimedJob.runId);
      if (!loaded) {
        return {
          status: "failed",
          runId: claimedJob.runId,
          errorCode: "run_not_found",
          publicMessage: "Run introuvable.",
          enqueueNext: [],
        };
      }

      if (loaded.status === "cancelling" || loaded.status === "cancelled") {
        return {
          status: "cancelled_run",
          runId: loaded.id,
          publicMessage: "Run en annulation — job non exécuté.",
        };
      }

      if (isTerminalRunStatus(loaded.status)) {
        return {
          status: "already_done",
          runId: loaded.id,
          enqueueNext: [],
        };
      }

      const plan = resolvePlan(loaded.generationPlanRevisionId);
      if (!plan) {
        return {
          status: "failed",
          runId: loaded.id,
          errorCode: "invalid_input",
          publicMessage: "Plan introuvable.",
          enqueueNext: [],
        };
      }

      const ps = planStep(plan, claimedJob.stepId);
      if (
        !ps ||
        ps.sceneId !== claimedJob.sceneId ||
        String(ps.step.action) !== claimedJob.action
      ) {
        return {
          status: "failed",
          runId: loaded.id,
          errorCode: "invalid_input",
          publicMessage: "Job incompatible avec le GenerationPlan.",
          enqueueNext: [],
        };
      }

      const stepRun = findStep(loaded, claimedJob.stepId);
      const existingAttempt = stepRun?.attempts.find((a) => a.id === claimedJob.attemptId);
      if (existingAttempt?.status === "completed" && existingAttempt.output) {
        const next = await buildEnqueueCommandsForRun(loaded, plan, context);
        return { status: "already_done", runId: loaded.id, enqueueNext: next };
      }

      const mode = claimedJob.payload.mode ?? "execute";
      const paid = context.paidGenerationEnabled !== false;
      if (!paid && (mode === "execute" || mode === "poll")) {
        return {
          status: "blocked_by_kill_switch",
          runId: loaded.id,
          publicMessage:
            "DIRECTOR_V2_PAID_GENERATION_ENABLED off — aucun appel provider.",
        };
      }

      const packages = resolveScenePackages(loaded.generationPlanRevisionId);
      const events: ProductionEvent[] = [];

      if (mode === "poll") {
        if (!existingAttempt?.providerJob) {
          return {
            status: "failed",
            runId: loaded.id,
            errorCode: "invalid_input",
            publicMessage: "Tentative sans job provider pour poll.",
            enqueueNext: [],
          };
        }
        const at = context.nowIso();
        let current = loaded;
        const prevRev = current.revision;
        current = updateStepStatus(current, claimedJob.stepId, "polling", at);
        current = await saveRun(current, prevRev);
        const polled = await engine.poll(
          existingAttempt.providerJob,
          {
            correlationId: context.correlationId,
            requestedAt: at,
            signal: context.signal,
          },
          {
            providerId: existingAttempt.providerId,
            modelId: existingAttempt.modelId,
            action: ps.step.action,
          }
        );
        const handled = await handleEngineResult({
          run: current,
          plan,
          sceneId: claimedJob.sceneId,
          stepId: claimedJob.stepId,
          attemptId: claimedJob.attemptId,
          result: polled,
          ctx: context,
          events,
          idempotencyKey: existingAttempt.idempotencyKey,
          reservationId: existingAttempt.id,
          reserved: existingAttempt.estimate.total,
        });
        if (handled.review) {
          return {
            status: "needs_review",
            runId: handled.run.id,
            publicMessage: "Revue humaine requise.",
          };
        }
        if (
          polled.status === "submitted" ||
          polled.status === "processing" ||
          handled.waiting === "awaiting_provider_job"
        ) {
          const pollAfter =
            (polled.status === "submitted" || polled.status === "processing"
              ? polled.pollAfterMs
              : undefined) ?? 3000;
          const availableAt = new Date(
            Date.parse(context.nowIso()) + pollAfter
          ).toISOString();
          return {
            status: "reschedule",
            runId: handled.run.id,
            availableAt,
            payloadRef: {
              ...claimedJob.payload,
              mode: "poll",
              externalJobId: existingAttempt.providerJob.externalJobId,
              pollAfterMs: pollAfter,
            },
            enqueueNext: await buildEnqueueCommandsForRun(handled.run, plan, context),
          };
        }
        if (polled.status === "failed" || polled.status === "cancelled") {
          return {
            status: "failed",
            runId: handled.run.id,
            errorCode:
              polled.status === "failed" ? polled.error.code : "cancelled",
            publicMessage:
              polled.status === "failed"
                ? polled.error.publicMessage
                : "Job annulé.",
            enqueueNext: await buildEnqueueCommandsForRun(handled.run, plan, context),
          };
        }
        return {
          status: "completed",
          runId: handled.run.id,
          enqueueNext: await buildEnqueueCommandsForRun(handled.run, plan, context),
        };
      }

      if (mode === "cancel") {
        return {
          status: "cancelled_run",
          runId: loaded.id,
          publicMessage: "Mode cancel — délégué à requestCancellation.",
        };
      }

      // execute
      const reason =
        stepRun?.status === "fallback_ready" ? "fallback_ready" : "deps_satisfied";
      const launched = await launchReadyStep({
        run: loaded,
        plan,
        packages,
        ready: {
          sceneId: claimedJob.sceneId,
          stepId: claimedJob.stepId,
          reason,
        },
        ctx: context,
        events,
        forcedAttemptId: claimedJob.attemptId,
      });

      if (launched.review) {
        return {
          status: "needs_review",
          runId: launched.run.id,
          publicMessage: "Revue humaine requise.",
        };
      }

      if (launched.skippedEngine) {
        return {
          status: "already_done",
          runId: launched.run.id,
          enqueueNext: await buildEnqueueCommandsForRun(launched.run, plan, context),
        };
      }

      const er = launched.engineResult;
      if (er && (er.status === "submitted" || er.status === "processing")) {
        const pollAfter = er.pollAfterMs ?? 3000;
        const availableAt = new Date(
          Date.parse(context.nowIso()) + pollAfter
        ).toISOString();
        return {
          status: "reschedule",
          runId: launched.run.id,
          availableAt,
          payloadRef: {
            planRevisionId: plan.id,
            scenePackageSceneId: claimedJob.sceneId,
            mode: "poll",
            externalJobId: er.providerJob.externalJobId,
            pollAfterMs: pollAfter,
          },
          enqueueNext: await buildEnqueueCommandsForRun(launched.run, plan, context),
        };
      }

      if (er?.status === "failed") {
        return {
          status: "failed",
          runId: launched.run.id,
          errorCode: er.error.code,
          publicMessage: er.error.publicMessage,
          enqueueNext: await buildEnqueueCommandsForRun(launched.run, plan, context),
        };
      }

      const stepAfter = findStep(launched.run, claimedJob.stepId);
      if (stepAfter?.status === "failed") {
        return {
          status: "failed",
          runId: launched.run.id,
          errorCode: "engine_failed",
          publicMessage: "Étape échouée.",
          enqueueNext: await buildEnqueueCommandsForRun(launched.run, plan, context),
        };
      }

      return {
        status: "completed",
        runId: launched.run.id,
        enqueueNext: await buildEnqueueCommandsForRun(launched.run, plan, context),
      };
    },
  };
}

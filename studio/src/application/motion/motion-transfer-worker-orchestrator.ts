/**
 * MT-008 — Motion Transfer worker orchestration (fake provider only in tests).
 * Extends canonical run-once via claimed-job-processor branch — no parallel worker.
 *
 * Exactly-once honesty:
 *   fal has no native idempotency → DB intent → submitting → submit → persist providerJobId
 *   Crash between accept and persist → submission_unknown → NO AUTOMATIC RESUBMIT
 */

import { createHash } from "node:crypto";
import { money, type Money } from "@/domain/cost";
import {
  assertEstimateUsableForPaidReservation,
  assertProviderOutputDescriptorSafe,
  isMotionTransferDomainError,
  type MotionTransferEstimate,
  type MotionTransferProviderPort,
  type MotionTransferProviderContext,
  type MotionTransferProviderMediaBoundary,
  type MotionTransferProviderSubmitInput,
  type MotionTransferInput,
} from "@/domain/motion";
import {
  releaseFullReservation,
  settleAttemptBudget,
} from "@/application/production/budget-coordinator";
import type { BudgetReservationPort } from "@/application/production/ports";
import type {
  ClaimedProductionJob,
  LeaseContext,
  MotionTransferJobPayloadMeta,
  ProcessClaimedJobOutcome,
  ProductionPayloadReference,
} from "@/application/production/enqueue";
import type { ProductionExecutionContext } from "@/application/production/production-director";
import {
  type MotionTransferRegistryGateProfile,
} from "./motion-transfer-worker-gates";
import {
  evaluateMotionTransferSubmitPath,
  type MotionTransferLifecycleController,
} from "./motion-transfer-lifecycle-gates";
import {
  assertMotionEventRedacted,
  fingerprintProviderJobId,
  type MotionTransferWorkerEventSink,
} from "./motion-transfer-worker-events";
import type { MotionTransferPrivacyDecisions } from "@/infrastructure/providers/motion-transfer/privacy-gate";
import {
  FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
  FAL_KLING_MOTION_CONTROL_PRICING_VERSION,
} from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-adapter";

export const MOTION_TRANSFER_WORKER_ORCHESTRATOR_VERSION = "mt008-1.0.0" as const;

export type MotionTransferAttemptRecord = {
  attemptId: string;
  jobId: string;
  runId: string;
  providerJobId?: string;
  reservationId: string;
  reserved: Money;
  estimate: MotionTransferEstimate;
  submitCount: number;
  pollCount: number;
  resubmitCount: number;
  phase: MotionTransferJobPayloadMeta["phase"];
  terminal: boolean;
  ledgerSettled: boolean;
  outputRef?: string;
  lateQuarantined: boolean;
  usageUnknown: boolean;
  reconciliationRequired: boolean;
  requestFingerprint: string;
  submitIntentAt?: string;
  adapterVersion: string;
  mediaBoundary: MotionTransferProviderMediaBoundary;
  motionInput: MotionTransferInput;
  deadlineAt?: string;
};

export type MotionTransferAttemptStore = {
  get(attemptId: string): MotionTransferAttemptRecord | undefined;
  save(record: MotionTransferAttemptRecord): void;
};

export function createMemoryMotionTransferAttemptStore(): MotionTransferAttemptStore & {
  records: Map<string, MotionTransferAttemptRecord>;
} {
  const records = new Map<string, MotionTransferAttemptRecord>();
  return {
    records,
    get(id) {
      return records.get(id);
    },
    save(record) {
      records.set(record.attemptId, { ...record });
    },
  };
}

export type MotionTransferWorkerOrchestratorOptions = {
  provider: MotionTransferProviderPort;
  budget: BudgetReservationPort;
  attempts: MotionTransferAttemptStore;
  registryProfile: MotionTransferRegistryGateProfile;
  privacyDecisions?: Partial<MotionTransferPrivacyDecisions>;
  env?: Record<string, string | undefined>;
  events?: MotionTransferWorkerEventSink;
  /**
   * MT-013K-WIRE — admission / submit / poll separation.
   * After providerJobId persist: admission+submit OFF, poll retained.
   */
  lifecycle?: MotionTransferLifecycleController;
  /**
   * When set, jobs whose projectId is outside this list are refused (MV-001 scope).
   */
  allowedProjectIds?: readonly string[];
  /**
   * TEST ONLY — simulate crash after provider accept, before durable providerJobId persist.
   * Leaves submission_unknown; never auto-resubmit.
   */
  simulateCrashAfterSubmitBeforePersist?: boolean;
  /** Default poll delay when provider omits pollAfterMs. */
  defaultPollAfterMs?: number;
  /** Max polls before timed_out. */
  maxPolls?: number;
  adapterVersion?: string;
  pricingVersion?: string;
};

export type MotionTransferWorkerProcessor = {
  processClaimedJob(
    job: ClaimedProductionJob,
    lease: LeaseContext,
    context: ProductionExecutionContext,
  ): Promise<ProcessClaimedJobOutcome>;
};

function emit(
  sink: MotionTransferWorkerEventSink | undefined,
  event: Parameters<MotionTransferWorkerEventSink["emit"]>[0],
): void {
  assertMotionEventRedacted(event);
  sink?.emit(event);
}

function requestFingerprint(input: {
  attemptId: string;
  idempotencyKey: string;
  modelId: string;
}): string {
  return createHash("sha256")
    .update(
      `mt008|${input.attemptId}|${input.idempotencyKey}|${input.modelId}`,
    )
    .digest("hex")
    .slice(0, 16);
}

/** Bounded poll backoff (500ms–60s) — mirrors worker/polling.ts without payload coupling. */
function nextPollDelayMs(baseMs: number, pollCount: number): number {
  const raw = baseMs * Math.min(1 + Math.floor(pollCount / 3), 4);
  return Math.min(Math.max(raw, 500), 60_000);
}

function buildProviderContext(
  job: ClaimedProductionJob,
  context: ProductionExecutionContext,
  deadlineAt?: string,
): MotionTransferProviderContext {
  return {
    correlationId: context.correlationId,
    workspaceId: job.workspaceId ?? "ws-motion",
    projectId: job.projectId,
    runId: job.runId,
    jobId: job.jobId,
    attempt: 1,
    idempotencyKey: `mt:${job.runId}:${job.attemptId}`,
    providerId: job.providerId,
    modelId: job.modelId,
    deadlineAt,
    timeoutMs: 120_000,
    signal: context.signal,
    requestedAt: context.nowIso(),
  };
}

/**
 * Create Motion Transfer processor for canonical worker branch.
 */
export function createMotionTransferWorkerOrchestrator(
  options: MotionTransferWorkerOrchestratorOptions,
): MotionTransferWorkerProcessor {
  const maxPolls = options.maxPolls ?? 20;
  const defaultPollAfterMs = options.defaultPollAfterMs ?? 2_000;
  const adapterVersion =
    options.adapterVersion ?? FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION;
  const pricingVersion =
    options.pricingVersion ?? FAL_KLING_MOTION_CONTROL_PRICING_VERSION;
  const env =
    options.env ?? (process.env as Record<string, string | undefined>);

  async function settleOrRelease(input: {
    record: MotionTransferAttemptRecord;
    actualCost?: Money;
    usageUnknown?: boolean;
  }): Promise<void> {
    if (input.record.ledgerSettled) return;
    if (input.usageUnknown) {
      input.record.usageUnknown = true;
      input.record.reconciliationRequired = true;
      input.record.ledgerSettled = true; // terminal accounting freeze — no silent commit
      options.attempts.save(input.record);
      return;
    }
    if (input.actualCost) {
      if (input.actualCost.amountMinor > input.record.reserved.amountMinor) {
        input.record.reconciliationRequired = true;
        input.record.ledgerSettled = true;
        options.attempts.save(input.record);
        return;
      }
      await settleAttemptBudget(options.budget, {
        reservationId: input.record.reservationId,
        runId: input.record.runId,
        sceneId: "motion",
        stepId: "motion_transfer",
        attemptId: input.record.attemptId,
        reserved: input.record.reserved,
        actualCost: input.actualCost,
      });
    } else {
      await releaseFullReservation(options.budget, {
        reservationId: input.record.reservationId,
        runId: input.record.runId,
        sceneId: "motion",
        stepId: "motion_transfer",
        attemptId: input.record.attemptId,
        amount: input.record.reserved,
      });
    }
    input.record.ledgerSettled = true;
    options.attempts.save(input.record);
  }

  function payloadFrom(
    job: ClaimedProductionJob,
    motion: MotionTransferJobPayloadMeta,
    mode: ProductionPayloadReference["mode"],
    externalJobId?: string,
    pollAfterMs?: number,
  ): ProductionPayloadReference {
    return {
      planRevisionId: job.payload.planRevisionId,
      scenePackageSceneId: job.payload.scenePackageSceneId,
      mode,
      externalJobId,
      pollAfterMs,
      motion: { ...motion },
    };
  }

  async function handleExecute(
    job: ClaimedProductionJob,
    context: ProductionExecutionContext,
  ): Promise<ProcessClaimedJobOutcome> {
    const existing = options.attempts.get(job.attemptId);
    if (existing?.terminal) {
      return { status: "already_done", runId: job.runId, enqueueNext: [] };
    }
    if (existing?.phase === "submission_unknown") {
      return {
        status: "needs_review",
        runId: job.runId,
        publicMessage:
          "submission_unknown — réconciliation humaine/provider requise (pas de resubmit).",
      };
    }
    if (existing?.providerJobId) {
      // Already submitted — resume as poll (no resubmit)
      existing.phase = "polling";
      options.attempts.save(existing);
      const availableAt = new Date(
        Date.parse(context.nowIso()) + defaultPollAfterMs,
      ).toISOString();
      return {
        status: "reschedule",
        runId: job.runId,
        availableAt,
        payloadRef: payloadFrom(
          job,
          {
            phase: "polling",
            reservationId: existing.reservationId,
            reservedMinor: existing.reserved.amountMinor,
            currency: existing.reserved.currency,
            estimateMinor: existing.estimate.estimatedCostMinor,
            adapterVersion,
            pricingVersion,
            pollCount: existing.pollCount,
            requestFingerprint: existing.requestFingerprint,
            providerJobIdFingerprint: fingerprintProviderJobId(
              existing.providerJobId,
            ),
            humanReviewPolicyPresent: true,
          },
          "poll",
          existing.providerJobId,
          defaultPollAfterMs,
        ),
        enqueueNext: [],
      };
    }

    const motionMeta = job.payload.motion;
    const reservationId = motionMeta?.reservationId;
    const reservedMinor = motionMeta?.reservedMinor;
    const estimateMinor = motionMeta?.estimateMinor;

    if (!reservationId || reservedMinor == null || estimateMinor == null) {
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "budget_reservation_required",
        publicMessage: "Réservation budget requise avant submit Motion Transfer.",
        enqueueNext: [],
      };
    }

    const gates = evaluateMotionTransferSubmitPath({
      lifecycle: options.lifecycle,
      workerGates: {
        env,
        privacyDecisions: options.privacyDecisions,
        registryProfile: options.registryProfile,
        firmEstimatePresent:
          typeof estimateMinor === "number" && estimateMinor >= 0,
        reservationPresent: true,
        mediaAvailable: true,
        humanReviewPolicyPresent: motionMeta?.humanReviewPolicyPresent === true,
        routeSelected: Boolean(job.providerId && job.modelId),
        versionsSupported: true,
      },
    });

    if (!gates.ok) {
      return {
        status: "blocked_by_kill_switch",
        runId: job.runId,
        publicMessage: gates.reason ?? "Motion Transfer gates blocked.",
      };
    }

    // Attempt record must be pre-seeded by enqueue harness (immutable input + estimate).
    const seeded = options.attempts.get(job.attemptId);
    if (!seeded) {
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "motion_attempt_missing",
        publicMessage: "Attempt Motion Transfer non initialisé.",
        enqueueNext: [],
      };
    }

    try {
      assertEstimateUsableForPaidReservation(seeded.estimate);
    } catch {
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "provider_invalid_request",
        publicMessage: "Estimation non ferme — submit interdit.",
        enqueueNext: [],
      };
    }

    emit(options.events, {
      type: "motion.job.claimed",
      correlationId: context.correlationId,
      projectId: job.projectId,
      runId: job.runId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      providerId: job.providerId,
      modelId: job.modelId,
      adapterVersion,
      phase: "submitting",
    });

    seeded.phase = "submitting";
    seeded.submitIntentAt = context.nowIso();
    options.attempts.save(seeded);

    emit(options.events, {
      type: "motion.submit.intent",
      correlationId: context.correlationId,
      projectId: job.projectId,
      runId: job.runId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      providerId: job.providerId,
      modelId: job.modelId,
      adapterVersion,
      phase: "submitting",
    });

    const providerCtx = buildProviderContext(job, context, seeded.deadlineAt);
    const submitInput: MotionTransferProviderSubmitInput = {
      motion: seeded.motionInput,
      providerId: job.providerId,
      modelId: job.modelId,
      estimate: seeded.estimate,
      attempt: 1,
      mediaBoundary: seeded.mediaBoundary,
      outputConstraints: seeded.motionInput.output,
      reviewPolicyProvenance: { humanValidationRequired: true },
    };

    let submission;
    try {
      seeded.submitCount += 1;
      options.attempts.save(seeded);
      submission = await options.provider.submit(submitInput, providerCtx);
    } catch (err) {
      const code = isMotionTransferDomainError(err)
        ? err.code
        : "provider_failed";
      const msg = isMotionTransferDomainError(err)
        ? err.publicMessage
        : "Échec submit Motion Transfer.";
      await settleOrRelease({ record: seeded });
      seeded.phase = "provider_failed";
      seeded.terminal = true;
      options.attempts.save(seeded);
      emit(options.events, {
        type: "motion.provider.failed",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        status: code,
        phase: "provider_failed",
      });
      emit(options.events, {
        type: "motion.ledger.reconciled",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        costMinor: 0,
        status: "released_full",
      });
      return {
        status: "failed",
        runId: job.runId,
        errorCode: code,
        publicMessage: msg,
        enqueueNext: [],
      };
    }

    if (options.simulateCrashAfterSubmitBeforePersist) {
      seeded.phase = "submission_unknown";
      seeded.reconciliationRequired = true;
      seeded.terminal = true;
      options.attempts.save(seeded);
      emit(options.events, {
        type: "motion.submit.unknown",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        providerId: job.providerId,
        modelId: job.modelId,
        adapterVersion,
        phase: "submission_unknown",
        status: "ambiguous_accept_before_persist",
      });
      return {
        status: "needs_review",
        runId: job.runId,
        publicMessage:
          "submission_unknown — provider peut avoir accepté; pas de resubmit automatique.",
      };
    }

    if (!submission.providerJobId?.trim()) {
      await settleOrRelease({ record: seeded });
      seeded.phase = "provider_failed";
      seeded.terminal = true;
      options.attempts.save(seeded);
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "provider_failed",
        publicMessage: "providerJobId vide après submit.",
        enqueueNext: [],
      };
    }

    seeded.providerJobId = submission.providerJobId;
    seeded.phase = "submitted";
    options.attempts.save(seeded);
    // Close admission + new submit; retain poll-only for this providerJobId.
    options.lifecycle?.onSubmitPersisted(seeded.attemptId);

    emit(options.events, {
      type: "motion.submit.accepted",
      correlationId: context.correlationId,
      projectId: job.projectId,
      runId: job.runId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      providerId: job.providerId,
      modelId: job.modelId,
      adapterVersion,
      providerJobIdFingerprint: fingerprintProviderJobId(submission.providerJobId),
      phase: "submitted",
    });

    const pollAfter = nextPollDelayMs(defaultPollAfterMs, 0);
    const availableAt = new Date(
      Date.parse(context.nowIso()) + pollAfter,
    ).toISOString();

    emit(options.events, {
      type: "motion.poll.scheduled",
      correlationId: context.correlationId,
      projectId: job.projectId,
      runId: job.runId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      providerJobIdFingerprint: fingerprintProviderJobId(submission.providerJobId),
      pollCount: 0,
      phase: "polling",
    });

    return {
      status: "reschedule",
      runId: job.runId,
      availableAt,
      payloadRef: payloadFrom(
        job,
        {
          phase: "polling",
          reservationId: seeded.reservationId,
          reservedMinor: seeded.reserved.amountMinor,
          currency: seeded.reserved.currency,
          estimateMinor: seeded.estimate.estimatedCostMinor,
          adapterVersion,
          pricingVersion,
          pollCount: 0,
          submitIntentAt: seeded.submitIntentAt,
          requestFingerprint: seeded.requestFingerprint,
          providerJobIdFingerprint: fingerprintProviderJobId(
            submission.providerJobId,
          ),
          humanReviewPolicyPresent: true,
        },
        "poll",
        submission.providerJobId,
        pollAfter,
      ),
      enqueueNext: [],
    };
  }

  async function handlePoll(
    job: ClaimedProductionJob,
    context: ProductionExecutionContext,
  ): Promise<ProcessClaimedJobOutcome> {
    const record = options.attempts.get(job.attemptId);
    if (!record) {
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "motion_attempt_missing",
        publicMessage: "Attempt introuvable pour poll.",
        enqueueNext: [],
      };
    }

    if (record.terminal && record.phase === "qc_pending") {
      return { status: "already_done", runId: job.runId, enqueueNext: [] };
    }
    if (record.terminal && record.lateQuarantined) {
      emit(options.events, {
        type: "motion.late_result",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        phase: "late_quarantined",
        status: "ignored",
      });
      return { status: "already_done", runId: job.runId, enqueueNext: [] };
    }
    if (record.terminal) {
      return { status: "already_done", runId: job.runId, enqueueNext: [] };
    }

    if (record.phase === "submission_unknown") {
      return {
        status: "needs_review",
        runId: job.runId,
        publicMessage: "submission_unknown — poll sans providerJobId durable interdit.",
      };
    }

    const providerJobId =
      record.providerJobId ?? job.payload.externalJobId;
    if (!providerJobId?.trim()) {
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "provider_job_not_found",
        publicMessage: "providerJobId requis pour poll — pas de resubmit.",
        enqueueNext: [],
      };
    }

    const pollPermission = options.lifecycle?.evaluatePoll({
      providerJobId,
      submitCount: record.submitCount,
      phase: record.phase,
    });
    if (pollPermission && !pollPermission.allowed) {
      return {
        status: "blocked_by_kill_switch",
        runId: job.runId,
        publicMessage: pollPermission.reason,
      };
    }

    // Absolute rule: poll never submits
    const submitBefore = record.submitCount;
    record.pollCount += 1;
    record.phase = "polling";
    options.attempts.save(record);

    if (record.pollCount > maxPolls) {
      await settleOrRelease({ record, usageUnknown: true });
      record.phase = "timed_out";
      record.terminal = true;
      options.attempts.save(record);
      emit(options.events, {
        type: "motion.provider.failed",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        status: "timed_out",
        pollCount: record.pollCount,
        phase: "timed_out",
      });
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "provider_timeout",
        publicMessage: "Timeout poll Motion Transfer — usage inconnu, réconciliation.",
        enqueueNext: [],
      };
    }

    if (
      record.deadlineAt &&
      Date.parse(record.deadlineAt) <= Date.parse(context.nowIso())
    ) {
      await settleOrRelease({ record, usageUnknown: true });
      record.phase = "timed_out";
      record.terminal = true;
      options.attempts.save(record);
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "provider_timeout",
        publicMessage: "Deadline globale Motion Transfer dépassée.",
        enqueueNext: [],
      };
    }

    const providerCtx = buildProviderContext(job, context, record.deadlineAt);
    let status;
    try {
      status = await options.provider.poll(
        { providerJobId },
        providerCtx,
      );
    } catch (err) {
      const code = isMotionTransferDomainError(err)
        ? err.code
        : "provider_failed";
      if (code === "provider_status_unknown") {
        await settleOrRelease({ record, usageUnknown: true });
        record.phase = "provider_failed";
        record.terminal = true;
        record.reconciliationRequired = true;
        options.attempts.save(record);
        return {
          status: "failed",
          runId: job.runId,
          errorCode: code,
          publicMessage: "Statut provider inconnu — fail-closed.",
          enqueueNext: [],
        };
      }
      if (
        code === "provider_rate_limited" ||
        code === "provider_unavailable" ||
        code === "provider_timeout"
      ) {
        // bounded backoff reschedule — still no resubmit
        const delay = nextPollDelayMs(defaultPollAfterMs, record.pollCount);
        return {
          status: "reschedule",
          runId: job.runId,
          availableAt: new Date(
            Date.parse(context.nowIso()) + delay,
          ).toISOString(),
          payloadRef: payloadFrom(
            job,
            {
              phase: "polling",
              reservationId: record.reservationId,
              reservedMinor: record.reserved.amountMinor,
              currency: record.reserved.currency,
              estimateMinor: record.estimate.estimatedCostMinor,
              adapterVersion,
              pollCount: record.pollCount,
              providerJobIdFingerprint: fingerprintProviderJobId(providerJobId),
              requestFingerprint: record.requestFingerprint,
              humanReviewPolicyPresent: true,
            },
            "poll",
            providerJobId,
            delay,
          ),
          enqueueNext: [],
        };
      }
      await settleOrRelease({ record });
      record.phase = "provider_failed";
      record.terminal = true;
      options.attempts.save(record);
      return {
        status: "failed",
        runId: job.runId,
        errorCode: code,
        publicMessage: isMotionTransferDomainError(err)
          ? err.publicMessage
          : "Échec poll Motion Transfer.",
        enqueueNext: [],
      };
    }

    if (record.submitCount !== submitBefore || record.resubmitCount !== 0) {
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "motion_resubmit_detected",
        publicMessage: "Resubmit détecté pendant poll — interdit.",
        enqueueNext: [],
      };
    }

    emit(options.events, {
      type: "motion.poll.status",
      correlationId: context.correlationId,
      projectId: job.projectId,
      runId: job.runId,
      jobId: job.jobId,
      attemptId: job.attemptId,
      providerJobIdFingerprint: fingerprintProviderJobId(providerJobId),
      status: status.status,
      pollCount: record.pollCount,
      phase: "polling",
    });

    if (status.status === "queued" || status.status === "processing") {
      const delay = nextPollDelayMs(defaultPollAfterMs, record.pollCount);
      return {
        status: "reschedule",
        runId: job.runId,
        availableAt: new Date(
          Date.parse(context.nowIso()) + delay,
        ).toISOString(),
        payloadRef: payloadFrom(
          job,
          {
            phase: "polling",
            reservationId: record.reservationId,
            reservedMinor: record.reserved.amountMinor,
            currency: record.reserved.currency,
            estimateMinor: record.estimate.estimatedCostMinor,
            adapterVersion,
            pollCount: record.pollCount,
            providerJobIdFingerprint: fingerprintProviderJobId(providerJobId),
            requestFingerprint: record.requestFingerprint,
            humanReviewPolicyPresent: true,
          },
          "poll",
          providerJobId,
          delay,
        ),
        enqueueNext: [],
      };
    }

    if (status.status === "failed" || status.status === "timed_out") {
      const usageKnown =
        status.actualCostMinor != null || status.usage?.durationSeconds != null;
      if (usageKnown && status.actualCostMinor != null) {
        await settleOrRelease({
          record,
          actualCost: money(status.actualCostMinor, "USD"),
        });
      } else if (usageKnown && status.usage?.durationSeconds != null) {
        // derive from estimate unit if needed — prefer actualCostMinor
        await settleOrRelease({
          record,
          actualCost: money(
            Math.min(
              record.reserved.amountMinor,
              Math.ceil(status.usage.durationSeconds * 17),
            ),
            "USD",
          ),
        });
      } else {
        await settleOrRelease({ record, usageUnknown: true });
      }
      record.phase =
        status.status === "timed_out" ? "timed_out" : "provider_failed";
      record.terminal = true;
      options.attempts.save(record);
      emit(options.events, {
        type: "motion.provider.failed",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        status: status.status,
        phase: record.phase,
      });
      return {
        status: "failed",
        runId: job.runId,
        errorCode: status.errorCode ?? "provider_failed",
        publicMessage: "Provider Motion Transfer terminal failure.",
        enqueueNext: [],
      };
    }

    if (status.status === "completed") {
      if (!status.output) {
        await settleOrRelease({ record, usageUnknown: true });
        record.phase = "provider_failed";
        record.terminal = true;
        options.attempts.save(record);
        return {
          status: "failed",
          runId: job.runId,
          errorCode: "provider_output_invalid",
          publicMessage: "Descriptor de sortie absent.",
          enqueueNext: [],
        };
      }
      try {
        assertProviderOutputDescriptorSafe(status.output);
      } catch {
        await settleOrRelease({ record, usageUnknown: true });
        record.phase = "provider_failed";
        record.terminal = true;
        options.attempts.save(record);
        return {
          status: "failed",
          runId: job.runId,
          errorCode: "provider_output_invalid",
          publicMessage: "Descriptor de sortie invalide.",
          enqueueNext: [],
        };
      }

      const actual =
        status.actualCostMinor != null
          ? money(status.actualCostMinor, status.currency ?? "USD")
          : money(record.estimate.estimatedCostMinor, "USD");

      await settleOrRelease({ record, actualCost: actual });
      record.phase = "qc_pending";
      record.outputRef = status.output.providerOutputRef;
      record.terminal = true;
      options.attempts.save(record);

      emit(options.events, {
        type: "motion.provider.completed",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        providerJobIdFingerprint: fingerprintProviderJobId(providerJobId),
        costMinor: actual.amountMinor,
        usageSeconds: status.usage?.durationSeconds,
        phase: "provider_completed",
      });
      emit(options.events, {
        type: "motion.ledger.reconciled",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        costMinor: actual.amountMinor,
        status: "committed",
      });
      emit(options.events, {
        type: "motion.qc.pending",
        correlationId: context.correlationId,
        projectId: job.projectId,
        runId: job.runId,
        jobId: job.jobId,
        attemptId: job.attemptId,
        phase: "qc_pending",
        status: "handoff",
      });

      // Terminal success for queue — handoff QC pending (no final asset / approval / merge)
      return {
        status: "needs_review",
        runId: job.runId,
        publicMessage:
          "Motion Transfer provider completed — QC pending (pas d'approval/merge/export).",
      };
    }

    if (status.status === "cancelled") {
      await settleOrRelease({ record, usageUnknown: true });
      record.phase = "provider_failed";
      record.terminal = true;
      options.attempts.save(record);
      return {
        status: "failed",
        runId: job.runId,
        errorCode: "provider_cancel_unsupported",
        publicMessage: "Cancel Motion Transfer non supporté / terminal cancelled.",
        enqueueNext: [],
      };
    }

    await settleOrRelease({ record, usageUnknown: true });
    record.phase = "provider_failed";
    record.terminal = true;
    options.attempts.save(record);
    return {
      status: "failed",
      runId: job.runId,
      errorCode: "provider_status_unknown",
      publicMessage: "Statut poll non géré.",
      enqueueNext: [],
    };
  }

  return {
    async processClaimedJob(job, _lease, context) {
      if (job.action !== "motion_transfer") {
        return {
          status: "failed",
          runId: job.runId,
          errorCode: "motion_action_mismatch",
          publicMessage: "Orchestrateur Motion appelé hors action motion_transfer.",
          enqueueNext: [],
        };
      }

      if (
        options.allowedProjectIds &&
        options.allowedProjectIds.length > 0 &&
        !options.allowedProjectIds.includes(job.projectId)
      ) {
        return {
          status: "failed",
          runId: job.runId,
          errorCode: "motion_scope_forbidden",
          publicMessage: "Job Motion hors périmètre projet autorisé.",
          enqueueNext: [],
        };
      }

      const mode = job.payload.mode ?? "execute";
      if (mode === "cancel") {
        const record = options.attempts.get(job.attemptId);
        if (record && !record.terminal) {
          // cancel unsupported at provider — mark terminal timeout path / late expected
          if (options.provider.cancel) {
            const ctx = buildProviderContext(job, context, record.deadlineAt);
            const cancelResult = await options.provider.cancel(
              {
                providerJobId:
                  record.providerJobId ?? job.payload.externalJobId ?? "",
              },
              ctx,
            );
            if (cancelResult.status === "cancel_unsupported") {
              record.phase = "timed_out";
              record.terminal = true;
              record.lateQuarantined = false;
              options.attempts.save(record);
              await settleOrRelease({ record, usageUnknown: true });
              return {
                status: "failed",
                runId: job.runId,
                errorCode: "provider_cancel_unsupported",
                publicMessage:
                  "Cancel unsupported — late result attendu / quarantaine future.",
                enqueueNext: [],
              };
            }
          }
        }
        return {
          status: "failed",
          runId: job.runId,
          errorCode: "provider_cancel_unsupported",
          publicMessage: "Cancel Motion Transfer non supporté.",
          enqueueNext: [],
        };
      }

      if (mode === "poll") {
        return handlePoll(job, context);
      }
      return handleExecute(job, context);
    },
  };
}

/** Seed an attempt before enqueue/claim (tests / future enqueue path). */
export function seedMotionTransferAttempt(
  store: MotionTransferAttemptStore,
  input: {
    attemptId: string;
    jobId: string;
    runId: string;
    reservationId: string;
    reservedMinor: number;
    estimate: MotionTransferEstimate;
    motionInput: MotionTransferInput;
    mediaBoundary: MotionTransferProviderMediaBoundary;
    deadlineAt?: string;
    adapterVersion?: string;
  },
): MotionTransferAttemptRecord {
  const record: MotionTransferAttemptRecord = {
    attemptId: input.attemptId,
    jobId: input.jobId,
    runId: input.runId,
    reservationId: input.reservationId,
    reserved: money(input.reservedMinor, "USD"),
    estimate: input.estimate,
    submitCount: 0,
    pollCount: 0,
    resubmitCount: 0,
    phase: "submitting",
    terminal: false,
    ledgerSettled: false,
    lateQuarantined: false,
    usageUnknown: false,
    reconciliationRequired: false,
    requestFingerprint: requestFingerprint({
      attemptId: input.attemptId,
      idempotencyKey: `mt:${input.runId}:${input.attemptId}`,
      modelId: input.estimate.modelId ?? "unknown",
    }),
    adapterVersion:
      input.adapterVersion ?? FAL_KLING_MOTION_CONTROL_ADAPTER_VERSION,
    mediaBoundary: input.mediaBoundary,
    motionInput: input.motionInput,
    deadlineAt: input.deadlineAt,
  };
  store.save(record);
  return record;
}

/** Mark a late provider result after terminal timeout/cancel — never reopens run. */
export function quarantineMotionLateResult(
  store: MotionTransferAttemptStore,
  attemptId: string,
): boolean {
  const record = store.get(attemptId);
  if (!record || !record.terminal) return false;
  record.lateQuarantined = true;
  record.phase = "late_quarantined";
  store.save(record);
  return true;
}

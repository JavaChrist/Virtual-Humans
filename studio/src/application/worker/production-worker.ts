/**
 * Bounded Production Worker — claim / delegate / complete (VHS-114).
 * Never owns scheduling, budget, fallback, or model selection.
 */

import type { JobQueuePort } from "@/application/production/enqueue";
import type {
  ProductionDirector,
  ProductionExecutionContext,
} from "@/application/production/production-director";
import type { FeatureFlagsSnapshot } from "@/infrastructure/config/feature-flags";
import { processClaimedJobForWorker } from "./claimed-job-processor";
import { dispatchEnqueueCommands } from "./dispatcher";
import type { WorkerPolicy } from "./policy";
import { validateWorkerPolicy } from "./policy";
import {
  emptyWorkerResult,
  type WorkerEventSink,
  type WorkerIssue,
  type WorkerRunResult,
} from "./result";
import { runWorkerDryRun, type WorkerDryRunResult } from "./dry-run";
import type { GenerationEngine } from "@/application/generation";
import type { ProductionPorts } from "@/application/production/ports";
import type { MotionTransferWorkerProcessor } from "@/application/motion/motion-transfer-worker-orchestrator";

export type WorkerExecutionContext = {
  correlationId: string;
  actorId: string;
  nowIso: () => string;
  nowMs: () => number;
  nextId: () => string;
  signal?: AbortSignal;
  /** Force dry-run path (no claim). */
  dryRun?: boolean;
};

export type ProductionWorkerDependencies = {
  policy: WorkerPolicy;
  flags: FeatureFlagsSnapshot;
  queue: JobQueuePort;
  director: ProductionDirector;
  engine: GenerationEngine;
  ports: ProductionPorts;
  events?: WorkerEventSink;
  /** MT-008 — Motion Transfer branch (absent ⇒ motion jobs fail-closed). */
  motionTransfer?: MotionTransferWorkerProcessor;
};

export interface ProductionWorker {
  runOnce(context: WorkerExecutionContext): Promise<WorkerRunResult>;
  dryRun(context: WorkerExecutionContext): WorkerDryRunResult;
}

export function createProductionWorker(
  deps: ProductionWorkerDependencies
): ProductionWorker {
  const policy = validateWorkerPolicy(deps.policy);
  const emit = (e: Parameters<NonNullable<WorkerEventSink["emit"]>>[0]) => {
    void deps.events?.emit(e);
  };

  return {
    dryRun() {
      return runWorkerDryRun({
        policy,
        flags: deps.flags,
        queue: deps.queue,
        director: deps.director,
        engine: deps.engine,
        ports: deps.ports,
        requireDurableIdempotency: true,
        hasPeekOrFixture: false,
      });
    },

    async runOnce(context) {
      const started = context.nowMs();
      const workerId = policy.workerId;

      emit({
        type: "worker.run.started",
        workerId,
        correlationId: context.correlationId,
      });

      if (!deps.flags.directorV2Worker) {
        emit({
          type: "worker.run.disabled",
          workerId,
          correlationId: context.correlationId,
        });
        const result = emptyWorkerResult(workerId, "disabled", context.nowMs() - started, [
          {
            code: "worker_disabled",
            publicMessage: "DIRECTOR_V2_WORKER_ENABLED off — aucun claim.",
          },
        ]);
        emit({
          type: "worker.run.completed",
          workerId,
          correlationId: context.correlationId,
          status: result.status,
          claimed: 0,
          processed: 0,
          completed: 0,
          rescheduled: 0,
          failed: 0,
          leaseLost: 0,
          providerCalls: 0,
          durationMs: result.durationMs,
        });
        return result;
      }

      if (context.dryRun || !deps.flags.directorV2PaidGeneration) {
        const dry = runWorkerDryRun({
          policy,
          flags: deps.flags,
          queue: deps.queue,
          director: deps.director,
          engine: deps.engine,
          ports: deps.ports,
          requireDurableIdempotency: true,
          hasPeekOrFixture: false,
        });
        const issues: WorkerIssue[] = dry.validations
          .filter((v) => !v.passed)
          .map((v) => ({
            code: "dry_run_issue" as const,
            publicMessage: v.message,
          }));
        if (!deps.flags.directorV2PaidGeneration) {
          issues.push({
            code: "paid_generation_disabled",
            publicMessage:
              "DIRECTOR_V2_PAID_GENERATION_ENABLED off — validation uniquement, aucun provider.",
          });
        }
        const result: WorkerRunResult = {
          ...emptyWorkerResult(workerId, "dry_run", context.nowMs() - started, issues),
        };
        emit({
          type: "worker.run.completed",
          workerId,
          correlationId: context.correlationId,
          status: result.status,
          claimed: 0,
          processed: 0,
          completed: 0,
          rescheduled: 0,
          failed: 0,
          leaseLost: 0,
          providerCalls: 0,
          durationMs: result.durationMs,
        });
        return result;
      }

      // Both flags on — bounded claim + process
      let claimed = 0;
      let processed = 0;
      let completed = 0;
      let rescheduled = 0;
      let failed = 0;
      let leaseLost = 0;
      let providerCalls = 0;
      const issues: WorkerIssue[] = [];

      let jobs;
      try {
        jobs = await deps.queue.claim(
          workerId,
          policy.claimLimit,
          policy.leaseSeconds
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Claim failed";
        const result = emptyWorkerResult(workerId, "failed", context.nowMs() - started, [
          { code: "claim_failed", publicMessage: msg },
        ]);
        emit({
          type: "worker.run.completed",
          workerId,
          correlationId: context.correlationId,
          status: "failed",
          claimed: 0,
          processed: 0,
          completed: 0,
          rescheduled: 0,
          failed: 0,
          leaseLost: 0,
          providerCalls: 0,
          durationMs: result.durationMs,
        });
        return result;
      }

      claimed = jobs.length;
      emit({
        type: "worker.jobs.claimed",
        workerId,
        correlationId: context.correlationId,
        count: claimed,
      });

      const execCtx: ProductionExecutionContext = {
        correlationId: context.correlationId,
        actorId: context.actorId,
        nowIso: context.nowIso,
        nextId: context.nextId,
        signal: context.signal,
        paidGenerationEnabled: true,
        maxActionsPerAdvance: 2,
      };

      const deadline = started + policy.maximumRunDurationMs;
      const toProcess = jobs.slice(0, policy.maximumJobsPerRun);

      for (const job of toProcess) {
        if (context.signal?.aborted) break;
        if (context.nowMs() >= deadline) {
          issues.push({
            code: "timeout",
            publicMessage: "Durée maximale du run atteinte — arrêt propre.",
          });
          // Release remaining without processing
          break;
        }
        if (providerCalls >= policy.maximumProviderCallsPerRun) {
          issues.push({
            code: "provider_budget_exhausted",
            publicMessage: "Budget d'appels provider du run épuisé.",
          });
          break;
        }

        emit({
          type: "worker.job.started",
          workerId,
          correlationId: context.correlationId,
          jobId: job.jobId,
          runId: job.runId,
          projectId: job.projectId,
        });

        const pr = await processClaimedJobForWorker(
          job,
          {
            director: deps.director,
            queue: deps.queue,
            nowIso: context.nowIso,
            nowMs: context.nowMs,
            motionTransfer: deps.motionTransfer,
          },
          execCtx,
          policy.leaseSeconds
        );

        processed += 1;
        if (pr.providerCalled) providerCalls += 1;
        issues.push(...pr.issues);

        switch (pr.outcome) {
          case "completed":
          case "already_done":
          case "needs_review":
          case "cancelled_run":
            completed += 1;
            emit({
              type: "worker.job.completed",
              workerId,
              correlationId: context.correlationId,
              jobId: job.jobId,
              runId: job.runId,
            });
            break;
          case "reschedule":
            rescheduled += 1;
            emit({
              type: "worker.job.rescheduled",
              workerId,
              correlationId: context.correlationId,
              jobId: job.jobId,
              runId: job.runId,
            });
            break;
          case "lease_lost":
            leaseLost += 1;
            emit({
              type: "worker.job.lease_lost",
              workerId,
              correlationId: context.correlationId,
              jobId: job.jobId,
            });
            break;
          case "failed":
          case "blocked_by_kill_switch":
            failed += 1;
            emit({
              type: "worker.job.failed",
              workerId,
              correlationId: context.correlationId,
              jobId: job.jobId,
              runId: job.runId,
              errorCode: pr.outcome,
            });
            break;
        }

        // MT-008 — motion jobs do not use ProductionDirector planEnqueue; stop after one.
        if (job.action === "motion_transfer") {
          break;
        }

        // After progress: enqueue next ready steps (finalize is handled inside PD).
        if (
          pr.outcome === "completed" ||
          pr.outcome === "already_done" ||
          pr.outcome === "failed"
        ) {
          try {
            const planned = await deps.director.planEnqueueCommands(
              job.runId,
              execCtx
            );
            const dispatched = await dispatchEnqueueCommands(
              deps.queue,
              planned.commands,
            );
            if (dispatched.errors.length > 0) {
              issues.push({
                code: "job_failed",
                publicMessage: dispatched.errors[0]!.publicMessage,
                jobId: job.jobId,
                runId: job.runId,
                projectId: job.projectId,
              });
            }
          } catch (e) {
            issues.push({
              code: "job_failed",
              publicMessage:
                e instanceof Error ? e.message : "Suivi enqueue impossible.",
              jobId: job.jobId,
              runId: job.runId,
              projectId: job.projectId,
            });
          }
        }
      }

      const durationMs = context.nowMs() - started;
      let status: WorkerRunResult["status"] = "completed";
      if (failed > 0 && completed === 0 && rescheduled === 0) status = "failed";
      else if (failed > 0 || leaseLost > 0 || issues.some((i) => i.code === "timeout"))
        status = "partial";
      else if (claimed === 0) status = "completed";

      const result: WorkerRunResult = {
        status,
        workerId,
        claimed,
        processed,
        completed,
        rescheduled,
        failed,
        leaseLost,
        providerCalls,
        durationMs,
        issues,
      };

      emit({
        type: "worker.run.completed",
        workerId,
        correlationId: context.correlationId,
        status: result.status,
        claimed,
        processed,
        completed,
        rescheduled,
        failed,
        leaseLost,
        providerCalls,
        durationMs,
      });

      return result;
    },
  };
}

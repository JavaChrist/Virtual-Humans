/**
 * Claimed job processor — delegates business logic to Production Director (VHS-114).
 * Does not decide scheduling, model, fallback, budget, or retryability.
 */

import type {
  ClaimedProductionJob,
  JobQueuePort,
  ProcessClaimedJobOutcome,
} from "@/application/production/enqueue";
import type {
  ProductionDirector,
  ProductionExecutionContext,
} from "@/application/production/production-director";
import type { MotionTransferWorkerProcessor } from "@/application/motion/motion-transfer-worker-orchestrator";
import { assertLeaseOwnership, buildLeaseContext } from "./lease-guard";
import { dispatchEnqueueCommands } from "./dispatcher";
import { LeaseLostError } from "./errors";
import type { WorkerIssue } from "./result";

export type ProcessJobDeps = {
  director: ProductionDirector;
  queue: JobQueuePort;
  nowIso: () => string;
  nowMs: () => number;
  /** MT-008 — optional Motion Transfer orchestrator (canonical worker branch). */
  motionTransfer?: MotionTransferWorkerProcessor;
};

export type ProcessJobResult = {
  outcome: ProcessClaimedJobOutcome["status"] | "lease_lost";
  providerCalled: boolean;
  issues: WorkerIssue[];
};

function leaseExpiresAt(leaseSeconds: number, nowIso: string): string {
  return new Date(Date.parse(nowIso) + leaseSeconds * 1000).toISOString();
}

/**
 * Process one claimed job end-to-end for the worker.
 */
export async function processClaimedJobForWorker(
  job: ClaimedProductionJob,
  deps: ProcessJobDeps,
  context: ProductionExecutionContext,
  leaseSeconds: number
): Promise<ProcessJobResult> {
  const issues: WorkerIssue[] = [];
  const lease = buildLeaseContext(
    job,
    deps.nowIso(),
    leaseExpiresAt(leaseSeconds, deps.nowIso())
  );

  const guard = assertLeaseOwnership({
    job,
    lease,
    workerId: lease.workerId,
    nowMs: deps.nowMs,
  });
  if (!guard.ok) {
    return {
      outcome: "lease_lost",
      providerCalled: false,
      issues: [
        {
          code: "lease_lost",
          publicMessage: `Lease invalide (${guard.reason}).`,
          jobId: job.jobId,
          runId: job.runId,
          projectId: job.projectId,
        },
      ],
    };
  }

  let outcome: ProcessClaimedJobOutcome;
  try {
    if (job.action === "motion_transfer") {
      if (!deps.motionTransfer) {
        outcome = {
          status: "failed",
          runId: job.runId,
          errorCode: "motion_capability_unavailable",
          publicMessage:
            "Motion Transfer worker orchestrator absent — runtime unavailable.",
          enqueueNext: [],
        };
      } else {
        outcome = await deps.motionTransfer.processClaimedJob(
          job,
          lease,
          context,
        );
      }
    } else {
      outcome = await deps.director.processClaimedJob(job, lease, context);
    }
  } catch (e) {
    if (e instanceof LeaseLostError) {
      return {
        outcome: "lease_lost",
        providerCalled: false,
        issues: [
          {
            code: "lease_lost",
            publicMessage: e.publicMessage,
            jobId: job.jobId,
            runId: job.runId,
          },
        ],
      };
    }
    const msg = e instanceof Error ? e.message : "Erreur traitement job.";
    try {
      await deps.queue.fail(job.jobId, job.leaseToken, job.leasedBy, {
        code: "job_processing_failed",
        publicMessage: msg,
      });
    } catch {
      // lease may be lost — do not force
    }
    return {
      outcome: "failed",
      providerCalled: false,
      issues: [
        {
          code: "job_failed",
          publicMessage: msg,
          jobId: job.jobId,
          runId: job.runId,
        },
      ],
    };
  }

  const providerCalled =
    outcome.status === "completed" ||
    outcome.status === "reschedule" ||
    outcome.status === "failed" ||
    outcome.status === "needs_review";

  // Re-check lease before queue mutation
  const guard2 = assertLeaseOwnership({
    job,
    lease,
    workerId: lease.workerId,
    nowMs: deps.nowMs,
  });
  if (!guard2.ok) {
    return {
      outcome: "lease_lost",
      providerCalled,
      issues: [
        {
          code: "lease_lost",
          publicMessage: "Lease perdu avant completion.",
          jobId: job.jobId,
          runId: job.runId,
        },
      ],
    };
  }

  try {
    switch (outcome.status) {
      case "completed":
      case "already_done": {
        await deps.queue.complete(job.jobId, job.leaseToken, job.leasedBy, {
          status: outcome.status,
          runId: outcome.runId,
        });
        await dispatchEnqueueCommands(deps.queue, outcome.enqueueNext);
        break;
      }
      case "reschedule": {
        await deps.queue.reschedule(
          job.jobId,
          job.leaseToken,
          job.leasedBy,
          outcome.availableAt,
          outcome.payloadRef
        );
        await dispatchEnqueueCommands(deps.queue, outcome.enqueueNext);
        break;
      }
      case "failed": {
        await deps.queue.fail(job.jobId, job.leaseToken, job.leasedBy, {
          code: outcome.errorCode,
          publicMessage: outcome.publicMessage,
        });
        await dispatchEnqueueCommands(deps.queue, outcome.enqueueNext);
        issues.push({
          code: "job_failed",
          publicMessage: outcome.publicMessage,
          jobId: job.jobId,
          runId: outcome.runId,
        });
        break;
      }
      case "blocked_by_kill_switch": {
        await deps.queue.release(job.jobId, job.leaseToken, job.leasedBy);
        issues.push({
          code: "blocked_by_kill_switch",
          publicMessage: outcome.publicMessage,
          jobId: job.jobId,
          runId: outcome.runId,
        });
        break;
      }
      case "lease_lost": {
        issues.push({
          code: "lease_lost",
          publicMessage: outcome.publicMessage,
          jobId: job.jobId,
        });
        break;
      }
      case "cancelled_run": {
        await deps.queue.complete(job.jobId, job.leaseToken, job.leasedBy, {
          status: "cancelled_run",
          runId: outcome.runId,
        });
        issues.push({
          code: "cancelled_run",
          publicMessage: outcome.publicMessage,
          jobId: job.jobId,
          runId: outcome.runId,
        });
        break;
      }
      case "needs_review": {
        await deps.queue.complete(job.jobId, job.leaseToken, job.leasedBy, {
          status: "needs_review",
          runId: outcome.runId,
        });
        issues.push({
          code: "needs_review",
          publicMessage: outcome.publicMessage,
          jobId: job.jobId,
          runId: outcome.runId,
        });
        break;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Queue mutation failed";
    if (/lease|token|ownership|not_found/i.test(msg)) {
      return {
        outcome: "lease_lost",
        providerCalled,
        issues: [
          {
            code: "lease_lost",
            publicMessage: "Lease perdu lors de la finalisation.",
            jobId: job.jobId,
            runId: job.runId,
          },
        ],
      };
    }
    throw e;
  }

  return {
    outcome: outcome.status,
    providerCalled:
      context.paidGenerationEnabled !== false &&
      (outcome.status === "completed" ||
        outcome.status === "reschedule" ||
        (outcome.status === "failed" && providerCalled)),
    issues,
  };
}

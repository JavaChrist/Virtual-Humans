/**
 * Adapt Supabase ProductionJobQueue → JobQueuePort (VHS-114).
 */

import type {
  ClaimedProductionJob,
  EnqueueProductionJobCommand,
  JobQueuePort,
  ProductionPayloadReference,
} from "@/application/production/enqueue";
import type { ProductionJobQueue, ProductionJobRecord } from "@/infrastructure/db/queue/production-job-queue";

function parseMotionMeta(
  raw: unknown,
): ProductionPayloadReference["motion"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  if (typeof m.phase !== "string") return undefined;
  return m as NonNullable<ProductionPayloadReference["motion"]>;
}

function parsePayload(raw: unknown): ProductionPayloadReference {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode =
    p.mode === "poll" ||
    p.mode === "cancel" ||
    p.mode === "execute" ||
    p.mode === "drain"
      ? p.mode
      : "execute";
  return {
    planRevisionId: String(p.planRevisionId ?? ""),
    scenePackageSceneId: String(p.scenePackageSceneId ?? ""),
    mode,
    externalJobId:
      typeof p.externalJobId === "string" ? p.externalJobId : undefined,
    pollAfterMs: typeof p.pollAfterMs === "number" ? p.pollAfterMs : undefined,
    // MT-013K-DURABILITY — retain motion authority across claim/cold start.
    motion: parseMotionMeta(p.motion),
  };
}

function toClaimed(job: ProductionJobRecord): ClaimedProductionJob {
  if (!job.leaseToken || !job.leasedBy) {
    throw new Error("Claimed job missing lease.");
  }
  return {
    jobId: job.id,
    workspaceId: job.workspaceId,
    projectId: job.projectId,
    runId: job.runId,
    sceneId: job.sceneId,
    stepId: job.stepId,
    attemptId: job.attemptId,
    action: job.action,
    providerId: job.providerId,
    modelId: job.modelId,
    leaseToken: job.leaseToken,
    leasedBy: job.leasedBy,
    payload: parsePayload(job.payload),
  };
}

export function adaptProductionJobQueue(queue: ProductionJobQueue): JobQueuePort {
  return {
    async enqueue(command: EnqueueProductionJobCommand) {
      // production_jobs.id is uuid — uniqueness is (run,scene,step,attempt)
      const id = crypto.randomUUID();
      await queue.enqueue({
        id,
        projectId: command.projectId,
        runId: command.runId,
        sceneId: command.sceneId,
        stepId: command.stepId,
        attemptId: command.attemptId,
        action: command.action,
        providerId: command.providerId,
        modelId: command.modelId,
        priority: command.priority,
        maxAttempts: command.maxAttempts,
        payload: { ...command.payloadRef, availableAt: command.availableAt },
      });
    },

    async claim(workerId, limit, leaseSeconds) {
      const rows = await queue.claim(workerId, limit, leaseSeconds);
      return rows.map(toClaimed);
    },

    async heartbeat(jobId, leaseToken, workerId, leaseSeconds) {
      await queue.heartbeat(jobId, leaseToken, workerId, leaseSeconds);
    },

    async complete(jobId, leaseToken, workerId, result) {
      await queue.complete(jobId, leaseToken, workerId, result);
    },

    async fail(jobId, leaseToken, workerId, error) {
      await queue.fail(jobId, leaseToken, workerId, error);
    },

    async release(jobId, leaseToken, workerId, availableAt) {
      await queue.release(jobId, leaseToken, workerId, availableAt);
    },

    async reschedule(jobId, leaseToken, workerId, availableAt, payload) {
      await queue.reschedule(
        jobId,
        leaseToken,
        workerId,
        availableAt,
        payload as unknown as Record<string, unknown>
      );
    },

    async persistLeasedPayload(jobId, leaseToken, workerId, payload) {
      if (!queue.persistLeasedPayload) {
        throw new Error("persistLeasedPayload_unsupported");
      }
      await queue.persistLeasedPayload(
        jobId,
        leaseToken,
        workerId,
        payload as unknown as Record<string, unknown>,
      );
    },
  };
}

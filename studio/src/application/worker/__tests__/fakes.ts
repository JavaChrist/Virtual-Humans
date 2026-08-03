/**
 * In-memory JobQueuePort — TEST ONLY.
 */

import type {
  ClaimedProductionJob,
  EnqueueProductionJobCommand,
  JobQueuePort,
  ProductionPayloadReference,
} from "@/application/production/enqueue";

export type MemoryJob = {
  id: string;
  projectId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  action: string;
  providerId: string;
  modelId: string;
  status: "queued" | "leased" | "completed" | "failed";
  availableAt: string;
  priority: number;
  payload: ProductionPayloadReference;
  leaseToken: string | null;
  leasedBy: string | null;
  result?: Record<string, unknown>;
  error?: { code: string; publicMessage: string };
};

export function createMemoryJobQueue(nowIso: () => string): JobQueuePort & {
  jobs: Map<string, MemoryJob>;
  claimCount: number;
} {
  const jobs = new Map<string, MemoryJob>();
  let claimCount = 0;
  let seq = 0;

  const key = (j: {
    runId: string;
    sceneId: string;
    stepId: string;
    attemptId: string;
  }) => `${j.runId}|${j.sceneId}|${j.stepId}|${j.attemptId}`;

  const byUnique = new Map<string, string>();

  function requireLease(jobId: string, leaseToken: string, workerId: string) {
    const j = jobs.get(jobId);
    if (!j) throw new Error("job_not_found");
    if (j.leaseToken !== leaseToken || j.leasedBy !== workerId || j.status !== "leased") {
      throw new Error("lease_invalid");
    }
    return j;
  }

  const port: JobQueuePort & { jobs: Map<string, MemoryJob>; claimCount: number } = {
    jobs,
    get claimCount() {
      return claimCount;
    },
    async enqueue(command: EnqueueProductionJobCommand) {
      const u = key(command);
      if (byUnique.has(u)) throw new Error("duplicate unique attempt");
      const id = `job-${++seq}`;
      byUnique.set(u, id);
      jobs.set(id, {
        id,
        projectId: command.projectId,
        runId: command.runId,
        sceneId: command.sceneId,
        stepId: command.stepId,
        attemptId: command.attemptId,
        action: command.action,
        providerId: command.providerId,
        modelId: command.modelId,
        status: "queued",
        availableAt: command.availableAt,
        priority: command.priority ?? 100,
        payload: { ...command.payloadRef },
        leaseToken: null,
        leasedBy: null,
      });
    },

    async claim(workerId, limit) {
      claimCount += 1;
      const now = nowIso();
      const candidates = [...jobs.values()]
        .filter((j) => j.status === "queued" && j.availableAt <= now)
        .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
        .slice(0, limit);

      const claimed: ClaimedProductionJob[] = [];
      for (const j of candidates) {
        const token = `tok-${j.id}-${claimCount}`;
        j.status = "leased";
        j.leaseToken = token;
        j.leasedBy = workerId;
        claimed.push({
          jobId: j.id,
          projectId: j.projectId,
          runId: j.runId,
          sceneId: j.sceneId,
          stepId: j.stepId,
          attemptId: j.attemptId,
          action: j.action,
          providerId: j.providerId,
          modelId: j.modelId,
          leaseToken: token,
          leasedBy: workerId,
          payload: { ...j.payload },
        });
      }
      return claimed;
    },

    async heartbeat(jobId, leaseToken, workerId) {
      requireLease(jobId, leaseToken, workerId);
    },

    async complete(jobId, leaseToken, workerId, result) {
      const j = requireLease(jobId, leaseToken, workerId);
      j.status = "completed";
      j.result = result;
      j.leaseToken = null;
      j.leasedBy = null;
    },

    async fail(jobId, leaseToken, workerId, error) {
      const j = requireLease(jobId, leaseToken, workerId);
      j.status = "failed";
      j.error = error;
      j.leaseToken = null;
      j.leasedBy = null;
    },

    async release(jobId, leaseToken, workerId, availableAt) {
      const j = requireLease(jobId, leaseToken, workerId);
      j.status = "queued";
      j.leaseToken = null;
      j.leasedBy = null;
      if (availableAt) j.availableAt = availableAt;
    },

    async reschedule(jobId, leaseToken, workerId, availableAt, payload) {
      const j = requireLease(jobId, leaseToken, workerId);
      j.status = "queued";
      j.leaseToken = null;
      j.leasedBy = null;
      j.availableAt = availableAt;
      j.payload = { ...payload };
    },
  };

  return port;
}

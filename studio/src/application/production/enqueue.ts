/**
 * Enqueue commands issued by Production Director only (VHS-114).
 * Worker never invents these — it only claims/processes.
 */

export type ProductionJobMode = "execute" | "poll" | "cancel";

/** Durable payload — references only, never full prompts or signed URLs. */
export type ProductionPayloadReference = {
  planRevisionId: string;
  scenePackageSceneId: string;
  mode: ProductionJobMode;
  /** Present when mode is poll/cancel. */
  externalJobId?: string;
  pollAfterMs?: number;
};

export type EnqueueProductionJobCommand = {
  runId: string;
  projectId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  action: string;
  providerId: string;
  modelId: string;
  availableAt: string;
  priority?: number;
  payloadRef: ProductionPayloadReference;
};

export type ClaimedProductionJob = {
  jobId: string;
  workspaceId?: string;
  projectId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  action: string;
  providerId: string;
  modelId: string;
  leaseToken: string;
  leasedBy: string;
  payload: ProductionPayloadReference;
};

export type LeaseContext = {
  workerId: string;
  leaseToken: string;
  leasedAt: string;
  leaseExpiresAt?: string;
};

export type ProcessClaimedJobOutcome =
  | {
      status: "completed";
      runId: string;
      enqueueNext: EnqueueProductionJobCommand[];
    }
  | {
      status: "reschedule";
      runId: string;
      availableAt: string;
      payloadRef: ProductionPayloadReference;
      enqueueNext: EnqueueProductionJobCommand[];
    }
  | {
      status: "failed";
      runId: string;
      errorCode: string;
      publicMessage: string;
      enqueueNext: EnqueueProductionJobCommand[];
    }
  | {
      status: "already_done";
      runId: string;
      enqueueNext: EnqueueProductionJobCommand[];
    }
  | {
      status: "blocked_by_kill_switch";
      runId: string;
      publicMessage: string;
    }
  | {
      status: "lease_lost";
      publicMessage: string;
    }
  | {
      status: "cancelled_run";
      runId: string;
      publicMessage: string;
    }
  | {
      status: "needs_review";
      runId: string;
      publicMessage: string;
    };

export type JobQueuePort = {
  enqueue(command: EnqueueProductionJobCommand): Promise<void>;
  claim(
    workerId: string,
    limit: number,
    leaseSeconds: number
  ): Promise<ClaimedProductionJob[]>;
  heartbeat(
    jobId: string,
    leaseToken: string,
    workerId: string,
    leaseSeconds?: number
  ): Promise<void>;
  complete(
    jobId: string,
    leaseToken: string,
    workerId: string,
    result: Record<string, unknown>
  ): Promise<void>;
  fail(
    jobId: string,
    leaseToken: string,
    workerId: string,
    error: { code: string; publicMessage: string }
  ): Promise<void>;
  release(
    jobId: string,
    leaseToken: string,
    workerId: string,
    availableAt?: string
  ): Promise<void>;
  /**
   * Release lease, set available_at, and update durable payload (e.g. mode → poll).
   * Requires RPC reschedule_production_job (VHS-114 migration).
   */
  reschedule(
    jobId: string,
    leaseToken: string,
    workerId: string,
    availableAt: string,
    payload: ProductionPayloadReference
  ): Promise<void>;
};

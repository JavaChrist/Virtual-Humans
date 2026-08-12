/**
 * Enqueue commands issued by Production Director only (VHS-114).
 * Worker never invents these — it only claims/processes.
 */

export type ProductionJobMode = "execute" | "poll" | "cancel" | "drain";

/**
 * MT-008 / MT-013K — motion lifecycle phases stored in job.payload jsonb (no SQL migration).
 * Queue status remains queued|leased|completed|failed|…
 */
export type MotionTransferWorkerPhase =
  | "submitting"
  | "submitted"
  | "polling"
  | "submission_unknown"
  | "provider_completed"
  | "provider_failed"
  | "timed_out"
  | "qc_pending"
  | "qc_passed"
  | "qc_rejected"
  | "retry_recommended"
  | "late_quarantined";

/** Redacted motion orchestration metadata — never URLs/secrets/media. */
export type MotionTransferJobPayloadMeta = {
  phase: MotionTransferWorkerPhase;
  reservationId?: string;
  reservedMinor?: number;
  currency?: string;
  estimateMinor?: number;
  adapterVersion?: string;
  pricingVersion?: string;
  pollCount?: number;
  /**
   * Durable provider submit counter (max 1 for MV-001 / Motion Transfer paid).
   * Distinct from production_jobs.attempt_count (= worker lease reclaim count).
   */
  submitCount?: number;
  resubmitCount?: number;
  /**
   * MT-013P — resume-capable MotionTransferInput (internal media refs only).
   * Required for cold-start QC; never sufficient for a second submit.
   */
  resumeInput?: import("@/domain/motion").MotionTransferInput;
  submitIntentAt?: string;
  requestFingerprint?: string;
  /** Fingerprint / truncated id — never raw CDN. */
  providerJobIdFingerprint?: string;
  outputRef?: string;
  /** Opaque descriptor fields — never URL. */
  outputMimeType?: string;
  outputSizeBytes?: number;
  outputDurationSeconds?: number;
  outputWidth?: number;
  outputHeight?: number;
  outputFps?: number;
  outputProviderChecksum?: string;
  outputCompletedAt?: string;
  outputLifecycle?: string;
  downloadStatus?: "none" | "intent" | "completed" | "failed";
  downloadChecksum?: string;
  ingestStatus?: "none" | "intent" | "storage_written" | "completed" | "failed";
  ingestedAssetId?: string;
  qualityReportId?: string;
  qcStatus?: "none" | "pending" | "completed" | "failed";
  humanReviewHandoffStatus?: "none" | "seeded" | "failed";
  drainErrorCode?: string;
  lateResult?: boolean;
  lateQuarantined?: boolean;
  reconciliationRequired?: boolean;
  usageUnknown?: boolean;
  /** Alias durable of attempt.ledgerSettled. */
  terminalSettled?: boolean;
  ledgerSettled?: boolean;
  terminal?: boolean;
  deadlineAt?: string;
  humanReviewPolicyPresent?: boolean;
  /** Firm estimate fields for hydrate/settle without memory seed. */
  estimateDurationSeconds?: number;
  estimatePricingVersion?: string;
  estimateModelId?: string;
  estimateProviderId?: string;
};

/** Durable payload — references only, never full prompts or signed URLs. */
export type ProductionPayloadReference = {
  planRevisionId: string;
  scenePackageSceneId: string;
  mode: ProductionJobMode;
  /** Present when mode is poll/cancel. */
  externalJobId?: string;
  pollAfterMs?: number;
  /** MT-008 motion_transfer structured meta (optional). */
  motion?: MotionTransferJobPayloadMeta;
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
  /**
   * Queue lease reclaim budget (production_jobs.max_attempts).
   * For motion_transfer, prefer MOTION_TRANSFER_QUEUE_RECLAIM_MAX_ATTEMPTS —
   * never set to 1 to "limit provider submits" (use payload.motion.submitCount).
   */
  maxAttempts?: number;
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
  /**
   * MT-013K-DURABILITY — update payload while lease held (intent / mid-flight).
   * Does not release the lease. Fail-closed if lease invalid.
   */
  persistLeasedPayload?(
    jobId: string,
    leaseToken: string,
    workerId: string,
    payload: ProductionPayloadReference
  ): Promise<void>;
};

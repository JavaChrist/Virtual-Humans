/**
 * Bounded worker policy (VHS-114).
 * All values injected and strictly validated — no infinite loops.
 */

import { WorkerPolicyError } from "./errors";

export type WorkerPolicy = {
  version: string;
  workerId: string;
  claimLimit: number;
  leaseSeconds: number;
  heartbeatIntervalSeconds: number;
  maximumJobsPerRun: number;
  maximumProviderCallsPerRun: number;
  maximumRunDurationMs: number;
  pollingDelayMs: number;
};

export const WORKER_POLICY_BOUNDS = {
  claimLimit: { min: 1, max: 20 },
  leaseSeconds: { min: 15, max: 300 },
  heartbeatIntervalSeconds: { min: 5, max: 120 },
  maximumJobsPerRun: { min: 1, max: 50 },
  maximumProviderCallsPerRun: { min: 0, max: 50 },
  maximumRunDurationMs: { min: 1_000, max: 120_000 },
  pollingDelayMs: { min: 0, max: 5_000 },
} as const;

/** Default policy — lease > typical bounded provider call; heartbeat optional. */
export const DEFAULT_WORKER_POLICY: Omit<WorkerPolicy, "workerId"> = {
  version: "vhs-114.1",
  claimLimit: 3,
  leaseSeconds: 90,
  heartbeatIntervalSeconds: 30,
  maximumJobsPerRun: 5,
  maximumProviderCallsPerRun: 5,
  maximumRunDurationMs: 25_000,
  pollingDelayMs: 0,
};

function inRange(n: number, min: number, max: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Validate and return a frozen policy. Throws WorkerPolicyError on inconsistency.
 */
export function validateWorkerPolicy(input: WorkerPolicy): WorkerPolicy {
  const workerId = typeof input.workerId === "string" ? input.workerId.trim() : "";
  if (!workerId) {
    throw new WorkerPolicyError("worker_id_empty", "workerId ne peut pas être vide.");
  }
  if (workerId.length > 64) {
    throw new WorkerPolicyError("worker_id_invalid", "workerId trop long (max 64).");
  }
  // No secrets in worker id (heuristic: reject JWT-like / long hex blobs)
  if (workerId.includes(".") && workerId.split(".").length >= 3) {
    throw new WorkerPolicyError(
      "worker_id_invalid",
      "workerId ne doit pas ressembler à un secret/JWT."
    );
  }
  if (!input.version || typeof input.version !== "string") {
    throw new WorkerPolicyError("version_invalid", "version requise.");
  }

  const b = WORKER_POLICY_BOUNDS;
  if (!inRange(input.claimLimit, b.claimLimit.min, b.claimLimit.max)) {
    throw new WorkerPolicyError("claim_limit_out_of_bounds", "claimLimit hors bornes.");
  }
  if (!inRange(input.leaseSeconds, b.leaseSeconds.min, b.leaseSeconds.max)) {
    throw new WorkerPolicyError("lease_out_of_bounds", "leaseSeconds hors bornes.");
  }
  if (
    !inRange(
      input.heartbeatIntervalSeconds,
      b.heartbeatIntervalSeconds.min,
      b.heartbeatIntervalSeconds.max
    )
  ) {
    throw new WorkerPolicyError(
      "heartbeat_out_of_bounds",
      "heartbeatIntervalSeconds hors bornes."
    );
  }
  if (
    !inRange(
      input.maximumJobsPerRun,
      b.maximumJobsPerRun.min,
      b.maximumJobsPerRun.max
    )
  ) {
    throw new WorkerPolicyError(
      "max_jobs_out_of_bounds",
      "maximumJobsPerRun hors bornes."
    );
  }
  if (
    !inRange(
      input.maximumProviderCallsPerRun,
      b.maximumProviderCallsPerRun.min,
      b.maximumProviderCallsPerRun.max
    )
  ) {
    throw new WorkerPolicyError(
      "max_provider_out_of_bounds",
      "maximumProviderCallsPerRun hors bornes."
    );
  }
  if (
    !inRange(
      input.maximumRunDurationMs,
      b.maximumRunDurationMs.min,
      b.maximumRunDurationMs.max
    )
  ) {
    throw new WorkerPolicyError(
      "max_duration_out_of_bounds",
      "maximumRunDurationMs hors bornes."
    );
  }
  if (!inRange(input.pollingDelayMs, b.pollingDelayMs.min, b.pollingDelayMs.max)) {
    throw new WorkerPolicyError(
      "polling_delay_out_of_bounds",
      "pollingDelayMs hors bornes."
    );
  }

  if (input.claimLimit > input.maximumJobsPerRun) {
    throw new WorkerPolicyError(
      "claim_exceeds_max_jobs",
      "claimLimit doit être ≤ maximumJobsPerRun."
    );
  }
  if (input.heartbeatIntervalSeconds >= input.leaseSeconds) {
    throw new WorkerPolicyError(
      "heartbeat_not_below_lease",
      "heartbeatIntervalSeconds doit être strictement inférieur à leaseSeconds."
    );
  }

  return Object.freeze({ ...input, workerId });
}

export function createWorkerPolicy(
  partial: Partial<WorkerPolicy> & { workerId: string }
): WorkerPolicy {
  return validateWorkerPolicy({
    ...DEFAULT_WORKER_POLICY,
    ...partial,
  });
}

/**
 * Whether default ops need concurrent heartbeat.
 * When leaseSeconds covers a single bounded provider call within maximumRunDurationMs,
 * heartbeat during the call is unnecessary — document and skip.
 */
export function needsConcurrentHeartbeat(policy: WorkerPolicy): boolean {
  return policy.leaseSeconds * 1000 < policy.maximumRunDurationMs;
}

export function serializeWorkerPolicy(policy: WorkerPolicy): Record<string, unknown> {
  return {
    version: policy.version,
    workerId: policy.workerId,
    claimLimit: policy.claimLimit,
    leaseSeconds: policy.leaseSeconds,
    heartbeatIntervalSeconds: policy.heartbeatIntervalSeconds,
    maximumJobsPerRun: policy.maximumJobsPerRun,
    maximumProviderCallsPerRun: policy.maximumProviderCallsPerRun,
    maximumRunDurationMs: policy.maximumRunDurationMs,
    pollingDelayMs: policy.pollingDelayMs,
  };
}

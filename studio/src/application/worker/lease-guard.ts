/**
 * Lease ownership checks before any mutation (VHS-114).
 * Lease tokens never appear in logs or public errors.
 */

import type { ClaimedProductionJob, LeaseContext } from "@/application/production/enqueue";
import { LeaseLostError } from "./errors";

export type LeaseGuardInput = {
  job: ClaimedProductionJob;
  lease: LeaseContext;
  workerId: string;
  /** Injected clock for expiry checks. */
  nowMs: () => number;
};

export type LeaseGuardOk = {
  ok: true;
  lease: LeaseContext;
};

export type LeaseGuardFail = {
  ok: false;
  reason: "wrong_worker" | "wrong_token" | "expired" | "missing_token";
};

export type LeaseGuardResult = LeaseGuardOk | LeaseGuardFail;

export function assertLeaseOwnership(input: LeaseGuardInput): LeaseGuardResult {
  const { job, lease, workerId } = input;
  if (!lease.leaseToken || !job.leaseToken) {
    return { ok: false, reason: "missing_token" };
  }
  if (lease.workerId !== workerId || job.leasedBy !== workerId) {
    return { ok: false, reason: "wrong_worker" };
  }
  if (lease.leaseToken !== job.leaseToken) {
    return { ok: false, reason: "wrong_token" };
  }
  if (lease.leaseExpiresAt) {
    const expires = Date.parse(lease.leaseExpiresAt);
    if (Number.isFinite(expires) && input.nowMs() >= expires) {
      return { ok: false, reason: "expired" };
    }
  }
  return { ok: true, lease };
}

export function requireLeaseOwnership(input: LeaseGuardInput): LeaseContext {
  const result = assertLeaseOwnership(input);
  if (!result.ok) {
    throw new LeaseLostError(`Lease invalide (${result.reason}).`);
  }
  return result.lease;
}

export function buildLeaseContext(
  job: ClaimedProductionJob,
  leasedAt: string,
  leaseExpiresAt?: string
): LeaseContext {
  return {
    workerId: job.leasedBy,
    leaseToken: job.leaseToken,
    leasedAt,
    leaseExpiresAt,
  };
}

/** Safe summary for logs — never includes token. */
export function leaseLogFields(job: ClaimedProductionJob): {
  jobId: string;
  workerId: string;
  runId: string;
} {
  return {
    jobId: job.jobId,
    workerId: job.leasedBy,
    runId: job.runId,
  };
}

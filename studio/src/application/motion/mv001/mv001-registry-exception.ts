/**
 * MT-013F — Scoped, expiring Registry exception for MV-001 only.
 * Never elevates Production CapabilityRegistry to SUPPORTED/enabled.
 */

import { deepFreeze } from "@/domain/motion/freeze";
import {
  MV001_BENCHMARK_ID,
  MV001_ENDPOINT_ID,
  MV001_MAX_CALLS,
  MV001_MAX_JOBS,
  MV001_MAX_OUTPUTS,
  MV001_PRIVACY_EXPIRES_AT,
  MV001_PROVIDER_ID,
} from "./mv001-benchmark-profile";

export const MV001_EXCEPTION_SCHEMA_VERSION = "mt013f-mv001-exception-1.0.0" as const;

export type Mv001RegistryException = {
  schemaVersion: typeof MV001_EXCEPTION_SCHEMA_VERSION;
  benchmarkId: typeof MV001_BENCHMARK_ID;
  providerId: typeof MV001_PROVIDER_ID;
  modelId: typeof MV001_ENDPOINT_ID;
  /** Explicit exception — not global registry enablement. */
  exceptionActive: boolean;
  expiresAt: string;
  maxCalls: typeof MV001_MAX_CALLS;
  maxJobs: typeof MV001_MAX_JOBS;
  maxOutputs: typeof MV001_MAX_OUTPUTS;
  note: string;
};

export function createMv001RegistryException(input?: {
  exceptionActive?: boolean;
  expiresAt?: string;
}): Readonly<Mv001RegistryException> {
  return deepFreeze({
    schemaVersion: MV001_EXCEPTION_SCHEMA_VERSION,
    benchmarkId: MV001_BENCHMARK_ID,
    providerId: MV001_PROVIDER_ID,
    modelId: MV001_ENDPOINT_ID,
    exceptionActive: input?.exceptionActive ?? true,
    expiresAt: input?.expiresAt ?? MV001_PRIVACY_EXPIRES_AT,
    maxCalls: MV001_MAX_CALLS,
    maxJobs: MV001_MAX_JOBS,
    maxOutputs: MV001_MAX_OUTPUTS,
    note: "Scoped MV-001 exception only — Production registry profile stays disabled",
  });
}

export function evaluateMv001RegistryException(
  exception: Mv001RegistryException | null | undefined,
  nowIso: string,
): { ok: boolean; reason?: string } {
  if (!exception) return { ok: false, reason: "exception_absent" };
  if (exception.benchmarkId !== MV001_BENCHMARK_ID) {
    return { ok: false, reason: "exception_wrong_benchmark" };
  }
  if (exception.providerId !== MV001_PROVIDER_ID || exception.modelId !== MV001_ENDPOINT_ID) {
    return { ok: false, reason: "exception_wrong_endpoint" };
  }
  if (!exception.exceptionActive) return { ok: false, reason: "exception_inactive" };
  const now = Date.parse(nowIso);
  const exp = Date.parse(exception.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(exp) || exp < now) {
    return { ok: false, reason: "exception_expired" };
  }
  if (exception.maxCalls !== 1 || exception.maxJobs !== 1 || exception.maxOutputs !== 1) {
    return { ok: false, reason: "exception_bounds_invalid" };
  }
  return { ok: true };
}

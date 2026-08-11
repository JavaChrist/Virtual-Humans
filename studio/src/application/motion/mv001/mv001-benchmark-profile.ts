/**
 * MT-013F — MV-001 controlled benchmark profile (prep only).
 * Production registry remains disabled; eligibility is via scoped exception only.
 */

import {
  FAL_KLING_V3_PRO_REGISTRY_MODEL_ID,
  FAL_KLING_V3_PRO_REGISTRY_PROFILE,
  FAL_KLING_V3_PRO_REGISTRY_PROVIDER_ID,
} from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import { estimateFalKlingIndicativeCostMinor } from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-mapping";

export const MV001_BENCHMARK_ID = "MV-001" as const;
export const MV001_PROFILE_SCHEMA_VERSION = "mt013f-mv001-profile-1.0.0" as const;

/** Privacy / exception expiry from AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED (end of day local FR). */
export const MV001_PRIVACY_EXPIRES_AT = "2026-09-10T21:59:59.999Z" as const;

export const MV001_ENDPOINT_ID = FAL_KLING_V3_PRO_REGISTRY_MODEL_ID;
export const MV001_PROVIDER_ID = FAL_KLING_V3_PRO_REGISTRY_PROVIDER_ID;

export const MV001_DURATION_SECONDS = 3 as const;
export const MV001_FIDELITY = "critical" as const;
export const MV001_MAX_CALLS = 1 as const;
export const MV001_MAX_JOBS = 1 as const;
export const MV001_MAX_OUTPUTS = 1 as const;
export const MV001_RESERVATION_MINOR = 62 as const;
export const MV001_ABSOLUTE_CAP_MINOR = 100 as const;
export const MV001_FALLBACKS = 0 as const;
export const MV001_AUTO_RETRY = 0 as const;

export type Mv001BenchmarkProfile = {
  schemaVersion: typeof MV001_PROFILE_SCHEMA_VERSION;
  benchmarkId: typeof MV001_BENCHMARK_ID;
  provider: typeof MV001_PROVIDER_ID;
  model: typeof MV001_ENDPOINT_ID;
  durationSeconds: typeof MV001_DURATION_SECONDS;
  fidelity: typeof MV001_FIDELITY;
  maxCalls: typeof MV001_MAX_CALLS;
  maxJobs: typeof MV001_MAX_JOBS;
  maxOutputs: typeof MV001_MAX_OUTPUTS;
  estimateMinor: number;
  reservationMinor: typeof MV001_RESERVATION_MINOR;
  absoluteCapMinor: typeof MV001_ABSOLUTE_CAP_MINOR;
  fallbacks: typeof MV001_FALLBACKS;
  autoRetry: typeof MV001_AUTO_RETRY;
  humanReview: "required";
  mergeExport: "disabled";
  productionRegistryEnabled: false;
  productionPaidExecution: false;
};

export function buildMv001BenchmarkProfile(): Mv001BenchmarkProfile {
  const estimate = estimateFalKlingIndicativeCostMinor({
    endpointId: "fal-ai/kling-video/v3/pro/motion-control",
    durationSeconds: MV001_DURATION_SECONDS,
  });
  return Object.freeze({
    schemaVersion: MV001_PROFILE_SCHEMA_VERSION,
    benchmarkId: MV001_BENCHMARK_ID,
    provider: MV001_PROVIDER_ID,
    model: MV001_ENDPOINT_ID,
    durationSeconds: MV001_DURATION_SECONDS,
    fidelity: MV001_FIDELITY,
    maxCalls: MV001_MAX_CALLS,
    maxJobs: MV001_MAX_JOBS,
    maxOutputs: MV001_MAX_OUTPUTS,
    estimateMinor: estimate.estimatedCostMinor,
    reservationMinor: MV001_RESERVATION_MINOR,
    absoluteCapMinor: MV001_ABSOLUTE_CAP_MINOR,
    fallbacks: MV001_FALLBACKS,
    autoRetry: MV001_AUTO_RETRY,
    humanReview: "required",
    mergeExport: "disabled",
    productionRegistryEnabled: FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled,
    productionPaidExecution: FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution,
  });
}

/** Assert Production general profile stays disabled (never flip to SUPPORTED globally). */
export function assertProductionRegistryRemainsDisabled(): void {
  if (FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled !== false) {
    throw new Error("Production fal Kling registry must remain enabled=false.");
  }
  if (FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution !== false) {
    throw new Error("Production fal Kling paidExecution must remain false.");
  }
}

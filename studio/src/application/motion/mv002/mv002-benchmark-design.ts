/**
 * MT-015A — MV-002 benchmark design & readiness prep (documentary / non-paid).
 *
 * Same motion, different virtual character.
 * No media selection, no provider, no budget write, no Production activation.
 */

import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import { estimateFalKlingIndicativeCostMinor } from "@/infrastructure/providers/motion-transfer/fal-kling-motion-control-mapping";
import {
  MV001_ABSOLUTE_CAP_MINOR,
  MV001_BENCHMARK_ID,
  MV001_DURATION_SECONDS,
  MV001_ENDPOINT_ID,
  MV001_PRIVACY_EXPIRES_AT,
  MV001_PROVIDER_ID,
  MV001_RESERVATION_MINOR,
} from "../mv001/mv001-benchmark-profile";

export const MV002_BENCHMARK_ID = "MV-002" as const;
export const MV002_DESIGN_SCHEMA_VERSION = "mt015a-mv002-design-1.0.0" as const;

/** Controlled variable — only this differs from MV-001 execution intent. */
export const MV002_CONTROLLED_VARIABLE = "virtual_character_identity_reference" as const;

export const MV002_DURATION_SECONDS = MV001_DURATION_SECONDS;
export const MV002_PROVIDER_ID = MV001_PROVIDER_ID;
export const MV002_ENDPOINT_ID = MV001_ENDPOINT_ID;
export const MV002_MAX_SUBMIT = 1 as const;
export const MV002_AUTO_RETRY = 0 as const;
export const MV002_FALLBACKS = 0 as const;

/** Same prudent reservation / cap pattern as MV-001 (design — not authorized). */
export const MV002_RESERVATION_MINOR = MV001_RESERVATION_MINOR;
export const MV002_ABSOLUTE_CAP_MINOR = MV001_ABSOLUTE_CAP_MINOR;

/**
 * Observed Production workspace budget AFTER MV-001 (read-only audit MT-015A).
 * hard 274 · committed 247 · reserved 0 · available 27.
 */
export const MV002_OBSERVED_HARD_MINOR = 274 as const;
export const MV002_OBSERVED_COMMITTED_MINOR = 247 as const;
export const MV002_OBSERVED_RESERVED_MINOR = 0 as const;
export const MV002_OBSERVED_AVAILABLE_MINOR = 27 as const;

/** reservation 162 − available 27 */
export const MV002_SHORTFALL_MINOR = 135 as const;
/** Minimal hard raise to cover reservation without assuming other spend: 274+135. */
export const MV002_MIN_HARD_RAISE_TO = 409 as const;

export const MV002_HUMAN_DECISIONS = [
  "APPROVE",
  "REJECT",
  "RETRY_WITH_UPDATED_CONSTRAINTS",
  "REQUEST_NEW_REFERENCE",
] as const;

export type Mv002HumanDecision = (typeof MV002_HUMAN_DECISIONS)[number];

/** Privacy pack keys — all PENDING until separate human Auth (not MV-001 pack). */
export const MV002_PRIVACY_PENDING_KEYS = [
  "providerRetentionAccepted",
  "providerCdnExposureAccepted",
  "biometricProcessingConsentConfirmed",
  "commercialUsageRightsConfirmed",
  "geographicRestrictionsSatisfied",
  "sourceMotionPersonConsentConfirmed",
  "sourceMotionReuseForMv002Authorized",
  "virtualIdentityRightsConfirmed",
] as const;

export type Mv002PrivacyPendingKey = (typeof MV002_PRIVACY_PENDING_KEYS)[number];

export type Mv002DesignProfile = {
  schemaVersion: typeof MV002_DESIGN_SCHEMA_VERSION;
  benchmarkId: typeof MV002_BENCHMARK_ID;
  controlledVariable: typeof MV002_CONTROLLED_VARIABLE;
  provider: typeof MV002_PROVIDER_ID;
  model: typeof MV002_ENDPOINT_ID;
  durationSeconds: typeof MV002_DURATION_SECONDS;
  maxSubmit: typeof MV002_MAX_SUBMIT;
  autoRetry: typeof MV002_AUTO_RETRY;
  fallbacks: typeof MV002_FALLBACKS;
  estimateMinor: number;
  reservationMinor: typeof MV002_RESERVATION_MINOR;
  absoluteCapMinor: typeof MV002_ABSOLUTE_CAP_MINOR;
  observedBudget: {
    hardMinor: typeof MV002_OBSERVED_HARD_MINOR;
    committedMinor: typeof MV002_OBSERVED_COMMITTED_MINOR;
    reservedMinor: typeof MV002_OBSERVED_RESERVED_MINOR;
    availableMinor: typeof MV002_OBSERVED_AVAILABLE_MINOR;
  };
  shortfallMinor: typeof MV002_SHORTFALL_MINOR;
  minHardRaiseTo: typeof MV002_MIN_HARD_RAISE_TO;
  privacy: "PENDING";
  media: "NOT_SELECTED";
  budgetAuth: "NOT_AUTHORIZED";
  providerAuth: "NOT_AUTHORIZED";
  productionRegistryEnabled: false;
  productionPaidExecution: false;
  reusesMv001PrivacyPack: false;
  reusesMv001PrivateAssets: false;
};

export function buildMv002DesignProfile(): Mv002DesignProfile {
  const estimate = estimateFalKlingIndicativeCostMinor({
    endpointId: "fal-ai/kling-video/v3/pro/motion-control",
    durationSeconds: MV002_DURATION_SECONDS,
  });
  return Object.freeze({
    schemaVersion: MV002_DESIGN_SCHEMA_VERSION,
    benchmarkId: MV002_BENCHMARK_ID,
    controlledVariable: MV002_CONTROLLED_VARIABLE,
    provider: MV002_PROVIDER_ID,
    model: MV002_ENDPOINT_ID,
    durationSeconds: MV002_DURATION_SECONDS,
    maxSubmit: MV002_MAX_SUBMIT,
    autoRetry: MV002_AUTO_RETRY,
    fallbacks: MV002_FALLBACKS,
    estimateMinor: estimate.estimatedCostMinor,
    reservationMinor: MV002_RESERVATION_MINOR,
    absoluteCapMinor: MV002_ABSOLUTE_CAP_MINOR,
    observedBudget: {
      hardMinor: MV002_OBSERVED_HARD_MINOR,
      committedMinor: MV002_OBSERVED_COMMITTED_MINOR,
      reservedMinor: MV002_OBSERVED_RESERVED_MINOR,
      availableMinor: MV002_OBSERVED_AVAILABLE_MINOR,
    },
    shortfallMinor: MV002_SHORTFALL_MINOR,
    minHardRaiseTo: MV002_MIN_HARD_RAISE_TO,
    privacy: "PENDING",
    media: "NOT_SELECTED",
    budgetAuth: "NOT_AUTHORIZED",
    providerAuth: "NOT_AUTHORIZED",
    productionRegistryEnabled: false,
    productionPaidExecution: false,
    reusesMv001PrivacyPack: false,
    reusesMv001PrivateAssets: false,
  });
}

export function mv002ReservationShortfallMinor(availableMinor: number): number {
  return Math.max(0, MV002_RESERVATION_MINOR - availableMinor);
}

/** MV-001 Privacy Pack must never authorize MV-002. */
export function assertMv001PrivacyPackDoesNotCoverMv002(input: {
  privacyBenchmarkScope: string;
  targetBenchmarkId: string;
}): void {
  if (input.targetBenchmarkId !== MV002_BENCHMARK_ID) {
    throw new Error("assertMv001PrivacyPackDoesNotCoverMv002: target must be MV-002");
  }
  if (
    input.privacyBenchmarkScope === MV001_BENCHMARK_ID ||
    input.privacyBenchmarkScope === "ACCEPTED_LIMITED_MV001"
  ) {
    throw new Error(
      "MV-001 Privacy Pack does not authorize MV-002 — separate PENDING pack required.",
    );
  }
}

/** Private MV-001 assets must not be auto-reused for MV-002. */
export function assertMv002DoesNotReuseMv001Assets(input: {
  sourceAssetProjectBenchmark: string;
  identityAssetProjectBenchmark: string;
}): void {
  if (
    input.sourceAssetProjectBenchmark === MV001_BENCHMARK_ID ||
    input.identityAssetProjectBenchmark === MV001_BENCHMARK_ID
  ) {
    throw new Error(
      "MV-002 must not reuse MV-001 private assets without new Auth + privacy.",
    );
  }
}

/** Idempotency / correlation namespaces must be distinct. */
export function assertMv002IdempotencyIsolated(input: {
  mv001CorrelationId: string;
  mv002CorrelationId: string;
  mv001IdempotencyKey: string;
  mv002IdempotencyKey: string;
}): void {
  if (
    !input.mv002CorrelationId ||
    input.mv002CorrelationId === input.mv001CorrelationId
  ) {
    throw new Error("MV-002 correlationId must be distinct from MV-001");
  }
  if (
    !input.mv002IdempotencyKey ||
    input.mv002IdempotencyKey === input.mv001IdempotencyKey
  ) {
    throw new Error("MV-002 idempotency key must be distinct from MV-001");
  }
  if (!input.mv002CorrelationId.includes("mv002") && !input.mv002CorrelationId.includes("MV-002")) {
    // Soft convention — require explicit mv002 marker
    throw new Error("MV-002 correlationId should include mv002 marker");
  }
}

export function assertMv002RegistryRemainsDisabled(): void {
  if (FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled !== false) {
    throw new Error("Registry enabled must remain false for MV-002 design");
  }
  if (FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution !== false) {
    throw new Error("Registry paidExecution must remain false for MV-002 design");
  }
  if (FAL_KLING_V3_PRO_REGISTRY_PROFILE.status !== "UNVERIFIED") {
    throw new Error("Registry status must remain UNVERIFIED for MV-002 design");
  }
}

export function assertMv002DesignConstantsMatchMv001Baseline(): void {
  if (MV002_DURATION_SECONDS !== 8) throw new Error("duration must stay 8s");
  if (MV002_ENDPOINT_ID !== MV001_ENDPOINT_ID) {
    throw new Error("endpoint must match MV-001");
  }
  if (MV002_PROVIDER_ID !== MV001_PROVIDER_ID) {
    throw new Error("provider must match MV-001");
  }
  if (MV002_MAX_SUBMIT !== 1) throw new Error("max submit must be 1");
  if (MV002_AUTO_RETRY !== 0 || MV002_FALLBACKS !== 0) {
    throw new Error("retry/fallback must be 0");
  }
}

/** Documentary reminder — MV-001 privacy expiry is not MV-002 coverage. */
export function mv001PrivacyExpiryIso(): string {
  return MV001_PRIVACY_EXPIRES_AT;
}

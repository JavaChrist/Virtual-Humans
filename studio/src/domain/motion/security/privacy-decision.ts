/**
 * Privacy Decision Contract (MT-011) — required before any real Motion benchmark.
 * Extends MT-007B gate with provenance / author / expiry. Default = blocked.
 */

import { deepFreeze } from "../freeze";
import { MotionTransferDomainError } from "../errors";

export const MOTION_PRIVACY_DECISION_CONTRACT_VERSION = "mt011-privacy-1.0.0" as const;

/** Canonical decision keys (ticket §8). */
export type MotionPrivacyDecisionKey =
  | "providerRetentionAccepted"
  | "providerCdnExposureAccepted"
  | "biometricProcessingConsentConfirmed"
  | "commercialUsageRightsConfirmed"
  | "geographicRestrictionsSatisfied";

/** Legacy MT-007B key aliases → canonical. */
export const MOTION_PRIVACY_LEGACY_KEY_MAP = {
  mediaRetentionAccepted: "providerRetentionAccepted",
  cdnExposureStrategyAccepted: "providerCdnExposureAccepted",
  biometricConsentConfirmed: "biometricProcessingConsentConfirmed",
  commercialRightsConfirmed: "commercialUsageRightsConfirmed",
  geographicRestrictionsAccepted: "geographicRestrictionsSatisfied",
} as const;

export type MotionPrivacyDecisionRecord = {
  key: MotionPrivacyDecisionKey;
  value: boolean;
  decidedBy: string;
  decidedAt: string;
  policyVersion: string;
  provenance: string;
  expiresAt?: string;
  workspaceId: string;
  projectId?: string;
  assetId?: string;
};

export type MotionPrivacyDecisionSet = {
  schemaVersion: typeof MOTION_PRIVACY_DECISION_CONTRACT_VERSION;
  workspaceId: string;
  projectId?: string;
  records: readonly MotionPrivacyDecisionRecord[];
};

export type MotionPrivacyGateEvaluation = {
  contractVersion: typeof MOTION_PRIVACY_DECISION_CONTRACT_VERSION;
  status: "blocked" | "accepted";
  missing: readonly MotionPrivacyDecisionKey[];
  expired: readonly MotionPrivacyDecisionKey[];
};

const REQUIRED: readonly MotionPrivacyDecisionKey[] = [
  "providerRetentionAccepted",
  "providerCdnExposureAccepted",
  "biometricProcessingConsentConfirmed",
  "commercialUsageRightsConfirmed",
  "geographicRestrictionsSatisfied",
];

/** Normalize partial boolean map (legacy or canonical) → canonical flags. */
export function normalizePrivacyDecisionFlags(
  input: Record<string, boolean | undefined> = {},
): Record<MotionPrivacyDecisionKey, boolean> {
  const out: Record<MotionPrivacyDecisionKey, boolean> = {
    providerRetentionAccepted: false,
    providerCdnExposureAccepted: false,
    biometricProcessingConsentConfirmed: false,
    commercialUsageRightsConfirmed: false,
    geographicRestrictionsSatisfied: false,
  };
  for (const [k, v] of Object.entries(input)) {
    if (v !== true) continue;
    if ((REQUIRED as readonly string[]).includes(k)) {
      out[k as MotionPrivacyDecisionKey] = true;
      continue;
    }
    const mapped =
      MOTION_PRIVACY_LEGACY_KEY_MAP[k as keyof typeof MOTION_PRIVACY_LEGACY_KEY_MAP];
    if (mapped) out[mapped] = true;
  }
  return out;
}

export function evaluateMotionPrivacyDecisions(
  set: MotionPrivacyDecisionSet | null | undefined,
  nowIso: string,
): Readonly<MotionPrivacyGateEvaluation> {
  const missing: MotionPrivacyDecisionKey[] = [];
  const expired: MotionPrivacyDecisionKey[] = [];
  const now = Date.parse(nowIso);

  for (const key of REQUIRED) {
    const rec = set?.records.find((r) => r.key === key && r.value === true);
    if (!rec) {
      missing.push(key);
      continue;
    }
    if (rec.expiresAt && Number.isFinite(now) && Date.parse(rec.expiresAt) <= now) {
      expired.push(key);
    }
  }

  return deepFreeze({
    contractVersion: MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
    status: missing.length === 0 && expired.length === 0 ? "accepted" : "blocked",
    missing,
    expired,
  });
}

export function assertMotionPrivacyDecisionsOpen(
  set: MotionPrivacyDecisionSet | null | undefined,
  nowIso: string,
): Readonly<MotionPrivacyGateEvaluation> {
  const evaluation = evaluateMotionPrivacyDecisions(set, nowIso);
  if (evaluation.status !== "accepted") {
    throw new MotionTransferDomainError(
      "provider_not_configured",
      "Privacy decisions Motion non autorisées — runtime bloqué.",
      {
        diagnostic: `privacy_blocked:missing=${evaluation.missing.join(",")};expired=${evaluation.expired.join(",")}`,
      },
    );
  }
  return evaluation;
}

/** Build a synthetic accepted set for harness tests only. */
export function createSyntheticAcceptedPrivacyDecisions(input: {
  workspaceId: string;
  projectId?: string;
  decidedBy?: string;
  decidedAt?: string;
  expiresAt?: string;
}): Readonly<MotionPrivacyDecisionSet> {
  const at = input.decidedAt ?? "2026-08-11T00:00:00.000Z";
  const by = input.decidedBy ?? "harness-actor";
  return deepFreeze({
    schemaVersion: MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    records: REQUIRED.map((key) => ({
      key,
      value: true,
      decidedBy: by,
      decidedAt: at,
      policyVersion: MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
      provenance: "synthetic-harness",
      expiresAt: input.expiresAt,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
    })),
  });
}

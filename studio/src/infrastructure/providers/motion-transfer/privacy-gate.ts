/**
 * Motion Transfer Privacy Gate (MT-007B / MT-011).
 * Fail-closed local contract — blocks real provider execution until
 * human decisions are explicitly recorded as accepted.
 *
 * MT-011: delegates evaluation to domain privacy decision contract;
 * keeps legacy boolean API for adapters/worker.
 */

import { deepFreeze } from "@/domain/motion";
import {
  MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
  evaluateMotionPrivacyDecisions,
  normalizePrivacyDecisionFlags,
  type MotionPrivacyDecisionKey,
  type MotionPrivacyDecisionSet,
} from "@/domain/motion/security";

/** @deprecated use MOTION_PRIVACY_DECISION_CONTRACT_VERSION — kept for MT-007B callers */
export const MOTION_TRANSFER_PRIVACY_GATE_VERSION = "mt007b-privacy-1.0.0" as const;

export type MotionTransferPrivacyDecisions = {
  mediaRetentionAccepted: boolean;
  cdnExposureStrategyAccepted: boolean;
  biometricConsentConfirmed: boolean;
  commercialRightsConfirmed: boolean;
  geographicRestrictionsAccepted: boolean;
};

export type MotionTransferPrivacyGateStatus = "blocked" | "accepted";

export type MotionTransferPrivacyGateEvaluation = {
  version: typeof MOTION_TRANSFER_PRIVACY_GATE_VERSION;
  status: MotionTransferPrivacyGateStatus;
  decisions: MotionTransferPrivacyDecisions;
  missing: readonly (keyof MotionTransferPrivacyDecisions)[];
  /** MT-011 contract version when evaluated via domain. */
  contractVersion?: string;
};

export const DEFAULT_MOTION_TRANSFER_PRIVACY_DECISIONS: MotionTransferPrivacyDecisions =
  deepFreeze({
    mediaRetentionAccepted: false,
    cdnExposureStrategyAccepted: false,
    biometricConsentConfirmed: false,
    commercialRightsConfirmed: false,
    geographicRestrictionsAccepted: false,
  });

const LEGACY_KEYS = [
  "mediaRetentionAccepted",
  "cdnExposureStrategyAccepted",
  "biometricConsentConfirmed",
  "commercialRightsConfirmed",
  "geographicRestrictionsAccepted",
] as const satisfies readonly (keyof MotionTransferPrivacyDecisions)[];

function toDecisionSet(
  decisions: Partial<MotionTransferPrivacyDecisions>,
): MotionPrivacyDecisionSet {
  const flags = normalizePrivacyDecisionFlags(decisions as Record<string, boolean>);
  const at = "1970-01-01T00:00:00.000Z";
  return {
    schemaVersion: MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
    workspaceId: "legacy-privacy-gate",
    records: (Object.entries(flags) as [MotionPrivacyDecisionKey, boolean][])
      .filter(([, v]) => v)
      .map(([key]) => ({
        key,
        value: true,
        decidedBy: "legacy-boolean-api",
        decidedAt: at,
        policyVersion: MOTION_TRANSFER_PRIVACY_GATE_VERSION,
        provenance: "mt007b-compat",
        workspaceId: "legacy-privacy-gate",
      })),
  };
}

export function evaluateMotionTransferPrivacyGate(
  decisions: Partial<MotionTransferPrivacyDecisions> = {},
): Readonly<MotionTransferPrivacyGateEvaluation> {
  const merged: MotionTransferPrivacyDecisions = {
    ...DEFAULT_MOTION_TRANSFER_PRIVACY_DECISIONS,
    ...decisions,
  };
  const domain = evaluateMotionPrivacyDecisions(toDecisionSet(merged), new Date().toISOString());
  const missing = LEGACY_KEYS.filter((k) => merged[k] !== true);
  return deepFreeze({
    version: MOTION_TRANSFER_PRIVACY_GATE_VERSION,
    status: domain.status === "accepted" && missing.length === 0 ? "accepted" : "blocked",
    decisions: merged,
    missing,
    contractVersion: MOTION_PRIVACY_DECISION_CONTRACT_VERSION,
  });
}

export function assertMotionTransferPrivacyGateOpen(
  decisions: Partial<MotionTransferPrivacyDecisions> = {},
): Readonly<MotionTransferPrivacyGateEvaluation> {
  const evaluation = evaluateMotionTransferPrivacyGate(decisions);
  if (evaluation.status !== "accepted") {
    throw new Error(
      `Motion Transfer privacy gate blocked — missing: ${evaluation.missing.join(",")}`,
    );
  }
  return evaluation;
}

export function isMotionTransferPrivacyGateBlocked(
  decisions: Partial<MotionTransferPrivacyDecisions> = {},
): boolean {
  return evaluateMotionTransferPrivacyGate(decisions).status === "blocked";
}

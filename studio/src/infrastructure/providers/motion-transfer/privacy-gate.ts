/**
 * Motion Transfer Privacy Gate (MT-007B).
 * Fail-closed local contract — blocks real provider execution until
 * human decisions are explicitly recorded as accepted.
 *
 * Default: privacyGate = blocked. Not a documentation note.
 */

import { deepFreeze } from "@/domain/motion";

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
};

export const DEFAULT_MOTION_TRANSFER_PRIVACY_DECISIONS: MotionTransferPrivacyDecisions =
  deepFreeze({
    mediaRetentionAccepted: false,
    cdnExposureStrategyAccepted: false,
    biometricConsentConfirmed: false,
    commercialRightsConfirmed: false,
    geographicRestrictionsAccepted: false,
  });

const DECISION_KEYS = [
  "mediaRetentionAccepted",
  "cdnExposureStrategyAccepted",
  "biometricConsentConfirmed",
  "commercialRightsConfirmed",
  "geographicRestrictionsAccepted",
] as const satisfies readonly (keyof MotionTransferPrivacyDecisions)[];

export function evaluateMotionTransferPrivacyGate(
  decisions: Partial<MotionTransferPrivacyDecisions> = {},
): Readonly<MotionTransferPrivacyGateEvaluation> {
  const merged: MotionTransferPrivacyDecisions = {
    ...DEFAULT_MOTION_TRANSFER_PRIVACY_DECISIONS,
    ...decisions,
  };
  const missing = DECISION_KEYS.filter((k) => merged[k] !== true);
  return deepFreeze({
    version: MOTION_TRANSFER_PRIVACY_GATE_VERSION,
    status: missing.length === 0 ? "accepted" : "blocked",
    decisions: merged,
    missing,
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

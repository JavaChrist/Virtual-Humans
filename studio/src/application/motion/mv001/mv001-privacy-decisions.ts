/**
 * MT-013K-WIRE — Load MV-001 Privacy Decision Pack (legacy boolean API).
 * Defaults blocked. Never activates from module import alone.
 */

import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";
import type { MotionTransferPrivacyDecisions } from "@/infrastructure/providers/motion-transfer/privacy-gate";
import { MV001_PRIVACY_EXPIRES_AT } from "./mv001-benchmark-profile";

export const MV001_PRIVACY_PACK_SOURCE =
  "AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED" as const;

/**
 * Accepted limited pack for MV-001 only — requires explicit env latch.
 * Env: MV001_PRIVACY_PACK_ACCEPTED=1|true (and not expired).
 */
export function resolveMv001PrivacyDecisions(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
  nowIso: string = new Date().toISOString(),
): Partial<MotionTransferPrivacyDecisions> {
  if (!parseStrictEnabledFlag(env.MV001_PRIVACY_PACK_ACCEPTED)) {
    return {};
  }
  const now = Date.parse(nowIso);
  const exp = Date.parse(env.MV001_PRIVACY_EXPIRES_AT ?? MV001_PRIVACY_EXPIRES_AT);
  if (!Number.isFinite(now) || !Number.isFinite(exp) || exp < now) {
    return {};
  }
  return {
    mediaRetentionAccepted: true,
    cdnExposureStrategyAccepted: true,
    biometricConsentConfirmed: true,
    commercialRightsConfirmed: true,
    geographicRestrictionsAccepted: true,
  };
}

export function isMv001PrivacyPackActive(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
  nowIso: string = new Date().toISOString(),
): boolean {
  const d = resolveMv001PrivacyDecisions(env, nowIso);
  return (
    d.mediaRetentionAccepted === true &&
    d.cdnExposureStrategyAccepted === true &&
    d.biometricConsentConfirmed === true &&
    d.commercialRightsConfirmed === true &&
    d.geographicRestrictionsAccepted === true
  );
}

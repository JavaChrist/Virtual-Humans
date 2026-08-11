/**
 * MT-008 — fail-closed gates before Motion Transfer submit/poll orchestration.
 */

import {
  evaluateMotionTransferPrivacyGate,
  type MotionTransferPrivacyDecisions,
} from "@/infrastructure/providers/motion-transfer/privacy-gate";
import {
  getMotionTransferFlags,
  type MotionTransferFlagsSnapshot,
} from "@/infrastructure/providers/motion-transfer/motion-transfer-flags";
import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";

export type MotionTransferRegistryGateProfile = {
  enabled: boolean;
  paidExecution: boolean;
  status: string;
};

export type MotionTransferWorkerGateEvaluation = {
  ok: boolean;
  reason?: string;
  flags: MotionTransferFlagsSnapshot;
  privacyStatus: "blocked" | "accepted";
  harnessActive: boolean;
  missing: string[];
};

export type EvaluateMotionTransferWorkerGatesInput = {
  env?: Record<string, string | undefined>;
  privacyDecisions?: Partial<MotionTransferPrivacyDecisions>;
  registryProfile: MotionTransferRegistryGateProfile;
  /** Firm estimate present on the job intent. */
  firmEstimatePresent: boolean;
  reservationPresent: boolean;
  mediaAvailable: boolean;
  humanReviewPolicyPresent: boolean;
  routeSelected: boolean;
  versionsSupported?: boolean;
};

/**
 * Local test harness only — never on Vercel/Production.
 * MOTION_TRANSFER_FAKE_HARNESS=1|true
 */
export function isMotionTransferFakeHarnessActive(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  if (env.VERCEL === "1") return false;
  if (env.VERCEL_ENV && env.VERCEL_ENV.length > 0) return false;
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();
  if (nodeEnv === "production") return false;
  return parseStrictEnabledFlag(env.MOTION_TRANSFER_FAKE_HARNESS);
}

export function evaluateMotionTransferWorkerGates(
  input: EvaluateMotionTransferWorkerGatesInput,
): MotionTransferWorkerGateEvaluation {
  const env =
    input.env ?? (process.env as Record<string, string | undefined>);
  const flags = getMotionTransferFlags(env);
  const harnessActive = isMotionTransferFakeHarnessActive(env);
  const privacy = evaluateMotionTransferPrivacyGate(input.privacyDecisions);
  const missing: string[] = [];

  if (!flags.motionTransferEnabled) missing.push("MOTION_TRANSFER_ENABLED");
  if (!flags.motionTransferPaidEnabled) missing.push("MOTION_TRANSFER_PAID_ENABLED");
  if (!flags.motionTransferFalEnabled) missing.push("MOTION_TRANSFER_FAL_ENABLED");
  if (!flags.motionTransferWorkerEnabled) {
    missing.push("MOTION_TRANSFER_WORKER_ENABLED");
  }
  if (privacy.status !== "accepted") missing.push("privacy_gate");
  if (!input.firmEstimatePresent) missing.push("firm_estimate");
  if (!input.reservationPresent) missing.push("reservation");
  if (!input.mediaAvailable) missing.push("media");
  if (!input.humanReviewPolicyPresent) missing.push("human_review_policy");
  if (!input.routeSelected) missing.push("route");
  if (input.versionsSupported === false) missing.push("versions");

  // Registry: Production requires verified+enabled. Harness may use UNVERIFIED fake route.
  if (!harnessActive) {
    if (!input.registryProfile.enabled) missing.push("registry_enabled");
    if (input.registryProfile.status !== "available") {
      missing.push("registry_verified");
    }
    if (!input.registryProfile.paidExecution) missing.push("registry_paid");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: `motion_gates_blocked:${missing.join(",")}`,
      flags,
      privacyStatus: privacy.status,
      harnessActive,
      missing,
    };
  }

  return {
    ok: true,
    flags,
    privacyStatus: privacy.status,
    harnessActive,
    missing: [],
  };
}

/**
 * Motion Transfer feature flags (MT-007B).
 * Strict parse: only "1" | "true" (trimmed, case-insensitive) → on.
 * All OFF by default. Never NEXT_PUBLIC_*.
 */

import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";

export type MotionTransferFlagName =
  | "MOTION_TRANSFER_ENABLED"
  | "MOTION_TRANSFER_PAID_ENABLED"
  | "MOTION_TRANSFER_FAL_ENABLED"
  | "MOTION_TRANSFER_WORKER_ENABLED";

export type MotionTransferFlagsSnapshot = {
  motionTransferEnabled: boolean;
  motionTransferPaidEnabled: boolean;
  motionTransferFalEnabled: boolean;
  motionTransferWorkerEnabled: boolean;
};

export function isMotionTransferEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return parseStrictEnabledFlag(env.MOTION_TRANSFER_ENABLED);
}

export function isMotionTransferPaidEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return parseStrictEnabledFlag(env.MOTION_TRANSFER_PAID_ENABLED);
}

export function isMotionTransferFalEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return parseStrictEnabledFlag(env.MOTION_TRANSFER_FAL_ENABLED);
}

export function isMotionTransferWorkerEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return parseStrictEnabledFlag(env.MOTION_TRANSFER_WORKER_ENABLED);
}

export function getMotionTransferFlags(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): MotionTransferFlagsSnapshot {
  return {
    motionTransferEnabled: isMotionTransferEnabled(env),
    motionTransferPaidEnabled: isMotionTransferPaidEnabled(env),
    motionTransferFalEnabled: isMotionTransferFalEnabled(env),
    motionTransferWorkerEnabled: isMotionTransferWorkerEnabled(env),
  };
}

/**
 * All three adapter flags must be ON to resolve the real fal adapter.
 * Worker flag is separate (MT-008) and not required for adapter construction.
 */
export function canResolveFalMotionTransferAdapter(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  const f = getMotionTransferFlags(env);
  return (
    f.motionTransferEnabled &&
    f.motionTransferPaidEnabled &&
    f.motionTransferFalEnabled
  );
}

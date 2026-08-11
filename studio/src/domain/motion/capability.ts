/**
 * Canonical Motion / Performance Transfer capability (MT-001).
 * Distinct from I2V / T2V — no implicit conversion.
 * Registry profile `video.motion_transfer` is wired in CapabilityProfileValues (MT-002).
 */

export const MOTION_TRANSFER_CAPABILITY = "video.motion_transfer" as const;
export type MotionTransferCapability = typeof MOTION_TRANSFER_CAPABILITY;

/** Capabilities that must never be silently substituted for motion_transfer. */
export const NON_MOTION_TRANSFER_VIDEO_CAPABILITIES = [
  "video.image_to_video",
  "video.text_to_video",
  "image.reference_identity",
] as const;

export type NonMotionTransferVideoCapability =
  (typeof NON_MOTION_TRANSFER_VIDEO_CAPABILITIES)[number];

export function isMotionTransferCapability(
  value: unknown,
): value is MotionTransferCapability {
  return value === MOTION_TRANSFER_CAPABILITY;
}

/** Fail-closed guard — never treat I2V/T2V as motion_transfer. */
export function assertNotI2vOrT2vFallback(capability: string): void {
  if (capability !== MOTION_TRANSFER_CAPABILITY) {
    throw new Error("motion_capability_mismatch");
  }
}

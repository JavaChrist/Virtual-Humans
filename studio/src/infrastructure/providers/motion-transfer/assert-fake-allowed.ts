/**
 * Fail-closed guard — Motion Transfer fake adapter is TEST_ONLY.
 * Forbidden on Vercel / Production runtime (unless local harness marker).
 */

export type MotionTransferFakeAllowed =
  | { ok: true }
  | { ok: false; reason: "vercel" | "production" };

/**
 * Returns ok only when the fake adapter may be constructed.
 * Never logs secrets. Does not read provider keys (fake must not need them).
 */
export function assertMotionTransferFakeAdapterAllowed(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): MotionTransferFakeAllowed {
  if (env.VERCEL === "1" || (env.VERCEL_ENV != null && env.VERCEL_ENV !== "")) {
    return { ok: false, reason: "vercel" };
  }
  if (
    env.NODE_ENV === "production" &&
    env.DIRECTOR_V2_E2E_HARNESS !== "1" &&
    env.MOTION_TRANSFER_FAKE_HARNESS !== "1"
  ) {
    return { ok: false, reason: "production" };
  }
  return { ok: true };
}

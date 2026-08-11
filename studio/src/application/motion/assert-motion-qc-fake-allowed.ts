/**
 * Fake Motion QC measurement port — TEST_ONLY (MT-009).
 */

export type MotionQcFakeAllowed =
  | { ok: true }
  | { ok: false; reason: "vercel" | "production" };

export function assertMotionQcFakeMeasurementAllowed(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): MotionQcFakeAllowed {
  if (env.VERCEL === "1" || (env.VERCEL_ENV != null && env.VERCEL_ENV !== "")) {
    return { ok: false, reason: "vercel" };
  }
  if (
    env.NODE_ENV === "production" &&
    env.MOTION_TRANSFER_FAKE_HARNESS !== "1" &&
    env.DIRECTOR_V2_E2E_HARNESS !== "1"
  ) {
    return { ok: false, reason: "production" };
  }
  return { ok: true };
}

/**
 * Worker endpoint authentication helpers (VHS-124).
 * Fail-closed: absent/empty secret → reject.
 */
import { timingSafeEqual } from "node:crypto";

export type WorkerSecretCheck =
  | { ok: true }
  | { ok: false; reason: "secret_not_configured" | "secret_mismatch" | "header_missing" };

/**
 * Compare request header to DIRECTOR_V2_WORKER_SECRET with timing-safe equality.
 * Never logs the secret value.
 */
export function assertDirectorWorkerSecret(
  headerValue: string | null | undefined,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): WorkerSecretCheck {
  const expected = env.DIRECTOR_V2_WORKER_SECRET?.trim() ?? "";
  if (!expected) {
    return { ok: false, reason: "secret_not_configured" };
  }
  if (headerValue == null || headerValue === "") {
    return { ok: false, reason: "header_missing" };
  }
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, reason: "secret_mismatch" };
  }
  try {
    if (!timingSafeEqual(a, b)) {
      return { ok: false, reason: "secret_mismatch" };
    }
  } catch {
    return { ok: false, reason: "secret_mismatch" };
  }
  return { ok: true };
}

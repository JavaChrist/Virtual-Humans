/**
 * CSRF policy for cookie-authenticated mutations (VHS-002 / Phase 7).
 *
 * SameSite alone is insufficient. For browser cookie sessions we require
 * Origin (preferred) or Referer to match the request Host.
 *
 * Exceptions (documented):
 * - GET/HEAD/OPTIONS: no CSRF check
 * - POST /api/internal/director-worker/run-once ONLY: worker secret auth — CSRF N/A
 *   (no cookie trust; no wildcard /api/internal/**)
 * - /api/login: pre-session; Origin checked when present, absent allowed (CLI/tests)
 */

export type CsrfCheckResult =
  | { ok: true }
  | { ok: false; reason: "origin_mismatch" | "origin_required" | "host_missing" };

function hostFromUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Validate Origin/Referer against Host for state-changing requests.
 * @param requireOrigin when true, missing Origin+Referer fails (cookie mutations).
 */
export function assertCsrf(
  headers: {
    origin?: string | null;
    referer?: string | null;
    host?: string | null;
    "x-forwarded-host"?: string | null;
  },
  opts: { requireOrigin: boolean },
): CsrfCheckResult {
  const hostRaw = headers.host ?? headers["x-forwarded-host"] ?? null;
  if (!hostRaw || !String(hostRaw).trim()) {
    return { ok: false, reason: "host_missing" };
  }
  // Host may be "example.com:443" — compare host only
  const expectedHost = String(hostRaw).split(",")[0]!.trim().toLowerCase();

  const origin = headers.origin?.trim() || null;
  if (origin) {
    if (origin === "null") {
      return { ok: false, reason: "origin_mismatch" };
    }
    const originHost = hostFromUrl(origin);
    if (!originHost || originHost !== expectedHost) {
      return { ok: false, reason: "origin_mismatch" };
    }
    return { ok: true };
  }

  const referer = headers.referer?.trim() || null;
  if (referer) {
    const refHost = hostFromUrl(referer);
    if (!refHost || refHost !== expectedHost) {
      return { ok: false, reason: "origin_mismatch" };
    }
    return { ok: true };
  }

  if (opts.requireOrigin) {
    return { ok: false, reason: "origin_required" };
  }
  return { ok: true };
}

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

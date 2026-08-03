/**
 * Prevent open redirects after login (VHS-002).
 * Only same-origin relative paths are accepted.
 */

/**
 * Returns a safe internal path or the fallback.
 * Rejects protocol-relative (`//…`), absolute URLs, backslashes, and control chars.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/",
): string {
  if (candidate == null || typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  if (/[\0\r\n]/.test(trimmed)) return fallback;
  // Block scheme-like paths: /http:… or /\thttp:
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;
  // Cap length
  if (trimmed.length > 512) return fallback;
  return trimmed;
}

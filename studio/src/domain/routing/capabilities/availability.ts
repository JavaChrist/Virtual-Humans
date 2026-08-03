/**
 * Availability helpers (VHS-107).
 * Freshness checks only — no live provider probes.
 */

export function isIsoUtc(value: string): boolean {
  if (typeof value !== "string" || !value) return false;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return false;
  // Prefer explicit Z / offset; reject clearly local-only ambiguity loosely via Date.parse
  return true;
}

export function isExpired(expiresAt: string | undefined, at: string): boolean {
  if (!expiresAt) return false;
  const exp = Date.parse(expiresAt);
  const now = Date.parse(at);
  if (!Number.isFinite(exp) || !Number.isFinite(now)) return true;
  return now >= exp;
}

export function isPricingValidAt(
  pricing: { validFrom?: string; validUntil?: string },
  at: string,
): boolean {
  const now = Date.parse(at);
  if (!Number.isFinite(now)) return false;
  if (pricing.validFrom) {
    const from = Date.parse(pricing.validFrom);
    if (!Number.isFinite(from) || now < from) return false;
  }
  if (pricing.validUntil) {
    const until = Date.parse(pricing.validUntil);
    if (!Number.isFinite(until) || now >= until) return false;
  }
  return true;
}

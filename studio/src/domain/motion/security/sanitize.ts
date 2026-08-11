/**
 * Centralized Motion Transfer sanitizer (MT-011).
 * Single entry for Router / Engine / adapter / worker / QC / review / API / events.
 */

import { deepFreeze } from "../freeze";

export const MOTION_SANITIZER_VERSION = "mt011-sanitize-1.0.0" as const;
export const REDACTED_MOTION = "[REDACTED_MOTION]" as const;

const SECRET_PATTERNS: RegExp[] = [
  /\bFAL_KEY\s*[=:]\s*\S+/gi,
  /\bFAL_KEY\b/gi,
  /\bfal[_-][A-Za-z0-9][-A-Za-z0-9]{7,}\b/gi,
  /\bsk-[A-Za-z0-9]{10,}\b/gi,
  /\bBearer\s+[A-Za-z0-9._\-+/=]+\b/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
];

const URL_PATTERNS: RegExp[] = [
  /https?:\/\/\S+/gi,
  /data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gi,
  /[?&](token|signature|sig|X-Amz-[^=]+)=[^&\s]+/gi,
];

const SENSITIVE_KEY_RE =
  /^(authorization|password|secret|token|apikey|falkey|prompt|negativeprompt|dataurl|signedurl|comment|biography|biometric|rawpayload|providerresponse|providerrequest|sourcevideo|identityimage|outfitimage)$/i;

function normalizeKey(k: string): string {
  return k.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

export function sanitizeMotionString(value: string): string {
  let out = value;
  for (const re of SECRET_PATTERNS) out = out.replace(re, REDACTED_MOTION);
  for (const re of URL_PATTERNS) out = out.replace(re, REDACTED_MOTION);
  // Large base64-ish blobs
  out = out.replace(/[A-Za-z0-9+/]{200,}={0,2}/g, REDACTED_MOTION);
  return out.length > 500 ? `${out.slice(0, 500)}…` : out;
}

export type SanitizeMotionOptions = {
  maxDepth?: number;
  /** Preserve correlation / operational ids even if string-like. */
  preserveKeys?: readonly string[];
};

/**
 * Deep-sanitize unknown values for logs/events. Never mutates input.
 * Returns a frozen plain JSON-safe structure.
 */
export function sanitizeMotionValue(
  value: unknown,
  options: SanitizeMotionOptions = {},
): unknown {
  const maxDepth = options.maxDepth ?? 8;
  const preserve = new Set(
    (options.preserveKeys ?? []).map((k) => normalizeKey(k)),
  );
  const seen = new WeakSet<object>();

  function walk(v: unknown, depth: number, keyHint: string): unknown {
    if (depth > maxDepth) return REDACTED_MOTION;
    if (v == null) return v;
    if (typeof v === "string") {
      if (preserve.has(normalizeKey(keyHint))) {
        // Still strip obvious secrets/URLs from preserved fields
        if (/https?:\/\//i.test(v) || /Bearer\s+/i.test(v) || /\bsk-/i.test(v)) {
          return REDACTED_MOTION;
        }
        return v.length > 120 ? `${v.slice(0, 120)}…` : v;
      }
      return sanitizeMotionString(v);
    }
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "bigint") return String(v);
    if (typeof v === "function" || typeof v === "symbol") return REDACTED_MOTION;
    if (Array.isArray(v)) {
      return v.slice(0, 40).map((item, i) => walk(item, depth + 1, `${keyHint}[${i}]`));
    }
    if (typeof v === "object") {
      if (seen.has(v as object)) return REDACTED_MOTION;
      seen.add(v as object);
      const out: Record<string, unknown> = {};
      let n = 0;
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        if (n++ >= 80) {
          out["…"] = REDACTED_MOTION;
          break;
        }
        const nk = normalizeKey(k);
        if (SENSITIVE_KEY_RE.test(nk) || SENSITIVE_KEY_RE.test(k)) {
          out[k] = REDACTED_MOTION;
          continue;
        }
        out[k] = walk(child, depth + 1, k);
      }
      return out;
    }
    return REDACTED_MOTION;
  }

  return deepFreeze(walk(value, 0, "root"));
}

/**
 * Assert a JSON blob is safe for Motion events/logs. Throws typed Error codes.
 */
export function assertMotionSurfaceRedacted(
  value: unknown,
  surface = "motion_event",
): void {
  const blob = JSON.stringify(value);
  if (/https?:\/\//i.test(blob)) {
    throw new Error(`${surface}_media_leak`);
  }
  if (/data:[^;]+;base64,/i.test(blob)) {
    throw new Error(`${surface}_data_url_leak`);
  }
  if (/\bsk-[A-Za-z0-9]{10,}/i.test(blob) || /Bearer\s+\S+/i.test(blob)) {
    throw new Error(`${surface}_secret_leak`);
  }
  if (/\bFAL_KEY\b/i.test(blob) || /fal-[A-Za-z0-9]{12,}/i.test(blob)) {
    throw new Error(`${surface}_fal_secret_leak`);
  }
  if (/X-Amz-/i.test(blob)) {
    throw new Error(`${surface}_signed_url_leak`);
  }
}

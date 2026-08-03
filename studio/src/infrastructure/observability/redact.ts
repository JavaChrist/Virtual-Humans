/**
 * Pure redaction for structured logs.
 * - Never mutates the input
 * - Handles circular references
 * - Bounds depth / size
 * - Masks secrets, auth material, and user content fields (prompts, scripts…)
 */

export const REDACTED = "[REDACTED]" as const;

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_KEYS = 80;
const DEFAULT_MAX_STRING = 240;
const DEFAULT_MAX_ARRAY = 40;

/** Normalized key names (lowercase, no separators) treated as secrets. */
const SENSITIVE_KEY_NAMES = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "password",
  "apppassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "apisecret",
  "secret",
  "secretkey",
  "servicerolekey",
  "supabaseservicerolekey",
  "falkey",
  "openaiapikey",
  "elevenlabsapikey",
  "elevenlabsvoiceid",
  "importtoken",
  "aiccosimporttoken",
  "privatekey",
  "clientsecret",
  "bearer",
  "xapikey",
  // Internal Storage object keys (VHS-127) — never log durable paths
  "storagepath",
]);

/**
 * User / generative content — never log in full.
 * Normalized the same way as sensitive keys.
 */
const CONTENT_KEY_NAMES = new Set([
  "prompt",
  "negativeprompt",
  "script",
  "dialogue",
  "dialog",
  "line",
  "lines",
  "transcript",
  "utterance",
  "voiceover",
  "voicetext",
  "bodytext",
  "usercontent",
  "rawprompt",
  "systemprompt",
  // Brief / director fields (VHS-116) — never log in full
  "calltoaction",
  "audiencedescription",
  "brandconstraints",
  "subjectdescription",
  "brief",
  // Inline media (Phase 9) — never log data URLs in full
  "dataurl",
  "inlinedataurl",
]);

export type RedactOptions = {
  maxDepth?: number;
  maxKeys?: number;
  maxString?: number;
  maxArray?: number;
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string): boolean {
  const n = normalizeKey(key);
  if (SENSITIVE_KEY_NAMES.has(n)) return true;
  // Heuristic: *apikey, *secret, *token, *password, *authorization
  if (n.endsWith("apikey") || n.endsWith("api key".replace(/\s/g, ""))) return true;
  if (n.endsWith("secret") || n.endsWith("token") || n.endsWith("password")) return true;
  if (n.includes("authorization") || n.includes("servicerole")) return true;
  return false;
}

function isContentKey(key: string): boolean {
  return CONTENT_KEY_NAMES.has(normalizeKey(key));
}

/** Detect signed URLs / query strings carrying credentials. */
function looksLikeSignedOrSecretUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) && !value.includes("://")) {
    // Still check query-like fragments
    if (!/[?&]/.test(value)) return false;
  }
  const lower = value.toLowerCase();
  return (
    lower.includes("x-amz-signature=") ||
    lower.includes("x-amz-credential=") ||
    lower.includes("x-amz-security-token=") ||
    lower.includes("signature=") ||
    lower.includes("sig=") ||
    /[?&](token|access_token|auth|key|api_key|apikey)=/i.test(value) ||
    lower.includes("token=")
  );
}

/** Standard UUID — allowed in logs (correlation / entity ids). */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

/** Detect opaque secret-like strings (API keys, bearer tokens), including embedded. */
function looksLikeSecretString(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) return false;
  if (isUuid(v)) return false;
  if (/bearer\s+\S+/i.test(v)) return true;
  if (/\bsk-[A-Za-z0-9_-]{10,}\b/i.test(v)) return true;
  if (/\bsk_live_[A-Za-z0-9_-]{10,}\b/i.test(v)) return true;
  if (/\bfal_[A-Za-z0-9_-]{10,}\b/i.test(v)) return true;
  // Long opaque tokens without separators (exclude readable ids with dots/spaces)
  if (
    v.length >= 40 &&
    !/[.\s]/.test(v) &&
    /^[A-Za-z0-9+/=_-]+$/.test(v) &&
    /[A-Za-z]/.test(v) &&
    /\d/.test(v)
  ) {
    return true;
  }
  return false;
}

function truncateString(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…[truncated ${value.length} chars]`;
}

function looksLikeDataUrl(value: string): boolean {
  return /^data:[^,\s]+,/i.test(value.trim());
}

function redactStringValue(value: string, asContent: boolean, maxString: number): string {
  if (asContent) return REDACTED;
  if (looksLikeDataUrl(value)) return REDACTED;
  if (looksLikeSignedOrSecretUrl(value)) return REDACTED;
  if (looksLikeSecretString(value)) return REDACTED;
  return truncateString(value, maxString);
}

/**
 * Deep-clone with redaction. Returns a new structure; input is never mutated.
 */
export function redact(input: unknown, options: RedactOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const maxString = options.maxString ?? DEFAULT_MAX_STRING;
  const maxArray = options.maxArray ?? DEFAULT_MAX_ARRAY;
  const seen = new WeakSet<object>();

  function walk(value: unknown, depth: number, parentKey?: string): unknown {
    if (value == null) return value;

    if (typeof value === "string") {
      return redactStringValue(value, parentKey ? isContentKey(parentKey) : false, maxString);
    }

    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return value;
    }

    if (typeof value === "symbol" || typeof value === "function") {
      return `[${typeof value}]`;
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: redactStringValue(value.message, false, maxString),
        // Stack paths are useful for ops but truncated; never includes request bodies.
        stack: value.stack ? truncateString(value.stack, maxString) : undefined,
      };
    }

    if (typeof value !== "object") {
      return String(value);
    }

    if (seen.has(value as object)) {
      return "[Circular]";
    }

    if (depth >= maxDepth) {
      return "[MaxDepth]";
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      const out: unknown[] = [];
      const limit = Math.min(value.length, maxArray);
      for (let i = 0; i < limit; i++) {
        out.push(walk(value[i], depth + 1, parentKey));
      }
      if (value.length > maxArray) {
        out.push(`[+${value.length - maxArray} more]`);
      }
      return out;
    }

    // Plain object / class instance
    const entries = Object.entries(value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    const limit = Math.min(entries.length, maxKeys);
    for (let i = 0; i < limit; i++) {
      const [key, child] = entries[i];
      if (isSensitiveKey(key) || isContentKey(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = walk(child, depth + 1, key);
    }
    if (entries.length > maxKeys) {
      out["…"] = `[+${entries.length - maxKeys} keys]`;
    }
    return out;
  }

  return walk(input, 0);
}

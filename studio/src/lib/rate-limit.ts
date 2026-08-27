/**
 * Best-effort in-memory rate limiter (VHS-002 / Phase 7).
 *
 * NOT a distributed guarantee on multi-instance Vercel — each isolate has its
 * own map. Port is injectable for a future durable store.
 *
 * Keys must never contain secrets (use hashed IP / route class only).
 */

export type RateLimitEntry = { count: number; resetAt: number };

export type RateLimitStore = {
  get(key: string): RateLimitEntry | undefined;
  set(key: string, value: RateLimitEntry): void;
  delete(key: string): void;
  size(): number;
  /** Optional purge of expired entries. */
  purge?(now: number): void;
};

export type RateLimitPolicy = {
  /** Max requests in the window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSeconds: number };

export function createMemoryRateLimitStore(maxEntries = 10_000): RateLimitStore {
  const map = new Map<string, RateLimitEntry>();

  function purge(now: number) {
    for (const [k, v] of map) {
      if (v.resetAt <= now) map.delete(k);
    }
    // Bound memory: drop oldest if still over cap
    while (map.size > maxEntries) {
      const first = map.keys().next().value;
      if (first === undefined) break;
      map.delete(first);
    }
  }

  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    delete: (key) => {
      map.delete(key);
    },
    size: () => map.size,
    purge,
  };
}

/** Shared process/isolate store for proxy + routes (best-effort). */
const defaultStore = createMemoryRateLimitStore();

export function getDefaultRateLimitStore(): RateLimitStore {
  return defaultStore;
}

export function checkRateLimit(
  key: string,
  policy: RateLimitPolicy,
  opts: {
    store?: RateLimitStore;
    now?: number;
  } = {},
): RateLimitResult {
  const store = opts.store ?? defaultStore;
  const now = opts.now ?? Date.now();
  store.purge?.(now);

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + policy.windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: policy.limit - 1, resetAt };
  }

  if (existing.count >= policy.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    };
  }

  const next = { count: existing.count + 1, resetAt: existing.resetAt };
  store.set(key, next);
  return {
    ok: true,
    remaining: Math.max(0, policy.limit - next.count),
    resetAt: next.resetAt,
  };
}

/** Stable non-secret client key from request IP / forwarded header. */
export function rateLimitClientKey(ipHint: string | null | undefined): string {
  const raw = (ipHint ?? "unknown").split(",")[0]?.trim() || "unknown";
  // Bound + strip anything odd — never log this as a secret
  const cleaned = raw.replace(/[^a-zA-Z0-9.:_-]/g, "").slice(0, 64);
  return cleaned || "unknown";
}

const e2eHarness =
  process.env.DIRECTOR_V2_E2E_HARNESS === "1" ||
  process.env.DIRECTOR_V2_E2E_HARNESS === "true";

export const RATE_LIMITS = {
  // 20: proxy + route each increment once per login attempt → ~10 effective.
  // E2E harness: suite complète dépasse ce plafond (logins UI + API) — fenêtre locale élargie.
  login: {
    limit: e2eHarness ? 500 : 20,
    windowMs: 15 * 60 * 1000,
  } satisfies RateLimitPolicy,
  generate: { limit: 60, windowMs: 60 * 1000 } satisfies RateLimitPolicy,
  director: { limit: 120, windowMs: 60 * 1000 } satisfies RateLimitPolicy,
  worker: { limit: 30, windowMs: 60 * 1000 } satisfies RateLimitPolicy,
  aiccos: { limit: 20, windowMs: 60 * 1000 } satisfies RateLimitPolicy,
  defaultMutation: { limit: 120, windowMs: 60 * 1000 } satisfies RateLimitPolicy,
  // GET /api/version — 120s poll + focus/visibility + several tabs behind NAT.
  version: { limit: 240, windowMs: 60 * 1000 } satisfies RateLimitPolicy,
} as const;

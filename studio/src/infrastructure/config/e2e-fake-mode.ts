/**
 * DIRECTOR_V2_E2E_FAKE_MODE — test-only, fail-closed (Phase 8).
 *
 * Never a user toggle. Off by default. Impossible to enable safely on Vercel
 * (production NODE_ENV, non-local Supabase, or real provider keys → refuse).
 */

import { parseStrictEnabledFlag } from "./feature-flags";

export type E2eFakeModeCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "disabled"
        | "production"
        | "non_local_host"
        | "non_local_supabase"
        | "provider_key_present";
    };

const PROVIDER_KEY_ENVS = [
  "OPENAI_API_KEY",
  "FAL_KEY",
  "ELEVENLABS_API_KEY",
  "AICCOS_IMPORT_TOKEN",
] as const;

function looksLikeRealProviderKey(value: string | undefined): boolean {
  const v = value?.trim() ?? "";
  if (!v) return false;
  // Explicit synthetic placeholders used only in unit/integration tests — still
  // forbidden in E2E fake mode (mode must run with ZERO provider keys).
  return true;
}

function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function supabaseHost(env: Record<string, string | undefined>): string | null {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.trim()) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * True only when the flag is on AND every fail-closed guard passes.
 * Does not mutate env. Never logs secret values.
 */
export function assertDirectorE2eFakeMode(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): E2eFakeModeCheck {
  if (!parseStrictEnabledFlag(env.DIRECTOR_V2_E2E_FAKE_MODE)) {
    return { ok: false, reason: "disabled" };
  }
  // Refuse on Vercel always. Refuse NODE_ENV=production unless the local
  // Playwright harness marker is present (next start sets production).
  if (env.VERCEL === "1" || (env.VERCEL_ENV != null && env.VERCEL_ENV !== "")) {
    return { ok: false, reason: "production" };
  }
  if (
    env.NODE_ENV === "production" &&
    env.DIRECTOR_V2_E2E_HARNESS !== "1"
  ) {
    return { ok: false, reason: "production" };
  }

  const sbHost = supabaseHost(env);
  if (!sbHost || !isLocalHostname(sbHost)) {
    return { ok: false, reason: "non_local_supabase" };
  }

  for (const key of PROVIDER_KEY_ENVS) {
    if (looksLikeRealProviderKey(env[key])) {
      return { ok: false, reason: "provider_key_present" };
    }
  }

  return { ok: true };
}

/** Convenience: fake analyzers / execute bypass allowed. */
export function isDirectorE2eFakeMode(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return assertDirectorE2eFakeMode(env).ok;
}

/** Synthetic model id stored on director_runs during E2E — never a real provider. */
export const E2E_FAKE_MODEL_ID = "e2e-fake-deterministic";

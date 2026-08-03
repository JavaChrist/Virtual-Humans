/**
 * Gate for repository integration tests against local Supabase only (VHS-115).
 *
 * Never reads .env.local remote credentials.
 * Requires explicit SUPABASE_LOCAL_INTEGRATION=1 and a localhost URL.
 */

export type LocalSupabaseGate =
  | { ok: true; url: string; serviceRoleKey: string }
  | { ok: false; reason: string };

/**
 * Resolve local-only Supabase connection for integration tests.
 * Accepts only 127.0.0.1 / localhost URLs.
 */
export function resolveLocalSupabaseGate(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): LocalSupabaseGate {
  if (env.SUPABASE_LOCAL_INTEGRATION !== "1") {
    return {
      ok: false,
      reason:
        "SUPABASE_LOCAL_INTEGRATION≠1 — suite d'intégration DB non activée.",
    };
  }

  // Never fall back to SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (may be remote).
  const url = (env.SUPABASE_LOCAL_URL ?? "").trim();
  const key = (env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? "").trim();

  if (!url || !key) {
    return {
      ok: false,
      reason:
        "SUPABASE_LOCAL_URL / SUPABASE_LOCAL_SERVICE_ROLE_KEY absents. Exporter depuis `npx supabase status` (jamais le distant).",
    };
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: "SUPABASE_LOCAL_URL invalide." };
  }

  if (host !== "127.0.0.1" && host !== "localhost") {
    return {
      ok: false,
      reason: `Refus : hôte « ${host} » n'est pas local (127.0.0.1/localhost uniquement).`,
    };
  }

  return { ok: true, url, serviceRoleKey: key };
}

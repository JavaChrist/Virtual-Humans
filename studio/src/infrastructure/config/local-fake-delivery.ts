/**
 * Gate for process-local fake merge asset bytes (Phase 9).
 *
 * The in-memory AssetContentPort is NOT safe on Vercel multi-instance or with
 * a remote Supabase URL. Allowed only for local Docker Supabase / E2E harness.
 */

export type LocalFakeDeliveryCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "vercel" | "production" | "non_local_supabase";
    };

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
 * True when process-local fake merge content may be used.
 * Never enables remote durable storage — only an in-memory Map for local/E2E.
 */
export function assertLocalFakeDeliveryAllowed(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): LocalFakeDeliveryCheck {
  if (env.VERCEL === "1" || (env.VERCEL_ENV != null && env.VERCEL_ENV !== "")) {
    return { ok: false, reason: "vercel" };
  }
  if (env.NODE_ENV === "production" && env.DIRECTOR_V2_E2E_HARNESS !== "1") {
    return { ok: false, reason: "production" };
  }
  const host = supabaseHost(env);
  // Injected-client unit/integration tests often omit SUPABASE_URL — allow only
  // when not Vercel/prod-without-harness (already checked above).
  if (host != null && !isLocalHostname(host)) {
    return { ok: false, reason: "non_local_supabase" };
  }
  return { ok: true };
}

export function canUseProcessLocalFakeAssetContent(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return assertLocalFakeDeliveryAllowed(env).ok;
}

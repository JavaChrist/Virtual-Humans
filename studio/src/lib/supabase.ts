import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client (service role — never exposed to the browser).
 *
 * All database/storage access happens from Next.js server routes, so we use the
 * service role key for full access. It must only ever live in server env vars
 * (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — never NEXT_PUBLIC_*.
 *
 * When the env is not configured (e.g. a fresh local checkout), helpers fall
 * back gracefully so the app still boots and reports a clear error.
 */

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return Boolean(url && serviceKey);
}

/** Returns the shared server client, or throws a clear error if unconfigured. */
export function supabase(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase non configuré : définis SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local (voir Réglages).",
    );
  }
  if (!client) {
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Storage bucket that holds product screenshots. */
export const PRODUCT_SCREENS_BUCKET = "product-screens";

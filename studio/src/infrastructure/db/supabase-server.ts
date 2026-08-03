/**
 * Server-only Supabase client factory for V2 persistence (VHS-113).
 * Repositories receive an injected client — they never read env themselves.
 *
 * Note: `database.types.ts` is hand-maintained for documentation / future
 * `supabase gen types`. Until then, V2DbClient is an untyped SupabaseClient
 * to avoid incomplete generic `never` Insert/Update inference.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type V2SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  workspaceId: string;
};

/** Untyped client — table shapes documented in database.types.ts */
export type V2DbClient = SupabaseClient;

export class V2SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V2SupabaseConfigError";
  }
}

/** Validate config without echoing secret values. */
export function parseV2SupabaseConfig(env: Record<string, string | undefined>): V2SupabaseConfig {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const workspaceId = env.DIRECTOR_V2_WORKSPACE_ID?.trim();

  if (!url) {
    throw new V2SupabaseConfigError("SUPABASE_URL manquant pour la persistance V2.");
  }
  if (!serviceRoleKey) {
    throw new V2SupabaseConfigError(
      "SUPABASE_SERVICE_ROLE_KEY manquant pour la persistance V2."
    );
  }
  if (!workspaceId) {
    throw new V2SupabaseConfigError(
      "DIRECTOR_V2_WORKSPACE_ID manquant — workspace pilote non configuré."
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workspaceId
    )
  ) {
    throw new V2SupabaseConfigError(
      "DIRECTOR_V2_WORKSPACE_ID invalide (UUID attendu)."
    );
  }

  return { url, serviceRoleKey, workspaceId };
}

export function createV2SupabaseClient(config: V2SupabaseConfig): V2DbClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Lazy production helper — call only from server routes / workers.
 * Does not replace lib/supabase.ts (historical studios).
 */
let cached: { client: V2DbClient; workspaceId: string } | null = null;

export function getV2SupabaseFromEnv(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): {
  client: V2DbClient;
  workspaceId: string;
} {
  if (cached) return cached;
  const config = parseV2SupabaseConfig(env);
  cached = {
    client: createV2SupabaseClient(config),
    workspaceId: config.workspaceId,
  };
  return cached;
}

/** Test-only reset of the lazy cache. */
export function resetV2SupabaseCacheForTests(): void {
  cached = null;
}

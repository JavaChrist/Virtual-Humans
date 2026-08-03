/**
 * Selects AssetContentPort backend (VHS-127 / Porte 1).
 *
 * Priority:
 * 1. Explicit dependency injection (tests)
 * 2. E2E fake + local gate + ASSET_STORAGE≠1 → process memory (Phase 8/9)
 * 3. Supabase configured + (persistence OR E2E_ASSET_STORAGE) → durable Storage
 * 4. Local fake gate (Docker) without durable config → memory (local-only)
 * 5. Otherwise → unconfigured (fail-closed)
 *
 * Memory is never selected on Vercel / remote Supabase / production without E2E harness
 * (enforced by canUseProcessLocalFakeAssetContent).
 */

import {
  createMemoryAssetContentPort,
  createUnconfiguredAssetContentPort,
  type AssetContentBackend,
  type AssetContentPort,
} from "@/application/postproduction/asset-content-port";
import {
  canUseDirectorV2Persistence,
  parseStrictEnabledFlag,
} from "@/infrastructure/config/feature-flags";
import { canUseProcessLocalFakeAssetContent } from "@/infrastructure/config/local-fake-delivery";
import { isDirectorE2eFakeMode } from "./e2e-fake-mode";
import { createSupabaseStorageAssetContentPort } from "@/infrastructure/storage/supabase-asset-content-port";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolveAssetContentBackendOptions = {
  env?: Record<string, string | undefined>;
  /** Injected client for durable Storage (tests / director-server). */
  supabaseClient?: SupabaseClient | null;
  /** Factory when supabaseClient omitted — must not log secrets. */
  getSupabaseClient?: () => SupabaseClient;
  /** Test override for shared memory store. */
  memoryPort?: AssetContentPort;
};

function hasSupabaseCredentials(env: Record<string, string | undefined>): boolean {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return Boolean(url && key);
}

export function wantsE2eProcessMemory(
  env: Record<string, string | undefined>,
): boolean {
  return (
    canUseProcessLocalFakeAssetContent(env) &&
    isDirectorE2eFakeMode(env) &&
    !parseStrictEnabledFlag(env.DIRECTOR_V2_E2E_ASSET_STORAGE)
  );
}

export function canUseDurableAssetContent(
  env: Record<string, string | undefined>,
): boolean {
  if (!hasSupabaseCredentials(env)) return false;
  if (canUseDirectorV2Persistence(env)) return true;
  // Explicit E2E Storage proof path (local only — gate already blocks remote).
  if (
    parseStrictEnabledFlag(env.DIRECTOR_V2_E2E_ASSET_STORAGE) &&
    canUseProcessLocalFakeAssetContent(env)
  ) {
    return true;
  }
  return false;
}

export function resolveAssetContentBackend(
  options: ResolveAssetContentBackendOptions = {},
): AssetContentBackend {
  const env =
    options.env ?? (process.env as Record<string, string | undefined>);

  if (wantsE2eProcessMemory(env)) {
    return options.memoryPort ?? createMemoryAssetContentPort();
  }

  if (canUseDurableAssetContent(env)) {
    const client =
      options.supabaseClient ??
      (options.getSupabaseClient ? options.getSupabaseClient() : null);
    if (!client) {
      return createUnconfiguredAssetContentPort();
    }
    return createSupabaseStorageAssetContentPort({ client });
  }

  if (canUseProcessLocalFakeAssetContent(env)) {
    return options.memoryPort ?? createMemoryAssetContentPort();
  }

  return createUnconfiguredAssetContentPort();
}

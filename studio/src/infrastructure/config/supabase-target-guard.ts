/**
 * Dev / local fail-closed guard against accidental Supabase Production use.
 *
 * Phase 10A-B (R-10A-02): prevent
 *   developer thinks LOCAL → SUPABASE_URL points Production → mutation
 *
 * Does NOT rely on NODE_ENV alone.
 * Deployed Vercel may use remote without opt-in.
 * Non-Vercel processes require localhost OR explicit VH_ALLOW_REMOTE_SUPABASE=1|true.
 */

import { parseStrictEnabledFlag } from "@/infrastructure/config/feature-flags";

export type SupabaseTargetKind =
  | "missing"
  | "local"
  | "remote_supabase"
  | "other";

export type SupabaseTargetClassification = {
  kind: SupabaseTargetKind;
  /** Hostname only — never the full URL with credentials. */
  host: string | null;
};

export type DevSupabaseGuardResult =
  | { ok: true; classification: SupabaseTargetClassification; mode: "local" | "missing" | "vercel" | "remote_explicit" }
  | {
      ok: false;
      reason: "remote_without_allow" | "invalid_url";
      classification: SupabaseTargetClassification;
      publicMessage: string;
    };

function isLocalHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function isVercelRuntime(
  env: Record<string, string | undefined>,
): boolean {
  return env.VERCEL === "1" || (env.VERCEL_ENV != null && env.VERCEL_ENV !== "");
}

/**
 * Classify SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL without logging secrets.
 */
export function classifySupabaseTarget(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): SupabaseTargetClassification {
  const raw = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  if (!raw) return { kind: "missing", host: null };
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    return { kind: "other", host: null };
  }
  if (isLocalHostname(host)) return { kind: "local", host };
  if (host.endsWith(".supabase.co") || host === "supabase.co") {
    return { kind: "remote_supabase", host };
  }
  return { kind: "other", host };
}

/**
 * Fail-closed for non-Vercel runtimes when SUPABASE_URL is non-local
 * unless VH_ALLOW_REMOTE_SUPABASE is explicitly enabled.
 */
export function assertDevSupabaseTargetAllowed(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): DevSupabaseGuardResult {
  const classification = classifySupabaseTarget(env);
  if (classification.kind === "missing") {
    return { ok: true, classification, mode: "missing" };
  }
  if (classification.host == null && classification.kind === "other") {
    return {
      ok: false,
      reason: "invalid_url",
      classification,
      publicMessage:
        "SUPABASE_URL invalide — impossible de classer la cible (fail-closed).",
    };
  }
  if (classification.kind === "local") {
    return { ok: true, classification, mode: "local" };
  }
  if (isVercelRuntime(env)) {
    return { ok: true, classification, mode: "vercel" };
  }
  if (parseStrictEnabledFlag(env.VH_ALLOW_REMOTE_SUPABASE)) {
    return { ok: true, classification, mode: "remote_explicit" };
  }
  return {
    ok: false,
    reason: "remote_without_allow",
    classification,
    publicMessage:
      "SUPABASE_URL non local détecté hors Vercel. " +
      "Le développement standard doit utiliser Supabase Docker (127.0.0.1). " +
      "Pour un accès distant volontaire, définir VH_ALLOW_REMOTE_SUPABASE=1 " +
      "(jamais par défaut).",
  };
}

export class DevSupabaseTargetError extends Error {
  readonly reason: "remote_without_allow" | "invalid_url";
  readonly host: string | null;

  constructor(result: Extract<DevSupabaseGuardResult, { ok: false }>) {
    super(result.publicMessage);
    this.name = "DevSupabaseTargetError";
    this.reason = result.reason;
    this.host = result.classification.host;
  }
}

/** Throw DevSupabaseTargetError when the guard refuses the target. */
export function requireDevSupabaseTargetAllowed(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): void {
  const result = assertDevSupabaseTargetAllowed(env);
  if (!result.ok) throw new DevSupabaseTargetError(result);
}

/**
 * Centralized server-side feature flags (VHS-112 / VHS-114).
 * Never read DIRECTOR_* / worker env outside this module.
 * Never use NEXT_PUBLIC_* for these flags.
 */

export type FeatureFlagName =
  | "directorV2"
  | "directorV2Worker"
  | "directorV2PaidGeneration"
  | "directorV2Persistence"
  | "directorV2MarketingAi"
  | "directorV2CreativeAi"
  | "directorV2ScriptAi"
  | "directorV2ArtAi"
  | "directorV2StoryboardAi"
  | "directorV2PaidAi";

/**
 * Strict boolean parse: only "1" or "true" (trimmed, case-insensitive) → on.
 * Absent, empty, "0", "false", or any other value → off.
 */
export function parseStrictEnabledFlag(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** @deprecated alias — prefer parseStrictEnabledFlag */
export function parseDirectorV2Enabled(raw: string | undefined | null): boolean {
  return parseStrictEnabledFlag(raw);
}

export function isDirectorV2Enabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_ENABLED);
}

export function isDirectorV2WorkerEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_WORKER_ENABLED);
}

export function isDirectorV2PaidGenerationEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_PAID_GENERATION_ENABLED);
}

export function isDirectorV2PersistenceEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_PERSISTENCE_ENABLED);
}

/**
 * Marketing text AI adapter (VHS-117A). Server-only.
 * Distinct from DIRECTOR_V2_PAID_GENERATION_ENABLED (media generation).
 */
export function isDirectorV2MarketingAiEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_MARKETING_AI_ENABLED);
}

/**
 * Paid text AI kill switch (VHS-117A). Server-only.
 * Not an alias of DIRECTOR_V2_PAID_GENERATION_ENABLED.
 */
export function isDirectorV2PaidAiEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_PAID_AI_ENABLED);
}

/**
 * Creative text AI adapter (VHS-118A). Server-only.
 * Distinct from DIRECTOR_V2_PAID_GENERATION_ENABLED (media generation).
 */
export function isDirectorV2CreativeAiEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_CREATIVE_AI_ENABLED);
}

/** Script text AI adapter (VHS-119A). Server-only. */
export function isDirectorV2ScriptAiEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_SCRIPT_AI_ENABLED);
}

/** Art text AI adapter (VHS-120A). Server-only. */
export function isDirectorV2ArtAiEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_ART_AI_ENABLED);
}

/** Storyboard text AI adapter (VHS-121A). Server-only. */
export function isDirectorV2StoryboardAiEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return parseStrictEnabledFlag(env.DIRECTOR_V2_STORYBOARD_AI_ENABLED);
}

/**
 * Persistent director project create/list/resume requires both UI flag and persistence flag.
 */
export function canUseDirectorV2Persistence(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return isDirectorV2Enabled(env) && isDirectorV2PersistenceEnabled(env);
}

/**
 * Real Marketing AI call requires both marketing + paid text AI flags.
 * Media generation remains gated by worker + paid generation separately.
 */
export function canExecuteMarketingAi(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return isDirectorV2MarketingAiEnabled(env) && isDirectorV2PaidAiEnabled(env);
}

/**
 * Real Creative AI call requires both creative + paid text AI flags.
 */
export function canExecuteCreativeAi(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return isDirectorV2CreativeAiEnabled(env) && isDirectorV2PaidAiEnabled(env);
}

/** Real Script AI call requires both Script AI and paid text AI flags. */
export function canExecuteScriptAi(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return isDirectorV2ScriptAiEnabled(env) && isDirectorV2PaidAiEnabled(env);
}

/** Real Art AI call requires both Art AI and paid text AI flags. */
export function canExecuteArtAi(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return isDirectorV2ArtAiEnabled(env) && isDirectorV2PaidAiEnabled(env);
}

/** Real Storyboard AI call requires both Storyboard AI and paid text AI flags. */
export function canExecuteStoryboardAi(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  return isDirectorV2StoryboardAiEnabled(env) && isDirectorV2PaidAiEnabled(env);
}

export type FeatureFlagsSnapshot = {
  directorV2: boolean;
  directorV2Worker: boolean;
  directorV2PaidGeneration: boolean;
  directorV2Persistence: boolean;
  directorV2MarketingAi: boolean;
  directorV2CreativeAi: boolean;
  /** Optional for compatibility with pre-VHS-119 injected test snapshots. */
  directorV2ScriptAi?: boolean;
  /** Optional for compatibility with pre-VHS-120 injected test snapshots. */
  directorV2ArtAi?: boolean;
  /** Optional for compatibility with pre-VHS-121 injected test snapshots. */
  directorV2StoryboardAi?: boolean;
  directorV2PaidAi: boolean;
};

export function getFeatureFlags(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): FeatureFlagsSnapshot {
  return {
    directorV2: isDirectorV2Enabled(env),
    directorV2Worker: isDirectorV2WorkerEnabled(env),
    directorV2PaidGeneration: isDirectorV2PaidGenerationEnabled(env),
    directorV2Persistence: isDirectorV2PersistenceEnabled(env),
    directorV2MarketingAi: isDirectorV2MarketingAiEnabled(env),
    directorV2CreativeAi: isDirectorV2CreativeAiEnabled(env),
    directorV2ScriptAi: isDirectorV2ScriptAiEnabled(env),
    directorV2ArtAi: isDirectorV2ArtAiEnabled(env),
    directorV2StoryboardAi: isDirectorV2StoryboardAiEnabled(env),
    directorV2PaidAi: isDirectorV2PaidAiEnabled(env),
  };
}

/** Real provider execution requires worker + paid generation. */
export function canExecutePaidGeneration(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): boolean {
  const f = getFeatureFlags(env);
  return f.directorV2Worker && f.directorV2PaidGeneration;
}

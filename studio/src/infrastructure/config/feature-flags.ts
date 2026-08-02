/**
 * Centralized server-side feature flags (VHS-112).
 * Never read process.env.DIRECTOR_* outside this module.
 */

export type FeatureFlagName = "directorV2";

/**
 * Parse DIRECTOR_V2_ENABLED.
 * Enabled only when the trimmed value (case-insensitive) is exactly "1" or "true".
 * Absent, empty, "0", "false", or any other value → disabled.
 */
export function parseDirectorV2Enabled(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** Read the live env once (server-only). Default: disabled. */
export function isDirectorV2Enabled(): boolean {
  return parseDirectorV2Enabled(process.env.DIRECTOR_V2_ENABLED);
}

export function getFeatureFlags(): { directorV2: boolean } {
  return { directorV2: isDirectorV2Enabled() };
}

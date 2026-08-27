/**
 * App version contract — isomorphic (no fs, no secrets).
 * Server reads SDK_VERSION separately; this file only shapes/parses public JSON.
 */

export const APP_VERSION_UNAVAILABLE = "unavailable" as const;
export const APP_VERSION_PATH = "/api/version" as const;
export const APP_VERSION_CACHE_CONTROL = "no-store, max-age=0" as const;
export const APP_VERSION_CDN_CACHE_CONTROL = "no-store" as const;

export const APP_VERSION_JSON_KEYS = [
  "version",
  "gitSha",
  "gitShaShort",
  "buildId",
  "environment",
  "deployedAt",
] as const;

const GIT_SHA_RE = /^[0-9a-f]{40}$/;
const GIT_SHA_SHORT_RE = /^[0-9a-f]{7}$/;

export type AppVersionEnvironment = "production" | "preview" | "development";

export type AppVersion = {
  version: string;
  gitSha: string;
  gitShaShort: string;
  buildId: string;
  environment: AppVersionEnvironment;
  deployedAt: null;
};

function normalizeHex(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidGitSha(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && GIT_SHA_RE.test(normalizeHex(raw));
}

export function mapAppVersionEnvironment(
  raw: string | undefined | null,
): AppVersionEnvironment {
  if (raw === "production" || raw === "preview") return raw;
  return "development";
}

export function shortGitSha(gitSha: string): string {
  const sha = normalizeHex(gitSha);
  if (!GIT_SHA_RE.test(sha)) return APP_VERSION_UNAVAILABLE;
  return sha.slice(0, 7);
}

export function resolveAppVersion(input: {
  sdkVersion?: string | null;
  gitSha?: string | null;
  deploymentId?: string | null;
  vercelEnv?: string | null;
}): AppVersion {
  const version =
    input.sdkVersion && input.sdkVersion.trim()
      ? input.sdkVersion.trim()
      : APP_VERSION_UNAVAILABLE;
  const gitSha = isValidGitSha(input.gitSha)
    ? normalizeHex(input.gitSha)
    : APP_VERSION_UNAVAILABLE;
  const deploymentId = input.deploymentId?.trim() || "";
  const buildId = deploymentId
    ? deploymentId
    : gitSha !== APP_VERSION_UNAVAILABLE
      ? gitSha
      : APP_VERSION_UNAVAILABLE;
  return {
    version,
    gitSha,
    gitShaShort: shortGitSha(gitSha),
    buildId,
    environment: mapAppVersionEnvironment(input.vercelEnv),
    deployedAt: null,
  };
}

export function parseAppVersionPayload(raw: unknown): AppVersion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  for (const key of APP_VERSION_JSON_KEYS) {
    if (!(key in rec)) return null;
  }
  if (typeof rec.version !== "string" || !rec.version.trim()) return null;
  if (typeof rec.gitSha !== "string") return null;
  if (typeof rec.gitShaShort !== "string") return null;
  if (typeof rec.buildId !== "string") return null;
  if (
    rec.environment !== "production" &&
    rec.environment !== "preview" &&
    rec.environment !== "development"
  ) {
    return null;
  }
  if (rec.deployedAt !== null) return null;
  const gitSha = rec.gitSha;
  if (gitSha !== APP_VERSION_UNAVAILABLE && !GIT_SHA_RE.test(gitSha)) return null;
  const gitShaShort = rec.gitShaShort;
  if (gitShaShort !== APP_VERSION_UNAVAILABLE && !GIT_SHA_SHORT_RE.test(gitShaShort)) {
    return null;
  }
  if (!rec.buildId.trim()) return null;
  return {
    version: rec.version.trim(),
    gitSha,
    gitShaShort,
    buildId: rec.buildId,
    environment: rec.environment,
    deployedAt: null,
  };
}

export function resolveAppVersionIdentity(payload: Pick<AppVersion, "gitSha" | "buildId">): string | null {
  if (payload.gitSha !== APP_VERSION_UNAVAILABLE && payload.gitSha.length > 0) {
    return payload.gitSha;
  }
  if (payload.buildId !== APP_VERSION_UNAVAILABLE && payload.buildId.length > 0) {
    return payload.buildId;
  }
  return null;
}

/**
 * 1. Compare gitSha when both are valid hex SHAs.
 * 2. Else compare buildId when both are available.
 * 3. Never treat `version` alone as an update.
 */
export function isNewerAppVersion(
  baseline: Pick<AppVersion, "gitSha" | "buildId" | "version">,
  remote: Pick<AppVersion, "gitSha" | "buildId" | "version">,
): boolean {
  const baselineShaOk = isValidGitSha(baseline.gitSha);
  const remoteShaOk = isValidGitSha(remote.gitSha);
  if (baselineShaOk && remoteShaOk) {
    return baseline.gitSha !== remote.gitSha;
  }
  const baselineBuild =
    baseline.buildId !== APP_VERSION_UNAVAILABLE && baseline.buildId.length > 0;
  const remoteBuild =
    remote.buildId !== APP_VERSION_UNAVAILABLE && remote.buildId.length > 0;
  if (baselineBuild && remoteBuild) {
    return baseline.buildId !== remote.buildId;
  }
  return false;
}

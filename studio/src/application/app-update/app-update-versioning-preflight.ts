/**
 * App-update versioning + notification preflight — contract only.
 * No `/api/version` route, no PWA runtime write, no deploy, no flag.
 */

export const APP_UPDATE_PREFLIGHT_AUTH =
  "AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_NO_DEPLOY_NO_FLAG_WRITE" as const;

export const APP_UPDATE_PREFLIGHT_VERDICT =
  "VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_PREFLIGHT_READY" as const;

export const APP_UPDATE_IMPLEMENT_AUTH =
  "AUTH_VHS_APP_UPDATE_VERSIONING_AND_NOTIFICATION_IMPLEMENT_NO_DEPLOY_NO_FLAG_WRITE" as const;

export const APP_VERSION_PATH = "/api/version" as const;
export const APP_VERSION_METHOD = "GET" as const;
export const APP_VERSION_UNAVAILABLE = "unavailable" as const;
export const APP_VERSION_RUNTIME = "nodejs" as const;
export const APP_VERSION_CACHE_CONTROL = "no-store, max-age=0" as const;
export const APP_VERSION_CDN_CACHE_CONTROL = "no-store" as const;
export const APP_VERSION_POLL_MS = 120_000 as const;
export const APP_VERSION_FETCH_CACHE = "no-store" as const;
export const APP_VERSION_FETCH_CREDENTIALS = "omit" as const;
export const APP_UPDATE_CHANNEL = "vhs-app-update" as const;
export const APP_UPDATE_SKIP_WAITING = "SKIP_WAITING" as const;
export const APP_UPDATE_ACK_WAIT_MS = 300 as const;
export const APP_UPDATE_RATE_LIMIT_PER_MIN = 60 as const;
export const APP_VERSION_TRACING_ROUTE = "/api/version/**" as const;
export const APP_VERSION_TRACING_INCLUDE = "../SDK_VERSION" as const;

export const APP_VERSION_JSON_KEYS = [
  "version",
  "gitSha",
  "gitShaShort",
  "buildId",
  "environment",
  "deployedAt",
] as const;

export const APP_VERSION_FORBIDDEN_KEYS = [
  "token",
  "cookie",
  "secret",
  "password",
  "apiKey",
  "connectionString",
  "env",
  "headers",
] as const;

export const APP_UPDATE_UX_STATES = [
  "idle",
  "checking",
  "available",
  "installing",
  "deferred",
  "blocked",
  "offline",
  "check-error",
  "applied",
] as const;

export type AppUpdateUxState = (typeof APP_UPDATE_UX_STATES)[number];

export type AppVersionEnvironment = "production" | "preview" | "development";

export type AppVersionPayload = {
  version: string;
  gitSha: string;
  gitShaShort: string;
  buildId: string;
  environment: AppVersionEnvironment;
  deployedAt: string | null;
};

export const APP_UPDATE_FUTURE_CREATE = [
  "studio/src/app/api/version/route.ts",
  "studio/src/lib/app-version.ts",
  "studio/src/lib/update-blockers.ts",
  "studio/src/application/app-update/__tests__/app-version-route.test.ts",
  "studio/src/lib/__tests__/update-blockers.test.ts",
] as const;

export const APP_UPDATE_FUTURE_MODIFY = [
  "studio/src/proxy.ts",
  "studio/src/lib/rate-limit.ts",
  "studio/file-tracing.ts",
  "studio/next.config.ts",
  "studio/src/components/pwa-register.tsx",
  "studio/src/infrastructure/config/__tests__/file-tracing.test.ts",
] as const;

export const APP_UPDATE_FUTURE_FORBIDDEN = [
  "studio/public/sw.js",
  "studio/public/manifest.webmanifest",
  "studio/src/app/layout.tsx",
  "studio/src/app/api/aiccos/send/route.ts",
  "studio/src/components/send-to-aiccos.tsx",
] as const;

const GIT_SHA_RE = /^[0-9a-f]{40}$/;
const GIT_SHA_SHORT_RE = /^[0-9a-f]{7}$/;

function isUnavailable(value: string): boolean {
  return value === APP_VERSION_UNAVAILABLE;
}

export function mapAppVersionEnvironment(
  raw: string | undefined,
): AppVersionEnvironment {
  if (raw === "production" || raw === "preview") return raw;
  return "development";
}

export function shortGitSha(gitSha: string): string {
  if (isUnavailable(gitSha)) return APP_VERSION_UNAVAILABLE;
  if (!GIT_SHA_RE.test(gitSha)) return APP_VERSION_UNAVAILABLE;
  return gitSha.slice(0, 7);
}

export function resolveAppVersionIdentity(
  payload: Pick<AppVersionPayload, "gitSha" | "buildId">,
): string | null {
  if (!isUnavailable(payload.gitSha) && payload.gitSha.length > 0) {
    return payload.gitSha;
  }
  if (!isUnavailable(payload.buildId) && payload.buildId.length > 0) {
    return payload.buildId;
  }
  return null;
}

export function isNewerAppVersion(
  baseline: Pick<AppVersionPayload, "gitSha" | "buildId">,
  remote: Pick<AppVersionPayload, "gitSha" | "buildId">,
): boolean {
  const left = resolveAppVersionIdentity(baseline);
  const right = resolveAppVersionIdentity(remote);
  if (!left || !right) return false;
  return left !== right;
}

export function buildAppVersionPayload(input: {
  sdkVersion?: string | null;
  gitSha?: string | null;
  deploymentId?: string | null;
  vercelEnv?: string | null;
  deployedAt?: string | null;
}): AppVersionPayload {
  const version =
    input.sdkVersion && input.sdkVersion.trim()
      ? input.sdkVersion.trim()
      : APP_VERSION_UNAVAILABLE;
  const gitSha =
    input.gitSha && GIT_SHA_RE.test(input.gitSha)
      ? input.gitSha
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
    environment: mapAppVersionEnvironment(input.vercelEnv ?? undefined),
    deployedAt: input.deployedAt ?? null,
  };
}

export function assertAppVersionPayloadSafe(payload: AppVersionPayload): void {
  for (const key of APP_VERSION_JSON_KEYS) {
    if (!(key in payload)) {
      throw new Error(`APP_VERSION_MISSING_KEY:${key}`);
    }
  }
  for (const key of Object.keys(payload)) {
    if (!(APP_VERSION_JSON_KEYS as readonly string[]).includes(key)) {
      throw new Error(`APP_VERSION_UNKNOWN_KEY:${key}`);
    }
    if ((APP_VERSION_FORBIDDEN_KEYS as readonly string[]).includes(key)) {
      throw new Error(`APP_VERSION_FORBIDDEN_KEY:${key}`);
    }
  }
  if (payload.gitSha !== APP_VERSION_UNAVAILABLE && !GIT_SHA_RE.test(payload.gitSha)) {
    throw new Error("APP_VERSION_INVALID_GIT_SHA");
  }
  if (
    payload.gitShaShort !== APP_VERSION_UNAVAILABLE &&
    !GIT_SHA_SHORT_RE.test(payload.gitShaShort)
  ) {
    throw new Error("APP_VERSION_INVALID_GIT_SHA_SHORT");
  }
  if (
    payload.environment !== "production" &&
    payload.environment !== "preview" &&
    payload.environment !== "development"
  ) {
    throw new Error("APP_VERSION_INVALID_ENVIRONMENT");
  }
  if (payload.deployedAt !== null) {
    throw new Error("APP_VERSION_DEPLOYED_AT_MUST_BE_NULL");
  }
}

export function assertAppUpdatePreflightAuthChain(): void {
  if (APP_UPDATE_PREFLIGHT_AUTH.includes("IMPLEMENT")) {
    throw new Error("PREFLIGHT_AUTH_MUST_NOT_IMPLEMENT");
  }
  if (!APP_UPDATE_IMPLEMENT_AUTH.includes("IMPLEMENT")) {
    throw new Error("NEXT_AUTH_MUST_BE_IMPLEMENT");
  }
}

export function buildAppUpdateVersioningPreflight(): {
  auth: typeof APP_UPDATE_PREFLIGHT_AUTH;
  verdict: typeof APP_UPDATE_PREFLIGHT_VERDICT;
  nextAuth: typeof APP_UPDATE_IMPLEMENT_AUTH;
  runtimeFilesChanged: 0;
  apiRoutesCreated: 0;
  serviceWorkerWrites: 0;
  deployCalls: 0;
  flagWrites: 0;
  needsNewFlag: false;
  needsMigration: false;
  routeExistsThisGate: false;
} {
  assertAppUpdatePreflightAuthChain();
  return {
    auth: APP_UPDATE_PREFLIGHT_AUTH,
    verdict: APP_UPDATE_PREFLIGHT_VERDICT,
    nextAuth: APP_UPDATE_IMPLEMENT_AUTH,
    runtimeFilesChanged: 0,
    apiRoutesCreated: 0,
    serviceWorkerWrites: 0,
    deployCalls: 0,
    flagWrites: 0,
    needsNewFlag: false,
    needsMigration: false,
    routeExistsThisGate: false,
  };
}

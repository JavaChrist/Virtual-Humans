/**
 * App-update versioning preflight — locks the contract, not the future route.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  APP_UPDATE_ACK_WAIT_MS,
  APP_UPDATE_CHANNEL,
  APP_UPDATE_FUTURE_CREATE,
  APP_UPDATE_FUTURE_FORBIDDEN,
  APP_UPDATE_FUTURE_MODIFY,
  APP_UPDATE_IMPLEMENT_AUTH,
  APP_UPDATE_PREFLIGHT_AUTH,
  APP_UPDATE_PREFLIGHT_VERDICT,
  APP_UPDATE_SKIP_WAITING,
  APP_UPDATE_UX_STATES,
  APP_VERSION_CACHE_CONTROL,
  APP_VERSION_CDN_CACHE_CONTROL,
  APP_VERSION_FETCH_CACHE,
  APP_VERSION_FETCH_CREDENTIALS,
  APP_VERSION_FORBIDDEN_KEYS,
  APP_VERSION_JSON_KEYS,
  APP_VERSION_METHOD,
  APP_VERSION_PATH,
  APP_VERSION_POLL_MS,
  APP_VERSION_RUNTIME,
  APP_VERSION_TRACING_INCLUDE,
  APP_VERSION_TRACING_ROUTE,
  APP_VERSION_UNAVAILABLE,
  assertAppVersionPayloadSafe,
  buildAppUpdateVersioningPreflight,
  buildAppVersionPayload,
  isNewerAppVersion,
  resolveAppVersionIdentity,
  shortGitSha,
} from "../app-update-versioning-preflight";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");
const studioRoot = join(repoRoot, "studio");

test("APP-UPDATE-PREFLIGHT — READY without flag or migration", () => {
  const plan = buildAppUpdateVersioningPreflight();
  assert.equal(plan.auth, APP_UPDATE_PREFLIGHT_AUTH);
  assert.equal(plan.verdict, APP_UPDATE_PREFLIGHT_VERDICT);
  assert.equal(plan.nextAuth, APP_UPDATE_IMPLEMENT_AUTH);
  assert.equal(plan.needsNewFlag, false);
  assert.equal(plan.needsMigration, false);
  assert.equal(plan.runtimeFilesChanged, 0);
  assert.equal(plan.apiRoutesCreated, 0);
  assert.equal(plan.serviceWorkerWrites, 0);
  assert.equal(plan.deployCalls, 0);
  assert.equal(plan.flagWrites, 0);
  assert.equal(plan.routeExistsThisGate, false);
});

test("APP-UPDATE-PREFLIGHT — JSON keys, sentinels and sources", () => {
  assert.deepEqual([...APP_VERSION_JSON_KEYS], [
    "version",
    "gitSha",
    "gitShaShort",
    "buildId",
    "environment",
    "deployedAt",
  ]);
  const full = buildAppVersionPayload({
    sdkVersion: "1.0.0",
    gitSha: "c808fa25d684fe1835bb574e8625cda1ea686096",
    deploymentId: "dpl_EUEqB8ZzrKWULgG5YFyA1M9jTGxH",
    vercelEnv: "production",
  });
  assertAppVersionPayloadSafe(full);
  assert.equal(full.version, "1.0.0");
  assert.equal(full.gitShaShort, "c808fa2");
  assert.equal(full.environment, "production");
  assert.equal(full.deployedAt, null);

  const missing = buildAppVersionPayload({});
  assertAppVersionPayloadSafe(missing);
  assert.equal(missing.version, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.gitSha, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.gitShaShort, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.buildId, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.environment, "development");
  assert.equal(shortGitSha("not-a-sha"), APP_VERSION_UNAVAILABLE);
  assert.ok(!APP_VERSION_FORBIDDEN_KEYS.includes("version" as never));
});

test("APP-UPDATE-PREFLIGHT — compare SHA then buildId, never version-only", () => {
  const a = buildAppVersionPayload({
    sdkVersion: "1.0.0",
    gitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  const b = buildAppVersionPayload({
    sdkVersion: "1.0.0",
    gitSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  assert.equal(isNewerAppVersion(a, a), false);
  assert.equal(isNewerAppVersion(a, b), true);
  const noSha = buildAppVersionPayload({
    sdkVersion: "2.0.0",
    deploymentId: "dpl_new",
  });
  const noShaOld = buildAppVersionPayload({
    sdkVersion: "1.0.0",
    deploymentId: "dpl_old",
  });
  assert.equal(resolveAppVersionIdentity(noSha), "dpl_new");
  assert.equal(isNewerAppVersion(noShaOld, noSha), true);
  const versionOnly = buildAppVersionPayload({ sdkVersion: "9.9.9" });
  assert.equal(resolveAppVersionIdentity(versionOnly), null);
  assert.equal(isNewerAppVersion(a, versionOnly), false);
});

test("APP-UPDATE-PREFLIGHT — public GET headers, Node runtime, tracing glob", () => {
  assert.equal(APP_VERSION_PATH, "/api/version");
  assert.equal(APP_VERSION_METHOD, "GET");
  assert.equal(APP_VERSION_RUNTIME, "nodejs");
  assert.equal(APP_VERSION_CACHE_CONTROL, "no-store, max-age=0");
  assert.equal(APP_VERSION_CDN_CACHE_CONTROL, "no-store");
  assert.equal(APP_VERSION_POLL_MS, 120_000);
  assert.equal(APP_VERSION_FETCH_CACHE, "no-store");
  assert.equal(APP_VERSION_FETCH_CREDENTIALS, "omit");
  assert.equal(APP_UPDATE_CHANNEL, "vhs-app-update");
  assert.equal(APP_UPDATE_SKIP_WAITING, "SKIP_WAITING");
  assert.equal(APP_UPDATE_ACK_WAIT_MS, 300);
  assert.equal(APP_VERSION_TRACING_ROUTE, "/api/version/**");
  assert.equal(APP_VERSION_TRACING_INCLUDE, "../SDK_VERSION");
  assert.ok(!APP_UPDATE_FUTURE_CREATE.includes("studio/public/sw.js" as never));
});

test("APP-UPDATE-PREFLIGHT — UX states and future file lists", () => {
  assert.deepEqual([...APP_UPDATE_UX_STATES], [
    "idle",
    "checking",
    "available",
    "installing",
    "deferred",
    "blocked",
    "offline",
    "check-error",
    "applied",
  ]);
  assert.ok(APP_UPDATE_FUTURE_CREATE.includes("studio/src/app/api/version/route.ts"));
  assert.ok(APP_UPDATE_FUTURE_MODIFY.includes("studio/src/components/pwa-register.tsx"));
  assert.ok(APP_UPDATE_FUTURE_MODIFY.includes("studio/src/proxy.ts"));
  assert.ok(APP_UPDATE_FUTURE_FORBIDDEN.includes("studio/public/sw.js"));
  assert.ok(
    APP_UPDATE_FUTURE_FORBIDDEN.includes("studio/src/app/api/aiccos/send/route.ts"),
  );
});

test("APP-UPDATE-PREFLIGHT — this gate did not create the route or rewrite PWA", () => {
  assert.equal(
    existsSync(join(studioRoot, "src", "app", "api", "version", "route.ts")),
    false,
  );
  const proxy = readFileSync(join(studioRoot, "src", "proxy.ts"), "utf8");
  assert.match(proxy, /function isPublicPath/);
  assert.doesNotMatch(proxy, /\/api\/version/);
  const pwa = readFileSync(
    join(studioRoot, "src", "components", "pwa-register.tsx"),
    "utf8",
  );
  assert.match(pwa, /Mise à jour disponible/);
  assert.match(pwa, /SKIP_WAITING/);
  assert.doesNotMatch(pwa, /\/api\/version/);
});

test("APP-UPDATE-PREFLIGHT — SW never intercepts /api and layout has one PWA mount", () => {
  const sw = readFileSync(join(studioRoot, "public", "sw.js"), "utf8");
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)\) return/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  const layout = readFileSync(join(studioRoot, "src", "app", "layout.tsx"), "utf8");
  assert.match(layout, /import \{ PwaRegister \}/);
  assert.equal(layout.split("<PwaRegister").length - 1, 1);
});

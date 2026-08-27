import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { GET, buildVersionResponse } from "@/app/api/version/route";
import { readSdkVersionFile } from "@/lib/app-version-fs";
import { APP_VERSION_CACHE_CONTROL, APP_VERSION_UNAVAILABLE } from "@/lib/app-version";
import { isPublicPath, shouldApplyRateLimit } from "@/proxy";
import { RATE_LIMITS } from "@/lib/rate-limit";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..", "..");

test("app-version-fs — lit SDK_VERSION ou fallback null", () => {
  const fromRepo = readSdkVersionFile(repoRoot);
  assert.match(fromRepo ?? "", /^\d+\.\d+\.\d+$/);
  const empty = mkdtempSync(join(tmpdir(), "vhs-ver-"));
  assert.equal(readSdkVersionFile(empty), null);
  writeFileSync(join(empty, "SDK_VERSION"), "  1.2.3  \n");
  assert.equal(readSdkVersionFile(empty), "1.2.3");
});

test("GET /api/version — headers no-store, JSON public, deployedAt null", async () => {
  const prevSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const prevEnv = process.env.VERCEL_ENV;
  const prevId = process.env.VERCEL_DEPLOYMENT_ID;
  process.env.VERCEL_GIT_COMMIT_SHA = "c808fa25d684fe1835bb574e8625cda1ea686096";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_DEPLOYMENT_ID = "dpl_test_local";
  try {
    const res = await GET();
    assert.equal(res.headers.get("Cache-Control"), APP_VERSION_CACHE_CONTROL);
    assert.equal(res.headers.get("CDN-Cache-Control"), "no-store");
    assert.equal(res.headers.get("Vercel-CDN-Cache-Control"), "no-store");
    assert.equal(res.headers.get("Set-Cookie"), null);
    const json = (await res.json()) as Record<string, unknown>;
    assert.equal(json.deployedAt, null);
    assert.equal(typeof json.version, "string");
    assert.equal(typeof json.gitSha, "string");
    assert.ok(!("token" in json));
    assert.ok(!("env" in json));
    assert.ok(!("cookie" in json));
    const built = buildVersionResponse();
    assert.equal(built.environment, "production");
    assert.equal(built.gitShaShort, "c808fa2");
  } finally {
    if (prevSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = prevSha;
    if (prevEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevEnv;
    if (prevId === undefined) delete process.env.VERCEL_DEPLOYMENT_ID;
    else process.env.VERCEL_DEPLOYMENT_ID = prevId;
  }
});

test("GET /api/version — SHA invalide → unavailable", () => {
  const prev = process.env.VERCEL_GIT_COMMIT_SHA;
  process.env.VERCEL_GIT_COMMIT_SHA = "not-valid";
  try {
    assert.equal(buildVersionResponse().gitSha, APP_VERSION_UNAVAILABLE);
  } finally {
    if (prev === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = prev;
  }
});

test("proxy — GET /api/version public, autres API protégées, rate limit GET version", () => {
  assert.equal(isPublicPath("/api/version", "GET"), true);
  assert.equal(isPublicPath("/api/version", "POST"), false);
  assert.equal(isPublicPath("/api/budget", "GET"), false);
  assert.equal(isPublicPath("/api/settings", "GET"), false);
  assert.equal(isPublicPath("/api/generate/image", "POST"), false);
  assert.equal(shouldApplyRateLimit("/api/version", "GET"), true);
  assert.equal(shouldApplyRateLimit("/api/budget", "GET"), false);
  assert.equal(shouldApplyRateLimit("/api/login", "POST"), true);
  assert.ok(RATE_LIMITS.version.limit >= 120);
  const proxySrc = readFileSync(join(repoRoot, "studio", "src", "proxy.ts"), "utf8");
  assert.match(proxySrc, /pathname === "\/api\/version" && method === "GET"/);
  assert.doesNotMatch(proxySrc, /pathname\.startsWith\("\/api\/"\) && method === "GET"\) return true/);
});

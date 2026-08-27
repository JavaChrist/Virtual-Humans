import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_VERSION_UNAVAILABLE,
  isNewerAppVersion,
  parseAppVersionPayload,
  resolveAppVersion,
  shortGitSha,
} from "../app-version";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

test("app-version — SHA valide, short, buildId et environnements", () => {
  const prod = resolveAppVersion({
    sdkVersion: "1.0.0",
    gitSha: SHA_A,
    deploymentId: "dpl_test",
    vercelEnv: "production",
  });
  assert.equal(prod.version, "1.0.0");
  assert.equal(prod.gitSha, SHA_A);
  assert.equal(prod.gitShaShort, "aaaaaaa");
  assert.equal(prod.buildId, "dpl_test");
  assert.equal(prod.environment, "production");
  assert.equal(prod.deployedAt, null);
  assert.equal(shortGitSha(SHA_A), "aaaaaaa");

  assert.equal(
    resolveAppVersion({ vercelEnv: "preview" }).environment,
    "preview",
  );
  assert.equal(resolveAppVersion({}).environment, "development");
});

test("app-version — fallbacks unavailable, SHA invalide, buildId = SHA", () => {
  const missing = resolveAppVersion({});
  assert.equal(missing.version, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.gitSha, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.gitShaShort, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.buildId, APP_VERSION_UNAVAILABLE);
  assert.equal(missing.deployedAt, null);

  const badSha = resolveAppVersion({ gitSha: "not-a-sha", sdkVersion: "  " });
  assert.equal(badSha.gitSha, APP_VERSION_UNAVAILABLE);
  assert.equal(badSha.version, APP_VERSION_UNAVAILABLE);

  const shaOnly = resolveAppVersion({ gitSha: SHA_A });
  assert.equal(shaOnly.buildId, SHA_A);
});

test("app-version — parse strict, deployedAt null, extras ignorés comme invalides", () => {
  const ok = parseAppVersionPayload({
    version: "1.0.0",
    gitSha: SHA_A,
    gitShaShort: "aaaaaaa",
    buildId: "dpl_1",
    environment: "production",
    deployedAt: null,
  });
  assert.ok(ok);
  assert.equal(ok?.deployedAt, null);
  assert.equal(parseAppVersionPayload(null), null);
  assert.equal(parseAppVersionPayload("nope"), null);
  assert.equal(
    parseAppVersionPayload({
      version: "1.0.0",
      gitSha: "short",
      gitShaShort: "aaaaaaa",
      buildId: "x",
      environment: "production",
      deployedAt: null,
    }),
    null,
  );
  assert.equal(
    parseAppVersionPayload({
      version: "1.0.0",
      gitSha: SHA_A,
      gitShaShort: "aaaaaaa",
      buildId: "x",
      environment: "production",
      deployedAt: "2026-01-01T00:00:00Z",
    }),
    null,
  );
});

test("app-version — compare SHA puis buildId, jamais version seule", () => {
  const a = resolveAppVersion({ sdkVersion: "1.0.0", gitSha: SHA_A });
  const b = resolveAppVersion({ sdkVersion: "1.0.0", gitSha: SHA_B });
  assert.equal(isNewerAppVersion(a, a), false);
  assert.equal(isNewerAppVersion(a, b), true);
  const sameShaNewDeploy = resolveAppVersion({
    gitSha: SHA_A,
    deploymentId: "dpl_new",
  });
  assert.equal(isNewerAppVersion(a, sameShaNewDeploy), false);

  const oldBuild = resolveAppVersion({ deploymentId: "dpl_old" });
  const newBuild = resolveAppVersion({ deploymentId: "dpl_new" });
  assert.equal(isNewerAppVersion(oldBuild, newBuild), true);

  const v1 = resolveAppVersion({ sdkVersion: "1.0.0" });
  const v2 = resolveAppVersion({ sdkVersion: "9.9.9" });
  assert.equal(isNewerAppVersion(v1, v2), false);
});

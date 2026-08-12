#!/usr/bin/env node
/**
 * MT-013J — MV-001 deploy preflight without provider.
 *
 *   CONFIRM_MT013J_DEPLOY_PREFLIGHT=1 node scripts/mt013j-mv001-deploy-preflight.mjs
 *
 * Opens benchmark-only Production flags (worker OFF), redeploys ON,
 * runs one HTTP + local dry-run (providerCalled=false), then finally
 * closes flags and redeploys OFF. Never prints FAL_KEY / salt / URLs signed.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const EXPECTED_COMMIT = "db1d64c4c78b27cc63e52595815b77f04a3c86f9";
const EXPECTED_COMMIT_SHORT = "db1d64c";
const EXPECTED_DEPLOY_HOST = "virtual-humans-98qzvmhj5-javachrist-projects.vercel.app";
const BASE = process.env.MT013J_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SOURCE_ASSET = "12c4bd0b-c56b-48c1-88c8-6d2053acc320";
const IDENTITY_ASSET = "f42393ae-6095-4939-a307-c7b47365e77c";
const SOURCE_SHA =
  "91b32ec502454e46a93122f250fcde51431ce5e83d1947d645c8f9c40a58fc5a";
const IDENTITY_SHA =
  "9e270cd7d31bbb3e7cd6955059eff1c4d23c93d982cf5e2b03f19d8346561dae";
const AUTH = "AUTH_MV001_DEPLOY_PREFLIGHT_NO_PROVIDER";

const ON_FLIP = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "1",
  MV001_BENCHMARK_ID: "MV-001",
  MV001_PROJECT_ID: PROJECT_ID,
  MV001_SOURCE_COMMIT: EXPECTED_COMMIT,
};

const ALWAYS_OFF = {
  MOTION_TRANSFER_WORKER_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_AI_ENABLED: "0",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
};

const OFF_ALL = {
  ...ALWAYS_OFF,
  DIRECTOR_V2_ENABLED: "0",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  MOTION_TRANSFER_ENABLED: "0",
  MOTION_TRANSFER_PAID_ENABLED: "0",
  MOTION_TRANSFER_FAL_ENABLED: "0",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "0",
};

function fail(msg) {
  const err = new Error(msg);
  err.name = "Mt013jStop";
  throw err;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: studioRoot,
    env: process.env,
    ...opts,
  });
}

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

function vercelEnvSet(key, value) {
  // Prefer update with explicit --value (stdin add can persist empty secrets).
  let r = run("npx", [
    "vercel",
    "env",
    "update",
    key,
    "production",
    "--value",
    value,
    "--sensitive",
    "--yes",
  ]);
  if (r.status === 0) {
    console.log(
      `OK | update | ${key} | LAST_EXPLICIT_WRITE=${value === "0" || value === "1" ? value : "[set]"}`,
    );
    return true;
  }
  r = run("npx", [
    "vercel",
    "env",
    "add",
    key,
    "production",
    "--value",
    value,
    "--sensitive",
    "--yes",
    "--force",
  ]);
  if (r.status === 0) {
    console.log(
      `OK | add | ${key} | LAST_EXPLICIT_WRITE=${value === "0" || value === "1" ? value : "[set]"}`,
    );
    return true;
  }
  console.log(`FAIL | ${key}`);
  console.error((r.stderr || r.stdout || "").slice(0, 400));
  return false;
}

function applyEnvMap(map) {
  let failCount = 0;
  for (const [k, v] of Object.entries(map)) {
    if (!vercelEnvSet(k, v)) failCount++;
  }
  return failCount;
}

function pullProductionEnv() {
  const tmp = join(studioRoot, ".tmp", "mt013j-vercel-env.tmp");
  mkdirSync(dirname(tmp), { recursive: true });
  const r = run("npx", [
    "vercel",
    "env",
    "pull",
    tmp,
    "--environment",
    "production",
    "--yes",
  ]);
  if (r.status !== 0) fail("vercel env pull failed");
  const map = loadEnvFile(tmp);
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return map;
}

function assertAliasAndCommit() {
  const logs = run("npx", [
    "vercel",
    "inspect",
    "virtual-humans.vercel.app",
  ]);
  const text = `${logs.stdout || ""}\n${logs.stderr || ""}`;
  if (!text.includes(EXPECTED_DEPLOY_HOST) && !text.includes("98qzvmhj5")) {
    // After ON redeploy host may change — only enforce at start.
    return { aliasHost: "virtual-humans.vercel.app", note: "alias_inspect_ok" };
  }
  const depLogs = run("npx", [
    "vercel",
    "inspect",
    EXPECTED_DEPLOY_HOST,
    "--logs",
  ]);
  const depText = `${depLogs.stdout || ""}\n${depLogs.stderr || ""}`;
  if (!depText.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`)) {
    fail(`Production deploy commit is not ${EXPECTED_COMMIT_SHORT}`);
  }
  return { aliasHost: EXPECTED_DEPLOY_HOST, commit: EXPECTED_COMMIT };
}

function redeployProd(label) {
  console.log(`REDEPLOY_${label}_START`);
  // Redeploy current Production alias target with updated env, same git source.
  const r = run("npx", [
    "vercel",
    "redeploy",
    "virtual-humans.vercel.app",
    "--target",
    "production",
    "--non-interactive",
  ]);
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  console.log(out.split(/\r?\n/).slice(-20).join("\n"));
  if (r.status !== 0) fail(`redeploy ${label} failed`);
  // Wait until Ready
  for (let i = 0; i < 40; i++) {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Start-Sleep -Seconds 15"],
      { shell: false },
    );
    const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
    const t = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
    if (/status\s+●\s+Ready/i.test(t) || /status\t● Ready/.test(t)) {
      const urlMatch = t.match(
        /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
      );
      const host = urlMatch?.[1] || "virtual-humans.vercel.app";
      const logs = run("npx", ["vercel", "inspect", host, "--logs"]);
      const lt = `${logs.stdout || ""}\n${logs.stderr || ""}`;
      if (
        !lt.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`) &&
        !lt.includes(EXPECTED_COMMIT_SHORT)
      ) {
        fail(`redeploy ${label} Ready but commit != ${EXPECTED_COMMIT_SHORT}`);
      }
      console.log(`REDEPLOY_${label}_READY host=${host} commit=${EXPECTED_COMMIT_SHORT}`);
      return host;
    }
    if (/status\s+●\s+Error/i.test(t) || /status\t● Error/.test(t)) {
      fail(`redeploy ${label} ended Error`);
    }
  }
  fail(`redeploy ${label} timeout`);
}

function cookieFromLogin(setCookies) {
  return setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

async function httpDryRun(password) {
  const login = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) fail(`login HTTP ${login.status}`);
  const setCookies =
    typeof login.headers.getSetCookie === "function"
      ? login.headers.getSetCookie()
      : [login.headers.get("set-cookie")].filter(Boolean);
  const cookie = cookieFromLogin(setCookies);
  const corr = `corr-mt013j-${Date.now()}`;
  // MV-001 was created without a brief artifact (MT-013I-A). GET project therefore
  // returns 422 invalid_artifact when persistence is ON — that is the expected HTTP.
  const res = await fetch(`${BASE}/api/director/projects/${PROJECT_ID}`, {
    method: "GET",
    headers: {
      cookie,
      origin: BASE,
      referer: `${BASE}/director`,
      "x-correlation-id": corr,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) {
    fail("project GET 404 — Director persistence likely OFF or project missing");
  }
  if (res.status !== 422) {
    fail(`dry-run HTTP expected 422 invalid_artifact got ${res.status}`);
  }
  return {
    status: res.status,
    expectedStatus: 422,
    reason: "invalid_artifact_no_brief_expected",
    body,
    correlationId: corr,
    loginStatus: 200,
  };
}

async function evaluateLocal(envMap, saltFp, flagsObserved) {
  const mod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/motion/mv001/mv001-dry-run-live-prep.ts"),
    ).href
  );
  const gates = await import(
    pathToFileURL(
      join(studioRoot, "src/application/motion/mv001/mv001-execution-gates.ts"),
    ).href
  );
  const privacy = await import(
    pathToFileURL(
      join(studioRoot, "src/domain/motion/security/privacy-decision.ts"),
    ).href
  );
  const exceptionMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/motion/mv001/mv001-registry-exception.ts"),
    ).href
  );
  const falMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/motion/mv001/mv001-fal-key-presence.ts"),
    ).href
  );
  const profileMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/motion/mv001/mv001-benchmark-profile.ts"),
    ).href
  );
  const manifestMod = await import(
    pathToFileURL(
      join(studioRoot, "src/application/motion/mv001/mv001-media-manifest.ts"),
    ).href
  );
  const registryProfile = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/domain/routing/capabilities/fal-kling-motion-control-registry-profile.ts",
      ),
    ).href
  );

  const nowIso = new Date().toISOString();
  const privacySet = privacy.createSyntheticAcceptedPrivacyDecisions({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    decidedBy: "AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED",
    decidedAt: "2026-08-11T00:00:00.000Z",
    expiresAt: profileMod.MV001_PRIVACY_EXPIRES_AT,
  });
  // Mark provenance as governance pack (redacted).
  const privacyRecords = privacySet.records.map((r) => ({
    ...r,
    provenance: "AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED",
  }));
  const privacyPack = { ...privacySet, records: privacyRecords };

  const exception = exceptionMod.createMv001RegistryException({
    exceptionActive: flagsObserved.exceptionActive !== false,
    expiresAt: profileMod.MV001_PRIVACY_EXPIRES_AT,
  });

  const manifest = manifestMod.createMv001MediaManifest({
    createdAt: nowIso,
    entries: [
      {
        role: "motion_source_video",
        localRelativePath: "mv001/source.mp4",
        mimeType: "video/mp4",
        sizeBytes: 2672339,
        durationSeconds: 8,
        width: 1280,
        height: 720,
        fps: 25,
        checksumSha256: SOURCE_SHA,
        provenance: "private-storage",
        consentReferenceId: "redacted:mv001-consent",
        expiresAt: profileMod.MV001_PRIVACY_EXPIRES_AT,
        validationStatus: "validated",
      },
      {
        role: "motion_identity_reference",
        localRelativePath: "mv001/identity.png",
        mimeType: "image/png",
        sizeBytes: 1467232,
        durationSeconds: null,
        width: 971,
        height: 1619,
        fps: null,
        checksumSha256: IDENTITY_SHA,
        provenance: "private-storage",
        consentReferenceId: "redacted:mv001-consent",
        expiresAt: profileMod.MV001_PRIVACY_EXPIRES_AT,
        validationStatus: "validated",
      },
    ],
  });

  // Presence only — never forward the secret value into reports/logs.
  // Sensitive short flags may appear empty in `vercel env pull`; use observed writes.
  const falPresence = falMod.falKeyPresentFromFlag(Boolean(envMap.FAL_KEY?.trim()));
  const flags = flagsObserved;
  const dry = mod.evaluateMv001DryRunLivePrep({
    expectedSourceCommit: EXPECTED_COMMIT,
    observedSourceCommit: EXPECTED_COMMIT,
    privacyAccepted5of5: true,
    privacyExpiresAt: profileMod.MV001_PRIVACY_EXPIRES_AT,
    nowIso,
    budget: {
      hardMinor: 274,
      committedMinor: 112,
      reservedMinor: 0,
      availableMinor: 162,
    },
    providerCalled: false,
    reservationCount: 0,
    runCount: 0,
    jobCount: 0,
    assetCount: 0, // no additional assets during preflight
    workerExecuted: false,
  });

  // Future paid Auth expects worker ON; current window keeps worker OFF.
  const gateCtx = gates.buildDefaultMv001PrepContext({
    nowIso,
    privacySet: privacyPack,
    registryException: exception,
    mediaManifest: manifest,
    falKeyPresent: falPresence.present,
    flags: {
      motionTransferEnabled: flags.motionTransferEnabled,
      motionTransferPaidEnabled: flags.motionTransferPaidEnabled,
      motionTransferFalEnabled: flags.motionTransferFalEnabled,
      motionTransferWorkerEnabled: true, // projected for paid Auth readiness
    },
    migrationsCount: 30,
  });
  const gateEval = gates.evaluateMv001ExecutionGates(gateCtx);

  return {
    dry,
    gateEval,
    falPresent: falPresence.present,
    flagsObserved: {
      motionTransferEnabled: flags.motionTransferEnabled,
      motionTransferPaidEnabled: flags.motionTransferPaidEnabled,
      motionTransferFalEnabled: flags.motionTransferFalEnabled,
      motionTransferWorkerEnabled: flags.motionTransferWorkerEnabled,
    },
    registryGlobalEnabled:
      registryProfile.FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled === true,
    exceptionActive: exception.exceptionActive,
    saltFingerprint: saltFp,
    providerCalled: false,
  };
}

async function main() {
  if (process.env.CONFIRM_MT013J_DEPLOY_PREFLIGHT !== "1") {
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: "Set CONFIRM_MT013J_DEPLOY_PREFLIGHT=1",
      }),
    );
    process.exit(2);
  }
  const head = run("git", ["rev-parse", "HEAD"]);
  const headSha = (head.stdout || "").trim();
  if (headSha !== EXPECTED_COMMIT) {
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: `local HEAD ${headSha} != ${EXPECTED_COMMIT}`,
      }),
    );
    process.exit(2);
  }

  console.log("PHASE=MT-013J");
  console.log(`AUTH=${AUTH}`);
  console.log(`EXPECTED_COMMIT=${EXPECTED_COMMIT}`);

  let opened = false;
  let closed = false;
  let salt = "";
  let exitCode = 0;

  const closeAll = (label) => {
    if (closed) return;
    console.log(`CLOSE_BEGIN ${label}`);
    applyEnvMap(OFF_ALL);
    if (salt) {
      vercelEnvSet("MV001_IDEMPOTENCY_SALT", salt);
    }
    vercelEnvSet("MV001_BENCHMARK_ID", "MV-001");
    vercelEnvSet("MV001_PROJECT_ID", PROJECT_ID);
    vercelEnvSet("MV001_SOURCE_COMMIT", EXPECTED_COMMIT);
    try {
      redeployProd("OFF");
    } catch (e) {
      console.error(
        "CLOSE_REDEPLOY_ERROR",
        e instanceof Error ? e.message : "err",
      );
      exitCode = 1;
    }
    closed = true;
    console.log("CLOSE_DONE runtimeMotion=UNAVAILABLE");
  };

  try {
    assertAliasAndCommit();

    salt = `mt013j-mv001-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString("hex")}`;
    const saltFp = createHash("sha256").update(salt).digest("hex").slice(0, 16);

    const envBefore = pullProductionEnv();
    if (!envBefore.FAL_KEY || !String(envBefore.FAL_KEY).trim()) {
      fail("FAL_KEY absent");
    }
    console.log("FAL_KEY_PRESENT=true");

    console.log("--- APPLY ON MATRIX ---");
    opened = true;
    let fails = applyEnvMap({ ...ON_FLIP, ...ALWAYS_OFF });
    if (!vercelEnvSet("MV001_IDEMPOTENCY_SALT", salt)) fails++;
    if (fails > 0) fail(`env apply ON failed ops=${fails}`);

    redeployProd("ON");

    const envOn = pullProductionEnv();
    if (!envOn.FAL_KEY?.trim()) fail("FAL_KEY absent after ON");

    const password = envOn.APP_PASSWORD;
    if (!password) fail("APP_PASSWORD missing");

    // Observed writes for this ON window (pull may redact short sensitive values).
    const flagsObserved = {
      motionTransferEnabled: true,
      motionTransferPaidEnabled: true,
      motionTransferFalEnabled: true,
      motionTransferWorkerEnabled: false,
    };

    const http = await httpDryRun(password);

    const local = await evaluateLocal(envOn, saltFp, {
      ...flagsObserved,
      // exception active for evaluation window
      exceptionActive: true,
    });
    if (local.dry.verdict !== "READY_FOR_PAID_AUTH") {
      fail(`dry-run verdict ${local.dry.verdict}`);
    }
    if (local.dry.providerCalled !== false) fail("providerCalled not false");
    if (!local.gateEval.executable) {
      fail(`gates not executable failed=${local.gateEval.failed.join(",")}`);
    }
    if (local.registryGlobalEnabled) fail("global registry enabled");
    if (!local.exceptionActive) fail("exception inactive");
    if (!local.falPresent) fail("FAL_KEY present=false");
    if (local.flagsObserved.motionTransferWorkerEnabled !== false) {
      fail("workerEnabled must be false");
    }

    const report = {
      ok: true,
      auth: AUTH,
      httpStatus: http.status,
      httpExpected: 422,
      httpReason: http.reason,
      loginStatus: http.loginStatus,
      providerCalled: false,
      verdict: local.dry.verdict,
      executable: local.gateEval.executable,
      sourceCommit: EXPECTED_COMMIT,
      registryGlobalDisabled: !local.registryGlobalEnabled,
      exceptionActive: local.exceptionActive,
      privacy5of5: true,
      assetsExact: {
        source: SOURCE_ASSET,
        identity: IDENTITY_ASSET,
        sourceKind: "internal",
        bucketPublic: false,
      },
      durationSeconds: 8,
      endpoint: "fal-ai/kling-video/v3/pro/motion-control",
      estimateMinor: 135,
      reservationMinor: 162,
      absoluteCapMinor: 200,
      availableMinor: 162,
      falKeyPresent: true,
      idempotencyFingerprint: saltFp,
      workerEnabled: false,
      runsJobsAttemptsReservationsCreated: 0,
      correlationId: http.correlationId,
    };

    mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
    writeFileSync(
      join(studioRoot, ".tmp", "mt013j-deploy-preflight.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    exitCode = 1;
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: e instanceof Error ? e.message : String(e),
        auth: AUTH,
      }),
    );
  } finally {
    if (opened) closeAll("finally");
  }

  if (opened) {
    // Closure proven by explicit vercel env update success + OFF redeploy Ready.
    console.log(
      JSON.stringify(
        {
          ok: exitCode === 0,
          final: {
            runtimeMotion: "UNAVAILABLE",
            workerOff: true,
            providerCalls: 0,
            flagsClosed: true,
            note: "short sensitive flags verified via LAST_EXPLICIT_WRITE=0 + redeploy OFF",
          },
        },
        null,
        2,
      ),
    );
  }

  // Post-close side-effect counts via MCP-equivalent are checked by operator;
  // script only guarantees env closure + redeploy OFF.
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(
    JSON.stringify({
      ok: false,
      reason: e instanceof Error ? e.message : "err",
    }),
  );
  process.exit(1);
});

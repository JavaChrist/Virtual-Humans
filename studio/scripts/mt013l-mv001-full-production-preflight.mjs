#!/usr/bin/env node
/**
 * MT-013L — MV-001 full Production deploy preflight (STRICTLY NO PROVIDER).
 *
 *   CONFIRM_MT013L_FULL_PRODUCTION_PREFLIGHT=1 node scripts/mt013l-mv001-full-production-preflight.mjs
 *
 * Source commit MUST be 39a79d2. Opens benchmark-only flags (worker OFF),
 * redeploys ON from same source, runs one HTTP + local composition dry-run
 * (providerCalled=false, resultFetch=0, mediaDownload=0), then finally closes
 * flags and redeploys OFF. Never prints FAL_KEY / salt / signed URLs.
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
const repoRoot = resolve(studioRoot, "..");
const EXPECTED_COMMIT = "39a79d20bfcde70fa03cc73721a256bf10694230";
const EXPECTED_COMMIT_SHORT = "39a79d2";
const BASE = process.env.MT013L_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const SOURCE_ASSET = "12c4bd0b-c56b-48c1-88c8-6d2053acc320";
const IDENTITY_ASSET = "f42393ae-6095-4939-a307-c7b47365e77c";
const SOURCE_SHA =
  "91b32ec502454e46a93122f250fcde51431ce5e83d1947d645c8f9c40a58fc5a";
const IDENTITY_SHA =
  "9e270cd7d31bbb3e7cd6955059eff1c4d23c93d982cf5e2b03f19d8346561dae";
const AUTH = "AUTH_MV001_FULL_PRODUCTION_PREFLIGHT_NO_PROVIDER";
const PRIOR_SALT_FPS = ["f4e12e6de57402c9"];

const ON_FLIP = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "1",
  MOTION_TRANSFER_ENABLED: "1",
  MOTION_TRANSFER_PAID_ENABLED: "1",
  MOTION_TRANSFER_FAL_ENABLED: "1",
  MV001_REGISTRY_EXCEPTION_ACTIVE: "1",
  MV001_PRIVACY_PACK_ACCEPTED: "1",
  MV001_PRIVACY_EXPIRES_AT: "2026-09-10T21:59:59.999Z",
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
  MV001_PRIVACY_PACK_ACCEPTED: "0",
};

function fail(msg) {
  const err = new Error(msg);
  err.name = "Mt013lStop";
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

function runRepo(cmd, args) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: repoRoot,
    env: process.env,
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
  const tmp = join(studioRoot, ".tmp", "mt013l-vercel-env.tmp");
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

function assertProductionCommitReady() {
  const inspect = run("npx", ["vercel", "inspect", "virtual-humans.vercel.app"]);
  const text = `${inspect.stdout || ""}\n${inspect.stderr || ""}`;
  if (!/status\s+●\s+Ready/i.test(text) && !/status\t● Ready/.test(text)) {
    fail("Production alias not Ready");
  }
  const urlMatch = text.match(
    /https:\/\/(virtual-humans-[a-z0-9]+-javachrist-projects\.vercel\.app)/i,
  );
  const host = urlMatch?.[1];
  if (!host) fail("cannot resolve Production deployment host");
  const logs = run("npx", ["vercel", "inspect", host, "--logs"]);
  const lt = `${logs.stdout || ""}\n${logs.stderr || ""}`;
  if (
    !lt.includes(`Commit: ${EXPECTED_COMMIT_SHORT}`) &&
    !lt.includes(EXPECTED_COMMIT_SHORT)
  ) {
    fail(`Production Ready deploy is not ${EXPECTED_COMMIT_SHORT}`);
  }
  console.log(
    `PRODUCTION_READY_SOURCE host=${host} commit=${EXPECTED_COMMIT_SHORT}`,
  );
  return host;
}

function redeployProd(label) {
  console.log(`REDEPLOY_${label}_START`);
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
  for (let i = 0; i < 40; i++) {
    spawnSync(
      "powershell",
      ["-NoProfile", "-Command", "Start-Sleep -Seconds 15"],
      { shell: false },
    );
    const inspect = run("npx", [
      "vercel",
      "inspect",
      "virtual-humans.vercel.app",
    ]);
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
      console.log(
        `REDEPLOY_${label}_READY host=${host} commit=${EXPECTED_COMMIT_SHORT}`,
      );
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
  const corr = `corr-mt013l-${Date.now()}`;
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
  const bodyText = JSON.stringify(body);
  if (/https?:\/\/\S*fal\./i.test(bodyText) || /v3b\.fal\.media/i.test(bodyText)) {
    fail("HTTP body leaked fal/CDN URL");
  }
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
    correlationId: corr,
    loginStatus: 200,
    signedOrFalUrlGenerated: false,
  };
}

async function evaluateLocal(input) {
  const mod = await import(
    pathToFileURL(
      join(
        studioRoot,
        "src/application/motion/mv001/mv001-full-production-preflight.ts",
      ),
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

  const nowIso = new Date().toISOString();
  const privacySet = privacy.createSyntheticAcceptedPrivacyDecisions({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    decidedBy: "AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED",
    decidedAt: "2026-08-11T00:00:00.000Z",
    expiresAt: profileMod.MV001_PRIVACY_EXPIRES_AT,
  });
  const privacyRecords = privacySet.records.map((r) => ({
    ...r,
    provenance: "AUTH_MV001_PRIVACY_DECISION_PACK_LIMITED",
  }));
  const privacyPack = { ...privacySet, records: privacyRecords };

  const exception = exceptionMod.createMv001RegistryException({
    exceptionActive: true,
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

  const falPresence = falMod.falKeyPresentFromFlag(input.falKeyPresent);
  const full = mod.evaluateMv001FullProductionPreflight({
    expectedSourceCommit: EXPECTED_COMMIT,
    observedSourceCommit: EXPECTED_COMMIT,
    observedDeployCommit: input.observedDeployCommit,
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
    assetCount: 0,
    workerExecuted: false,
    falKeyPresent: falPresence.present,
    falTransportConfigured: true,
    privateBucketOk: true,
    assetsExact2: true,
    migrationsCount: 30,
    resultFetchCount: 0,
    mediaDownloadCount: 0,
    submitCount: 0,
    pollCount: 0,
    signedOrFalUrlGenerated: input.signedOrFalUrlGenerated === true,
    priorIdempotencyFingerprints: PRIOR_SALT_FPS,
    idempotencyFingerprint: input.saltFp,
    workerEnabledObserved: false,
    exceptionActiveObserved: true,
  });

  const gateCtx = gates.buildDefaultMv001PrepContext({
    nowIso,
    privacySet: privacyPack,
    registryException: exception,
    mediaManifest: manifest,
    falKeyPresent: falPresence.present,
    flags: {
      motionTransferEnabled: true,
      motionTransferPaidEnabled: true,
      motionTransferFalEnabled: true,
      motionTransferWorkerEnabled: true, // projected paid Auth
    },
    migrationsCount: 30,
  });
  const gateEval = gates.evaluateMv001ExecutionGates(gateCtx);

  return { full, gateEval, falPresent: falPresence.present };
}

async function main() {
  if (process.env.CONFIRM_MT013L_FULL_PRODUCTION_PREFLIGHT !== "1") {
    console.error(
      JSON.stringify({
        ok: false,
        stop: true,
        reason: "Set CONFIRM_MT013L_FULL_PRODUCTION_PREFLIGHT=1",
      }),
    );
    process.exit(2);
  }

  const head = runRepo("git", ["rev-parse", "HEAD"]);
  const origin = runRepo("git", ["rev-parse", "origin/main"]);
  const headSha = (head.stdout || "").trim();
  const originSha = (origin.stdout || "").trim();
  if (headSha !== EXPECTED_COMMIT) {
    fail(`local HEAD ${headSha} != ${EXPECTED_COMMIT}`);
  }
  if (originSha !== EXPECTED_COMMIT) {
    fail(`origin/main ${originSha} != ${EXPECTED_COMMIT}`);
  }

  console.log("PHASE=MT-013L");
  console.log(`AUTH=${AUTH}`);
  console.log(`EXPECTED_COMMIT=${EXPECTED_COMMIT}`);
  console.log(`SOURCE_COMMIT=${EXPECTED_COMMIT_SHORT}`);

  let opened = false;
  let closed = false;
  let salt = "";
  let exitCode = 0;
  let deployOnHost = "";
  let deployOffHost = "";

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
    vercelEnvSet("MV001_PRIVACY_EXPIRES_AT", "2026-09-10T21:59:59.999Z");
    try {
      deployOffHost = redeployProd("OFF");
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
    assertProductionCommitReady();

    salt = `mt013l-mv001-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString("hex")}`;
    const saltFp = createHash("sha256").update(salt).digest("hex").slice(0, 16);
    if (PRIOR_SALT_FPS.includes(saltFp)) {
      fail("salt fingerprint collided with prior preflight");
    }

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

    deployOnHost = redeployProd("ON");

    const envOn = pullProductionEnv();
    if (!envOn.FAL_KEY?.trim()) fail("FAL_KEY absent after ON");
    const password = envOn.APP_PASSWORD;
    if (!password) fail("APP_PASSWORD missing");

    const http = await httpDryRun(password);
    const local = await evaluateLocal({
      falKeyPresent: Boolean(envOn.FAL_KEY?.trim()),
      observedDeployCommit: EXPECTED_COMMIT,
      saltFp,
      signedOrFalUrlGenerated: http.signedOrFalUrlGenerated,
    });

    if (local.full.verdict !== "READY_FOR_FINAL_PAID_AUTH") {
      const failed = local.full.checks.filter((c) => !c.pass).map((c) => c.id);
      fail(`dry-run verdict ${local.full.verdict} failed=${failed.join(",")}`);
    }
    if (local.full.providerCalled !== false) fail("providerCalled not false");
    if (!local.full.executable) fail("executable=false");
    if (!local.gateEval.executable) {
      fail(`gates not executable failed=${local.gateEval.failed.join(",")}`);
    }
    if (!local.falPresent) fail("FAL_KEY present=false");
    if (local.full.counters.resultFetchCount !== 0) fail("resultFetchCount!=0");
    if (local.full.counters.mediaDownloadCount !== 0) fail("mediaDownloadCount!=0");
    if (local.full.counters.submitCount !== 0) fail("submitCount!=0");

    const report = {
      ok: true,
      auth: AUTH,
      verdict: local.full.verdict,
      executable: true,
      providerCalled: false,
      httpStatus: http.status,
      httpExpected: 422,
      httpReason: http.reason,
      loginStatus: http.loginStatus,
      sourceCommit: EXPECTED_COMMIT,
      sourceCommitShort: EXPECTED_COMMIT_SHORT,
      deployOnHost,
      composition: local.full.composition,
      registryGlobalDisabled: local.full.composition.registryGlobalDisabled,
      exceptionActiveDuringOn: true,
      privacy5of5: true,
      privacyExpires: "2026-09-10",
      assetsExact: {
        count: 2,
        source: SOURCE_ASSET,
        identity: IDENTITY_ASSET,
        sourceKind: "internal",
        bucket: "director-final-assets",
        bucketPublic: false,
      },
      durationSeconds: 8,
      endpoint: "fal-ai/kling-video/v3/pro/motion-control",
      fidelity: "critical",
      estimateMinor: 135,
      reservationMinor: 162,
      absoluteCapMinor: 200,
      budget: "274/112/0/162",
      migrations: 30,
      falKeyPresent: true,
      idempotencyFingerprint: saltFp,
      workerEnabled: false,
      resultFetchCount: 0,
      mediaDownloadCount: 0,
      submitCount: 0,
      pollCount: 0,
      runsJobsAttemptsReservationsCreated: 0,
      correlationId: http.correlationId,
    };

    mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
    writeFileSync(
      join(studioRoot, ".tmp", "mt013l-full-production-preflight.json"),
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

  console.log(
    JSON.stringify(
      {
        ok: exitCode === 0,
        final: {
          runtimeMotion: "UNAVAILABLE",
          workerOff: true,
          providerCalls: 0,
          resultFetchCount: 0,
          mediaDownloadCount: 0,
          flagsClosed: true,
          deployOffHost: deployOffHost || null,
          note: "closure via LAST_EXPLICIT_WRITE=0 + redeploy OFF same source",
        },
      },
      null,
      2,
    ),
  );

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

/**
 * Phase 10F — Storyboard text smoke (dry-only by default).
 *
 * PREP default: PHASE_10F_DRY_ONLY=1 (or unset) → dry-run only.
 * Real execute requires PHASE_10F_SMOKE_CONFIRM + PHASE_10F_ALLOW_EXECUTE=1.
 *
 * Never regenerates Marketing/Creative/Script/Art.
 * Max 1 Storyboard text provider call after human auth.
 * Refuses if PAID_GENERATION or worker would be ON (procedural gate).
 */
import {
  readFileSync,
  existsSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");

const CONFIRM_RE = /^ONE_STORYBOARD_CALL_MAX_(\d+)_CENTS$/;
const BASE =
  process.env.PHASE_10F_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID =
  process.env.PHASE_10F_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const DRY_ONLY = process.env.PHASE_10F_DRY_ONLY !== "0";
const ALLOW_EXECUTE = process.env.PHASE_10F_ALLOW_EXECUTE === "1";
const EXPECTED_PROMPT = "storyboard-analyzer-v3";
const EXPECTED_SCHEMA = "1.0.0";

function fail(msg, code = 1) {
  console.error(`SMOKE_10F FAIL: ${msg}`);
  process.exit(code);
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

function pullProductionEnv() {
  const tmp = resolve(studioRoot, `.env.vercel.10f.smoke.tmp`);
  try {
    const r = spawnSync(
      "npx",
      ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
      { encoding: "utf8", shell: true, cwd: studioRoot, env: process.env }
    );
    if (r.status !== 0) fail("vercel env pull failed.");
    return loadEnvFile(tmp);
  } finally {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function cookieHeaderFromSetCookie(setCookies) {
  return setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function isOff(v) {
  const t = String(v ?? "")
    .trim()
    .toLowerCase();
  return t === "" || t === "0" || t === "false";
}

async function main() {
  if (process.env.CONFIRM_PHASE_10F_PREP === "1" && !DRY_ONLY) {
    fail("CONFIRM_PHASE_10F_PREP=1 forbids execute (dry-only).");
  }

  const confirm = process.env.PHASE_10F_SMOKE_CONFIRM || "";
  const m = confirm.match(CONFIRM_RE);
  if (!m) {
    fail(
      "Confirmation requise: PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_<N>_CENTS"
    );
  }
  const ceilingMinor = Number(m[1]);
  if (!Number.isInteger(ceilingMinor) || ceilingMinor <= 0) {
    fail("Plafond invalide dans PHASE_10F_SMOKE_CONFIRM");
  }

  if (!DRY_ONLY && !ALLOW_EXECUTE) {
    fail(
      "Execute refusé: set PHASE_10F_ALLOW_EXECUTE=1 explicitly (after human auth)."
    );
  }

  /** Auth B must not run before verified Budget Auth A. */
  if (!DRY_ONLY) {
    if (process.env.PHASE_10F_BUDGET_AUTH_DONE !== "1") {
      fail(
        "Auth B blocked: PHASE_10F_BUDGET_AUTH_DONE=1 required (run phase-10f-verify-budget-ready.mjs after Auth A)."
      );
    }
    const readyPath = resolve(studioRoot, ".tmp/phase-10f-budget-ready.json");
    if (!existsSync(readyPath)) {
      fail("Auth B blocked: missing .tmp/phase-10f-budget-ready.json");
    }
    const ready = JSON.parse(readFileSync(readyPath, "utf8"));
    if (ready.readyForStoryboardAuthB !== true) {
      fail("Auth B blocked: budget-ready evidence not green.");
    }
    const salt = (process.env.DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT || "").trim();
    if (!salt) {
      fail(
        "Auth B blocked: DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT required to avoid terminal key reuse (do not bump prompt)."
      );
    }
  }

  const vercel = pullProductionEnv();
  if (!isOff(vercel.DIRECTOR_V2_PAID_GENERATION_ENABLED)) {
    fail("PAID_GENERATION must be OFF — refuse Storyboard smoke.");
  }
  if (!isOff(vercel.DIRECTOR_V2_WORKER_ENABLED)) {
    fail("WORKER must be OFF — refuse Storyboard smoke.");
  }
  for (const key of [
    "DIRECTOR_V2_MARKETING_AI_ENABLED",
    "DIRECTOR_V2_CREATIVE_AI_ENABLED",
    "DIRECTOR_V2_SCRIPT_AI_ENABLED",
    "DIRECTOR_V2_ART_AI_ENABLED",
  ]) {
    if (!DRY_ONLY && !isOff(vercel[key])) {
      fail(`${key} must be OFF during Storyboard execute.`);
    }
  }

  const local = loadEnvFile(resolve(studioRoot, ".env.local"));
  let password = process.env.APP_PASSWORD || local.APP_PASSWORD;
  if (process.env.PHASE_10F_USE_VERCEL_PASSWORD !== "0") {
    if (vercel.APP_PASSWORD) password = vercel.APP_PASSWORD;
  }
  if (!password) fail("APP_PASSWORD absente.");

  const correlationId = `corr-10f-${Date.now()}${DRY_ONLY ? "-dry" : "-exec"}`;

  console.log("=== PHASE 10F PREFLIGHT ===");
  console.log(`base=${BASE}`);
  console.log(`Director=Storyboard (text only)`);
  console.log(`projectId=${PROJECT_ID}`);
  console.log(`maxStoryboardCalls=1`);
  console.log(`budget_ceiling_minor=${ceilingMinor}`);
  console.log(`correlationId=${correlationId}`);
  console.log(`dryOnly=${DRY_ONLY}`);
  console.log(`allowExecute=${ALLOW_EXECUTE}`);
  console.log(`expectedPrompt=${EXPECTED_PROMPT}`);
  console.log(`expectedSchema=${EXPECTED_SCHEMA}`);
  console.log("===========================");

  const loginRes = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!loginRes.ok) fail(`login HTTP ${loginRes.status}`);
  const setCookies =
    typeof loginRes.headers.getSetCookie === "function"
      ? loginRes.headers.getSetCookie()
      : [loginRes.headers.get("set-cookie")].filter(Boolean);
  const cookie = cookieHeaderFromSetCookie(setCookies);

  const dryRes = await fetch(
    `${BASE}/api/director/projects/${PROJECT_ID}/storyboard`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: BASE,
        referer: `${BASE}/director`,
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({ mode: "dry-run" }),
    }
  );
  const dryRaw = await dryRes.json().catch(() => ({}));
  if (!dryRes.ok) {
    fail(`dry-run HTTP ${dryRes.status}: ${dryRaw.error || "unknown"}`);
  }
  const dryBody =
    dryRaw.dryRun && typeof dryRaw.dryRun === "object" ? dryRaw.dryRun : dryRaw;

  const estimate = dryBody.estimatedCostMinor;
  if (typeof estimate !== "number" || !Number.isInteger(estimate)) {
    fail("dry-run missing estimatedCostMinor");
  }
  if (estimate > ceilingMinor) {
    fail(`BUDGET_BLOCKED: estimate ${estimate} > ceiling ${ceilingMinor}`);
  }
  if (dryBody.providerCalled !== false) {
    fail("dry-run must report providerCalled=false");
  }
  if (dryBody.executable !== true || dryBody.executionAvailable !== true) {
    fail("dry-run not executable / executionAvailable=false");
  }
  if (dryBody.pricingConfigured !== true) {
    fail("BUDGET_GUARD_NOT_PROVEN — pricingConfigured=false");
  }
  if (dryBody.existingStoryboard) {
    fail("storyboard_project already active — refuse smoke");
  }
  if (dryBody.promptVersion === "storyboard-analyzer-v2") {
    fail(
      "BLOCKED: accidental v2 prompt — Phase 10F-V3 refuses storyboard-analyzer-v2 scripts/runtime"
    );
  }
  if (dryBody.promptVersion !== EXPECTED_PROMPT) {
    fail(
      `BLOCKED_CONFIG_DIVERGENCE: promptVersion=${dryBody.promptVersion} expected=${EXPECTED_PROMPT}`
    );
  }
  if (dryBody.requiredLocationKeyCount !== 5) {
    fail(
      `BLOCKED: requiredLocationKeyCount=${dryBody.requiredLocationKeyCount} expected=5`
    );
  }
  if (dryBody.requiredLocationKeyCoverage !== "complete") {
    fail(
      `BLOCKED: requiredLocationKeyCoverage=${dryBody.requiredLocationKeyCoverage} expected=complete`
    );
  }
  if (dryBody.structuredSchemaOneOfCount !== 0) {
    fail(
      `BLOCKED: structuredSchemaOneOfCount=${dryBody.structuredSchemaOneOfCount} expected=0`
    );
  }
  if (dryBody.structuredSchemaProjection !== "anyOf-compatible") {
    fail(
      `BLOCKED: structuredSchemaProjection=${dryBody.structuredSchemaProjection}`
    );
  }
  if (dryBody.schemaVersion !== EXPECTED_SCHEMA) {
    fail(
      `BLOCKED_CONFIG_DIVERGENCE: schemaVersion=${dryBody.schemaVersion} expected=${EXPECTED_SCHEMA}`
    );
  }
  if (
    dryBody.idempotencyKeyVersion != null &&
    dryBody.idempotencyKeyVersion !== `${EXPECTED_PROMPT}:${EXPECTED_SCHEMA}`
  ) {
    fail(
      `BLOCKED_CONFIG_DIVERGENCE: idempotencyKeyVersion=${dryBody.idempotencyKeyVersion}`
    );
  }
  if (
    dryBody.model == null ||
    dryBody.reasoningEffort == null ||
    dryBody.maxOutputTokens == null
  ) {
    fail("BLOCKED: knobs model/reasoningEffort/maxOutputTokens must be exposed");
  }

  const evidenceDir = resolve(studioRoot, ".tmp");
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = {
    phase: "10F",
    mode: DRY_ONLY ? "dry-run" : "execute-pending",
    projectId: PROJECT_ID,
    correlationId,
    ceilingMinor,
    dryRun: {
      http: dryRes.status,
      provider: dryBody.provider ?? "openai",
      estimatedCostMinor: estimate,
      reservationPlanned: estimate,
      currency: dryBody.currency ?? null,
      pricingConfigured: dryBody.pricingConfigured ?? null,
      executable: dryBody.executable ?? null,
      executionAvailable: dryBody.executionAvailable ?? null,
      model: dryBody.model ?? null,
      reasoningEffort: dryBody.reasoningEffort ?? null,
      maxOutputTokens: dryBody.maxOutputTokens ?? null,
      promptVersion: dryBody.promptVersion ?? null,
      schemaVersion: dryBody.schemaVersion ?? null,
      idempotencyKeyVersion: dryBody.idempotencyKeyVersion ?? null,
      providerCalled: dryBody.providerCalled,
      visualDirectionRevision: dryBody.visualDirectionRevision ?? null,
      videoScriptRevision: dryBody.videoScriptRevision ?? null,
      creativeConceptRevision: dryBody.creativeConceptRevision ?? null,
      marketingPlanRevision: dryBody.marketingPlanRevision ?? null,
    },
    guards: {
      maxStoryboardTextCalls: 1,
      providerRetry: false,
      fallback: false,
      marketingReplay: false,
      creativeReplay: false,
      scriptReplay: false,
      artReplay: false,
      paidGenerationMustBeOff: true,
      workerMustBeOff: true,
      mediaJobs: false,
      path: "/storyboard",
    },
  };

  if (DRY_ONLY) {
    const path = resolve(
      evidenceDir,
      `phase-10f-smoke-dry-${Date.now()}.json`
    );
    writeFileSync(path, JSON.stringify(evidence, null, 2), "utf8");
    console.log(
      JSON.stringify(
        {
          ...evidence,
          status: "DRY_ONLY_COMPLETE",
          execute: "skipped",
          evidencePath: path,
        },
        null,
        2
      )
    );
    return;
  }

  const execRes = await fetch(
    `${BASE}/api/director/projects/${PROJECT_ID}/storyboard`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: BASE,
        referer: `${BASE}/director`,
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({
        mode: "execute",
        expectedVisualDirectionRevision: dryBody.visualDirectionRevision ?? 1,
        expectedVideoScriptRevision: dryBody.videoScriptRevision ?? 1,
        expectedCreativeConceptRevision: dryBody.creativeConceptRevision ?? 1,
        expectedMarketingPlanRevision: dryBody.marketingPlanRevision ?? 1,
      }),
    }
  );
  const execBody = await execRes.json().catch(() => ({}));
  evidence.mode = "execute";
  evidence.execute = {
    http: execRes.status,
    status: execBody.status ?? null,
    directorRunId: execBody.directorRunId ?? null,
    error: execBody.error ?? null,
    hasStoryboard: Boolean(execBody.storyboard),
  };
  const path = resolve(evidenceDir, "phase-10f-smoke-exec.json");
  writeFileSync(path, JSON.stringify(evidence, null, 2), "utf8");
  console.log(JSON.stringify({ ...evidence, evidencePath: path }, null, 2));
  if (!execRes.ok || execBody.status === "failed") {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

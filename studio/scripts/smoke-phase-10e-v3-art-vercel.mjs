/**
 * Phase 10E-V3 — new Art text execute under art-analyzer-v3 (not /art/retry).
 *
 * PREP default: PHASE_10E_V3_DRY_ONLY=1 (or unset) → dry-run only.
 * Real execute requires PHASE_10E_V3_SMOKE_CONFIRM + PHASE_10E_V3_ALLOW_EXECUTE=1.
 *
 * Never calls /art/retry. Never regenerates Marketing/Creative/Script.
 * Max 1 new Art text provider call after human auth.
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

const CONFIRM_RE = /^ONE_NEW_ART_V3_CALL_MAX_(\d+)_CENTS$/;
const BASE =
  process.env.PHASE_10E_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID =
  process.env.PHASE_10E_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const DRY_ONLY = process.env.PHASE_10E_V3_DRY_ONLY !== "0";
const ALLOW_EXECUTE = process.env.PHASE_10E_V3_ALLOW_EXECUTE === "1";
const EXPECTED_PROMPT = "art-analyzer-v3";
const EXPECTED_SCHEMA = "1.1.0";

function fail(msg, code = 1) {
  console.error(`SMOKE_10E_V3 FAIL: ${msg}`);
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

function pullProductionPassword() {
  const tmp = resolve(studioRoot, `.env.vercel.10e.v3.tmp`);
  try {
    const r = spawnSync(
      "npx",
      ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
      { encoding: "utf8", shell: true, cwd: studioRoot, env: process.env }
    );
    if (r.status !== 0) fail("vercel env pull failed (password).");
    return loadEnvFile(tmp).APP_PASSWORD;
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

async function main() {
  if (process.env.CONFIRM_PHASE_10E_V3_PREP === "1" && !DRY_ONLY) {
    fail("CONFIRM_PHASE_10E_V3_PREP=1 forbids execute (dry-only).");
  }
  if (process.env.PHASE_10E_ALLOW_EXECUTE === "1") {
    fail("Refuse legacy PHASE_10E_ALLOW_EXECUTE — use PHASE_10E_V3_ALLOW_EXECUTE.");
  }
  if (process.env.PHASE_10E_SMOKE_CONFIRM) {
    fail("Refuse legacy PHASE_10E_SMOKE_CONFIRM — use PHASE_10E_V3_SMOKE_CONFIRM.");
  }

  const confirm = process.env.PHASE_10E_V3_SMOKE_CONFIRM || "";
  const m = confirm.match(CONFIRM_RE);
  if (!m) {
    fail(
      "Confirmation requise: PHASE_10E_V3_SMOKE_CONFIRM=ONE_NEW_ART_V3_CALL_MAX_<N>_CENTS"
    );
  }
  const ceilingMinor = Number(m[1]);
  if (!Number.isInteger(ceilingMinor) || ceilingMinor <= 0) {
    fail("Plafond invalide dans PHASE_10E_V3_SMOKE_CONFIRM");
  }

  if (!DRY_ONLY && !ALLOW_EXECUTE) {
    fail(
      "Execute refusé: set PHASE_10E_V3_ALLOW_EXECUTE=1 explicitly (after human auth)."
    );
  }

  const local = loadEnvFile(resolve(studioRoot, ".env.local"));
  let password = process.env.APP_PASSWORD || local.APP_PASSWORD;
  if (process.env.PHASE_10E_USE_VERCEL_PASSWORD !== "0") {
    const pulled = pullProductionPassword();
    if (pulled) password = pulled;
  }
  if (!password) fail("APP_PASSWORD absente.");

  const correlationId = `corr-10e-v3-${Date.now()}${DRY_ONLY ? "-dry" : "-exec"}`;

  console.log("=== PHASE 10E-V3 PREFLIGHT ===");
  console.log(`base=${BASE}`);
  console.log(`Director=Art (text only, new execute v3)`);
  console.log(`projectId=${PROJECT_ID}`);
  console.log(`artRetryRoute=FORBIDDEN`);
  console.log(`maxNewArtCalls=1`);
  console.log(`budget_ceiling_minor=${ceilingMinor}`);
  console.log(`correlationId=${correlationId}`);
  console.log(`dryOnly=${DRY_ONLY}`);
  console.log(`allowExecute=${ALLOW_EXECUTE}`);
  console.log(`expectedPrompt=${EXPECTED_PROMPT}`);
  console.log(`expectedSchema=${EXPECTED_SCHEMA}`);
  console.log("==============================");

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
    `${BASE}/api/director/projects/${PROJECT_ID}/art`,
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
  if (dryBody.existingVisualDirection) {
    fail("visual_direction already active — refuse smoke");
  }
  if (dryBody.promptVersion !== EXPECTED_PROMPT) {
    fail(
      `BLOCKED_CONFIG_DIVERGENCE: promptVersion=${dryBody.promptVersion} expected=${EXPECTED_PROMPT}`
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
  if (dryBody.retryCandidate) {
    fail("retryCandidate present — v3 new execute must not use /art/retry path");
  }

  const evidenceDir = resolve(studioRoot, ".tmp");
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = {
    phase: "10E-V3",
    mode: DRY_ONLY ? "dry-run" : "execute-pending",
    projectId: PROJECT_ID,
    correlationId,
    ceilingMinor,
    dryRun: {
      http: dryRes.status,
      provider: dryBody.provider ?? "openai",
      estimatedCostMinor: estimate,
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
      previousFailedRunIgnoredForNewContract:
        dryBody.previousFailedRunIgnoredForNewContract ?? null,
      providerCalled: dryBody.providerCalled,
      hasRetryCandidate: Boolean(dryBody.retryCandidate),
      videoScriptRevision: dryBody.videoScriptRevision ?? null,
      creativeConceptRevision: dryBody.creativeConceptRevision ?? null,
      marketingPlanRevision: dryBody.marketingPlanRevision ?? null,
    },
    guards: {
      maxNewArtTextCalls: 1,
      artRetryRoute: false,
      providerRetry: false,
      marketingReplay: false,
      creativeReplay: false,
      scriptReplay: false,
      storyboard: false,
      paidGenerationMustBeOff: true,
      workerMustBeOff: true,
      path: "/art",
      notPath: "/art/retry",
    },
  };

  if (DRY_ONLY) {
    const path = resolve(
      evidenceDir,
      `phase-10e-v3-smoke-dry-${Date.now()}.json`
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

  // ---- EXECUTE path — POST /art only (never /art/retry) ----
  const execRes = await fetch(
    `${BASE}/api/director/projects/${PROJECT_ID}/art`,
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
    hasVisualDirection: Boolean(execBody.visualDirection),
  };
  const path = resolve(evidenceDir, "phase-10e-v3-smoke-exec.json");
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

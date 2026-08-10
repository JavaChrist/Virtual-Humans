/**
 * Phase 10E — Art text smoke against Production Vercel (future execution).
 *
 * PREP default: PHASE_10E_DRY_ONLY=1 (or unset) → dry-run only, never execute.
 * Real execute requires explicit human auth AND PHASE_10E_ALLOW_EXECUTE=1.
 *
 * Reuses MarketingPlan + CreativeConcept + VideoScript — never regenerates them.
 * Max 1 Art text provider call; Marketing/Creative/Script/Storyboard/media/worker OFF.
 * Never calls /art/retry. Never starts media generation.
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

const CONFIRM_RE = /^ONE_ART_TEXT_CALL_MAX_(\d+)_CENTS$/;
const BASE =
  process.env.PHASE_10E_BASE_URL || "https://virtual-humans.vercel.app";
const PROJECT_ID =
  process.env.PHASE_10E_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const DRY_ONLY = process.env.PHASE_10E_DRY_ONLY !== "0";
const ALLOW_EXECUTE = process.env.PHASE_10E_ALLOW_EXECUTE === "1";

function fail(msg, code = 1) {
  console.error(`SMOKE_10E FAIL: ${msg}`);
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
  const tmp = resolve(studioRoot, `.env.vercel.10e.tmp`);
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
  if (process.env.CONFIRM_PHASE_10E_PREP === "1" && !DRY_ONLY) {
    fail("CONFIRM_PHASE_10E_PREP=1 forbids execute (dry-only).");
  }

  const confirm = process.env.PHASE_10E_SMOKE_CONFIRM || "";
  const m = confirm.match(CONFIRM_RE);
  if (!m) {
    fail(
      "Confirmation requise: PHASE_10E_SMOKE_CONFIRM=ONE_ART_TEXT_CALL_MAX_<N>_CENTS"
    );
  }
  const ceilingMinor = Number(m[1]);
  if (!Number.isInteger(ceilingMinor) || ceilingMinor <= 0) {
    fail("Plafond invalide dans PHASE_10E_SMOKE_CONFIRM");
  }

  if (!DRY_ONLY && !ALLOW_EXECUTE) {
    fail(
      "Execute refusé: set PHASE_10E_ALLOW_EXECUTE=1 explicitly (after human auth)."
    );
  }

  const local = loadEnvFile(resolve(studioRoot, ".env.local"));
  let password = process.env.APP_PASSWORD || local.APP_PASSWORD;
  if (process.env.PHASE_10E_USE_VERCEL_PASSWORD !== "0") {
    const pulled = pullProductionPassword();
    if (pulled) password = pulled;
  }
  if (!password) fail("APP_PASSWORD absente.");

  const correlationId = `corr-10e-${Date.now()}${DRY_ONLY ? "-dry" : "-exec"}`;

  console.log("=== PHASE 10E PREFLIGHT ===");
  console.log(`base=${BASE}`);
  console.log(`Director=Art (text only)`);
  console.log(`projectId=${PROJECT_ID}`);
  console.log(`reuseMarketingPlan=YES`);
  console.log(`reuseCreativeConcept=YES`);
  console.log(`reuseVideoScript=YES`);
  console.log(`createUpstream=NO`);
  console.log(`mediaGeneration=FORBIDDEN`);
  console.log(`artRetryRoute=FORBIDDEN`);
  console.log(`maxAttempts=1`);
  console.log(`budget_ceiling_minor=${ceilingMinor}`);
  console.log(`correlationId=${correlationId}`);
  console.log(`dryOnly=${DRY_ONLY}`);
  console.log(`allowExecute=${ALLOW_EXECUTE}`);
  console.log(
    "Marketing=disabled Creative=disabled Script=disabled Storyboard=disabled"
  );
  console.log("worker=disabled paid_media=disabled");
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

  const evidenceDir = resolve(studioRoot, ".tmp");
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = {
    phase: "10E",
    mode: DRY_ONLY ? "dry-run" : "execute-pending",
    projectId: PROJECT_ID,
    correlationId,
    ceilingMinor,
    dryRun: {
      http: dryRes.status,
      estimatedCostMinor: estimate,
      currency: dryBody.currency ?? null,
      pricingConfigured: dryBody.pricingConfigured ?? null,
      executable: dryBody.executable ?? null,
      executionAvailable: dryBody.executionAvailable ?? null,
      model: dryBody.model ?? null,
      reasoningEffort: dryBody.reasoningEffort ?? null,
      maxOutputTokens: dryBody.maxOutputTokens ?? null,
      marketingPlanRevision: dryBody.marketingPlanRevision ?? null,
      marketingPlanArtifactId: dryBody.marketingPlanArtifactId ?? null,
      creativeConceptRevision: dryBody.creativeConceptRevision ?? null,
      creativeConceptArtifactId: dryBody.creativeConceptArtifactId ?? null,
      videoScriptRevision: dryBody.videoScriptRevision ?? null,
      videoScriptArtifactId: dryBody.videoScriptArtifactId ?? null,
      providerCalled: dryBody.providerCalled,
      promptVersion: dryBody.promptVersion ?? null,
      schemaVersion: dryBody.schemaVersion ?? null,
      hasRetryCandidate: Boolean(dryBody.retryCandidate),
    },
    guards: {
      maxArtTextCalls: 1,
      mediaCalls: 0,
      marketingReplay: false,
      creativeReplay: false,
      scriptReplay: false,
      storyboard: false,
      artRetryRoute: false,
      providerRetry: false,
      paidGenerationMustBeOff: true,
      workerMustBeOff: true,
    },
  };

  if (DRY_ONLY) {
    const path = resolve(evidenceDir, `phase-10e-smoke-dry-${Date.now()}.json`);
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

  // ---- EXECUTE path (future 10E only) — no retry, no /art/retry ----
  const expectedVideoScriptRevision =
    dryBody.videoScriptRevision ??
    Number(process.env.PHASE_10E_EXPECTED_SCRIPT_REVISION || "1");
  const expectedCreativeConceptRevision =
    dryBody.creativeConceptRevision ??
    Number(process.env.PHASE_10E_EXPECTED_CREATIVE_REVISION || "1");
  const expectedMarketingPlanRevision =
    dryBody.marketingPlanRevision ??
    Number(process.env.PHASE_10E_EXPECTED_MARKETING_REVISION || "1");

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
        expectedVideoScriptRevision,
        expectedCreativeConceptRevision,
        expectedMarketingPlanRevision,
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
    code: execBody.code ?? null,
    topKeys: Object.keys(execBody),
    hasVisualDirection: Boolean(execBody.visualDirection),
  };
  const path = resolve(evidenceDir, "phase-10e-smoke-exec.json");
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

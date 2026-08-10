/**
 * Phase 10B — single Marketing text smoke against Production Vercel.
 * Max 1 provider call. Budget cap USD 1.00. No Creative/media/worker.
 *
 * Requires:
 *   PHASE_10B_SMOKE_CONFIRM=ONE_CALL_MAX_100_USD
 *   APP_PASSWORD via --env-file or process (never printed)
 *
 * Usage (from studio/):
 *   $env:PHASE_10B_SMOKE_CONFIRM="ONE_CALL_MAX_100_USD"
 *   node scripts/smoke-phase-10b-marketing-vercel.mjs
 */

import { randomUUID } from "node:crypto";
import { readFileSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");

const CONFIRM = "ONE_CALL_MAX_100_USD";
const MAX_COST_MINOR = 100; // USD 1.00
const BASE = process.env.PHASE_10B_BASE_URL || "https://virtual-humans.vercel.app";
const DRY_ONLY = process.env.PHASE_10B_DRY_ONLY === "1";

function fail(msg, code = 1) {
  console.error(`SMOKE_10B FAIL: ${msg}`);
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
  const tmp = resolve(studioRoot, `.env.vercel.10b.tmp`);
  try {
    const r = spawnSync(
      "npx",
      ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
      { encoding: "utf8", shell: true, cwd: studioRoot, env: process.env }
    );
    if (r.status !== 0) fail("vercel env pull failed (password).");
    const map = loadEnvFile(tmp);
    return map.APP_PASSWORD;
  } finally {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function parseSetCookie(res) {
  // Node fetch: getSetCookie if available
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieHeaderFromSetCookie(setCookies) {
  return setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function main() {
  if (process.env.PHASE_10B_SMOKE_CONFIRM !== CONFIRM) {
    fail(`Confirmation requise: PHASE_10B_SMOKE_CONFIRM=${CONFIRM}`);
  }

  const local = loadEnvFile(resolve(studioRoot, ".env.local"));
  let password = process.env.APP_PASSWORD || local.APP_PASSWORD;
  // Prefer Production password when available
  if (process.env.PHASE_10B_USE_VERCEL_PASSWORD !== "0") {
    const pulled = pullProductionPassword();
    if (pulled) password = pulled;
  }
  if (!password) fail("APP_PASSWORD absente.");

  const projectId = randomUUID();
  const artifactId = randomUUID();
  const correlationId = `corr-10b-${Date.now()}`;

  const fields = {
    projectName: "VHS 10B Marketing Smoke LinkedIn",
    subjectType: "service",
    subjectName: "Virtual Humans Studio",
    subjectDescription:
      "Application qui transforme un brief en projet vidéo structuré avec des présentateurs virtuels.",
    objective: "awareness",
    platform: "linkedin",
    durationSeconds: 30,
    aspectRatio: "16:9",
    language: "fr",
    tone: "professional",
    audienceDescription:
      "professionnels, freelances et petites entreprises",
    callToAction: "Découvrir Virtual Humans Studio",
    brandConstraints:
      "Ton professionnel, clair, accessible. Ne pas générer de vidéo. Expliquer simplement le passage brief → projet vidéo structuré.",
    mediaReferences: [],
  };

  console.log("=== PHASE 10B PREFLIGHT ===");
  console.log(`base=${BASE}`);
  console.log(`Director=Marketing`);
  console.log(`maxAttempts=1`);
  console.log(`budget_cap_usd=1.00 (${MAX_COST_MINOR} minor)`);
  console.log(`projectId=${projectId}`);
  console.log(`correlationId=${correlationId}`);
  console.log(`dryOnly=${DRY_ONLY}`);
  console.log("Creative=disabled Script=disabled Art=disabled Storyboard=disabled");
  console.log("worker=disabled paid_media=disabled");
  console.log("===========================");

  // Login
  const loginRes = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!loginRes.ok) {
    fail(`login HTTP ${loginRes.status}`);
  }
  const cookie = cookieHeaderFromSetCookie(parseSetCookie(loginRes));
  if (!cookie.includes("vh_auth=")) fail("session cookie missing");
  console.log("auth=OK");

  const headers = {
    "content-type": "application/json",
    cookie,
    "x-correlation-id": correlationId,
    // CSRF gate (proxy assertCsrf requireOrigin=true for cookie mutations)
    origin: BASE,
    referer: `${BASE}/director/new`,
  };

  // Create project + brief
  const createRes = await fetch(`${BASE}/api/director/projects`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      projectId,
      artifactId,
      expectedBriefRevision: 1,
      fields,
      correlationId,
    }),
  });
  const createBody = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    fail(
      `create project HTTP ${createRes.status} code=${createBody.code || "?"} msg=${String(createBody.error || "").slice(0, 120)}`
    );
  }
  console.log(
    `project=created status=${createBody.status} revision=${createBody.revision}`
  );

  // Dry-run
  const dryRes = await fetch(`${BASE}/api/director/projects/${projectId}/marketing`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "dry-run" }),
  });
  const dryJson = await dryRes.json().catch(() => ({}));
  if (!dryRes.ok) {
    fail(`dry-run HTTP ${dryRes.status} ${JSON.stringify(dryJson).slice(0, 200)}`);
  }
  const dry = dryJson.dryRun || dryJson;
  console.log("--- DRY-RUN ---");
  console.log(
    JSON.stringify(
      {
        executable: dry.executable,
        executionAvailable: dry.executionAvailable,
        providerCalled: dry.providerCalled,
        pricingConfigured: dry.pricingConfigured,
        estimatedCostMinor: dry.estimatedCostMinor,
        currency: dry.currency,
        model: dry.model,
        briefRevision: dry.briefRevision,
        promptVersion: dry.promptVersion,
        schemaVersion: dry.schemaVersion,
      },
      null,
      2
    )
  );

  if (dry.providerCalled !== false) fail("dry-run providerCalled≠false");
  if (!dry.executable) fail("dry-run not executable");
  if (!dry.executionAvailable) fail("executionAvailable=false");
  if (dry.estimatedCostMinor == null) fail("BUDGET_GUARD_NOT_PROVEN — estimate missing");
  if (dry.estimatedCostMinor > MAX_COST_MINOR) {
    fail(
      `BUDGET_BLOCKED — estimate ${dry.estimatedCostMinor} > ${MAX_COST_MINOR}`
    );
  }
  if (!dry.pricingConfigured) {
    fail("BUDGET_GUARD_NOT_PROVEN — pricingConfigured=false");
  }

  const evidencePath = resolve(
    studioRoot,
    "..",
    "docs",
    "Developer-Handover",
    "_phase_10b_evidence.json"
  );

  if (DRY_ONLY) {
    writeFileSync(
      evidencePath,
      JSON.stringify({ phase: "10B", stage: "dry-run-only", dry, projectId, correlationId }, null, 2)
    );
    console.log("DRY_ONLY=1 — STOP before provider call");
    console.log(`READY_FOR_SINGLE_REAL_PROVIDER_CALL (not executed)`);
    console.log(
      JSON.stringify({
        provider: "openai",
        model: dry.model,
        estimatedCostMinor: dry.estimatedCostMinor,
        capMinor: MAX_COST_MINOR,
        maxCalls: 1,
      })
    );
    process.exit(0);
  }

  console.log("READY_FOR_SINGLE_REAL_PROVIDER_CALL");
  console.log(
    JSON.stringify({
      provider: "openai",
      model: dry.model,
      estimatedCostMinor: dry.estimatedCostMinor,
      capMinor: MAX_COST_MINOR,
      maxCalls: 1,
    })
  );

  // Unique execute — no retry
  const execRes = await fetch(`${BASE}/api/director/projects/${projectId}/marketing`, {
    method: "POST",
    headers: { ...headers, "x-correlation-id": `${correlationId}-exec` },
    body: JSON.stringify({
      mode: "execute",
      expectedBriefRevision: dry.briefRevision,
    }),
  });
  const execBody = await execRes.json().catch(() => ({}));
  console.log("--- EXECUTE ---");
  console.log(`httpStatus=${execRes.status}`);
  // Redact large plan content for console — keep ids/status/cost
  const safeExec = {
    status: execBody.status,
    directorRunId: execBody.directorRunId ?? execBody.runId,
    correlationId: execBody.correlationId ?? `${correlationId}-exec`,
    planRevision: execBody.plan?.revision ?? execBody.revision,
    artifactId: execBody.plan?.artifactId ?? execBody.artifactId,
    estimatedCostMinor: execBody.estimatedCostMinor,
    actualCostMinor: execBody.actualCostMinor,
    reservedCostMinor: execBody.reservedCostMinor,
    costStatus: execBody.costStatus,
    model: execBody.model ?? dry.model,
    provider: execBody.provider ?? "openai",
    attempt: execBody.attemptNumber ?? execBody.attempt,
    error: execBody.error
      ? {
          code: execBody.error.code,
          retryable: execBody.error.retryable,
          message: String(execBody.error.message || "").slice(0, 160),
        }
      : undefined,
    publicMessage: execBody.publicMessage,
    code: execBody.code,
    hasPlan: Boolean(execBody.plan || execBody.marketingPlan),
  };
  console.log(JSON.stringify(safeExec, null, 2));

  writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        phase: "10B",
        base: BASE,
        projectId,
        artifactIdBrief: artifactId,
        correlationId,
        dry,
        executeHttpStatus: execRes.status,
        execute: execBody,
        safeExec,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`evidence_written=${evidencePath}`);

  if (execBody.status !== "completed" && execBody.status !== "succeeded" && execBody.status !== "ok") {
    // Still exit 0 for capture if we got a terminal failure after at most one call —
    // caller decides PASS/FAIL from evidence. Non-zero only for transport bugs.
    console.log(`EXECUTE_TERMINAL_STATUS=${execBody.status || "unknown"}`);
    process.exit(0);
  }
  console.log("EXECUTE_OK");
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  fail(msg.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]"));
});

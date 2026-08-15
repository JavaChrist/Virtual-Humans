#!/usr/bin/env node
/**
 * Phase 11B — first paid I2V single execution (HISTORICAL).
 * Auth consumed. This file must not submit again.
 * Lifecycle: attempt becomes terminal before job/run complete (see generation-attempt-terminal-state).
 *
 *   CONFIRM_PHASE_11B_I2V_FIRST_PAID_SINGLE_EXECUTION=1 \
 *   node --import tsx scripts/phase-11b-i2v-first-paid-single-execution.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { fal } from "@fal-ai/client";
import {
  applyGenerationAttemptTerminalToStore,
  resolveGenerationAttemptTerminalDecision,
} from "../src/application/production/generation-attempt-terminal-state.ts";
import {
  PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED,
  assertPhase11BPaidScriptMustNotResubmit,
} from "../src/application/production/phase-11b-i2v-attempt-terminal-state.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");

const AUTH = "AUTH_11B_I2V_FIRST_PAID_SINGLE_EXECUTION";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const SCENE_ID = "scene-2";
const STEP_ID = "i2v-kling-5s";
const SOURCE_ASSET_ID = "49284892-d6ba-5249-b645-4f55084361cc";
const SOURCE_CHECKSUM =
  "9ac484b7a1db3264330ee09ddcb197fa8d83e6735a3476c7af5ab1547ff317f0";
const SOURCE_PATH = `${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed/${SOURCE_ASSET_ID}.png`;
const MODEL = "fal-ai/kling-video/v2/master/image-to-video";
const CORRELATION = "11b-i2v-first-paid-single-execution";
const IDEMPOTENCY_KEY = `${PROJECT_ID}:phase-11b-i2v-paid-smoke-final-preflight-1.0.0:${SCENE_ID}:${STEP_ID}:1`;
const RESERVE_MINOR = 168;
const ESTIMATE_MINOR = 140;
const SIGN_TTL_SEC = 60;
const POLL_MS = 5000;
const POLL_MAX_MS = 12 * 60 * 1000;
const MAX_BYTES = 80 * 1024 * 1024;
const MOTION_PROMPT = "Subtle natural motion, same composition, no added text or logos.";

const FLAG_OPEN_ORDER = [
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "VHS11B_I2V_CAPABILITY_ENABLED",
  "VHS11B_I2V_PAID_ENABLED",
  "VHS11B_I2V_FAL_ENABLED",
  "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_WORKER_ENABLED",
];
const FLAG_CLOSE_ORDER = [...FLAG_OPEN_ORDER].reverse();
const FLAGS_ALWAYS_OFF = [
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_DOWNSTREAM_ENABLED",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_FAL_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
];

function fail(msg) {
  const err = new Error(msg);
  err.name = "Phase11BPaidExecutionStop";
  throw err;
}

function redact(value) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]");
}

function attemptRecord(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    runId: row.run_id,
    status: row.status,
    externalJobId: row.external_job_id ?? null,
    retryable: row.retryable ?? null,
    completedAt: row.completed_at ?? null,
    costStatus: row.cost_status ?? null,
    providerId: row.provider_id,
    modelId: row.model_id,
  };
}

async function persistAttemptTerminal(db, attemptId, outcome, nowIso) {
  const loaded = await db
    .from("generation_attempts")
    .select(
      "id,workspace_id,project_id,run_id,status,external_job_id,retryable,completed_at,cost_status,provider_id,model_id",
    )
    .eq("id", attemptId)
    .single();
  if (loaded.error || !loaded.data) fail("attempt missing for terminal persist");
  const current = attemptRecord(loaded.data);
  const decision = resolveGenerationAttemptTerminalDecision({
    outcome,
    attempt: current,
    expected: {
      workspaceId: current.workspaceId,
      projectId: current.projectId,
      runId: current.runId,
      attemptId: current.id,
      currentStatus: current.status,
    },
    nowIso,
    settlementCostStatus: "provisional",
  });
  const preview = applyGenerationAttemptTerminalToStore(
    {
      attempt: current,
      job: { status: "running", submitCount: 1, externalJobId: current.externalJobId },
      run: { status: "running" },
      providerCalls: 0,
      budgetWrites: 0,
      assetWrites: 0,
      flagsWritten: 0,
      ledgerWrites: 0,
    },
    decision,
  );
  if (preview.result === "conflict" || preview.result === "refused") {
    fail(`attempt terminal ${preview.result}`);
  }
  const patch = {
    retryable: false,
  };
  if (preview.result === "applied") {
    patch.status = preview.store.attempt.status;
    patch.completed_at = preview.store.attempt.completedAt;
    patch.cost_status = preview.store.attempt.costStatus;
  }
  const updated = await db
    .from("generation_attempts")
    .update(patch)
    .eq("id", attemptId)
    .eq("status", current.status)
    .select("id");
  if (updated.error) fail(`attempt terminal persist: ${updated.error.message}`);
}

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

function run(cmd, args) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: studioRoot,
    env: process.env,
  });
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
    "--scope",
    "javachrist-projects",
  ]);
  if (r.status === 0) {
    console.log(`FLAG | update | ${key} | ${value}`);
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
    "--scope",
    "javachrist-projects",
  ]);
  if (r.status === 0) {
    console.log(`FLAG | add | ${key} | ${value}`);
    return true;
  }
  console.log(`FLAG | FAIL | ${key}`);
  console.error(redact((r.stderr || r.stdout || "").slice(0, 240)));
  return false;
}

function applyFlags(keys, value) {
  let fails = 0;
  for (const key of keys) {
    if (!vercelEnvSet(key, value)) fails += 1;
  }
  return fails;
}

function assertResultHost(url) {
  if (!/^https:\/\//i.test(url)) fail("ingest: https only");
  if (/https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url)) {
    fail("ingest: hostile host");
  }
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    fail("ingest: unparseable result host");
  }
  if (host !== "fal.media" && !host.endsWith(".fal.media")) {
    fail("ingest: result host not allowlisted");
  }
}

function assertSignHost(url) {
  if (!/^https:\/\//i.test(url)) fail("sign: https only");
  const host = new URL(url).hostname.toLowerCase();
  if (host !== "supabase.co" && !host.endsWith(".supabase.co")) {
    fail("sign: host not allowlisted");
  }
}

async function budgetSnapshot(db) {
  const policy = await db
    .from("workspace_budget_policies")
    .select("hard_limit_minor")
    .eq("workspace_id", WORKSPACE_ID)
    .single();
  if (policy.error) fail(`budget policy: ${policy.error.message}`);
  const ledger = await db
    .from("cost_ledger")
    .select("amount_minor,cost_status")
    .eq("workspace_id", WORKSPACE_ID)
    .in("cost_status", ["committed", "provisional"]);
  if (ledger.error) fail(`ledger: ${ledger.error.message}`);
  const committed = (ledger.data ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  const active = await db
    .from("budget_reservations")
    .select("id,amount_minor,status,correlation_id")
    .eq("workspace_id", WORKSPACE_ID)
    .eq("status", "active");
  if (active.error) fail(`reservations: ${active.error.message}`);
  const reserved = (active.data ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  return {
    hard: Number(policy.data.hard_limit_minor),
    committed,
    reserved,
    available: Number(policy.data.hard_limit_minor) - committed - reserved,
    activeCount: (active.data ?? []).length,
    activeIds: (active.data ?? []).map((r) => String(r.id).slice(0, 8)),
  };
}

async function main() {
  if (process.env.CONFIRM_PHASE_11B_I2V_FIRST_PAID_SINGLE_EXECUTION !== "1") {
    fail("CONFIRM_PHASE_11B_I2V_FIRST_PAID_SINGLE_EXECUTION=1 is required");
  }
  assertPhase11BPaidScriptMustNotResubmit(PHASE_11B_I2V_PAID_SCRIPT_AUTH_CONSUMED);
  const local = loadEnvFile(join(studioRoot, ".env.local"));
  const remote = loadEnvFile(join(studioRoot, ".env.remote.local"));
  const falKey = process.env.FAL_KEY || remote.FAL_KEY || local.FAL_KEY;
  if (!falKey) fail("FAL_KEY missing");
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  const supabaseHost = new URL(remote.SUPABASE_URL).hostname;
  if (supabaseHost !== "ejdbksxaswhdtsudnmvi.supabase.co") {
    fail("unexpected Supabase host");
  }
  console.log("supabase_target=production");
  fal.config({ credentials: falKey });
  const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = {
    auth: AUTH,
    verdict: "BLOCKED_I2V_FIRST_PAID_SINGLE_EXECUTION_PRECONDITION",
    reservationCreated: false,
    reservationIdPrefix: null,
    runIdPrefix: null,
    jobIdPrefix: null,
    submitIntent: false,
    falSubmits: 0,
    falStatusPolls: 0,
    providerJobIdPrefix: null,
    providerStatus: null,
    signedUrlCount: 0,
    mediaSourceReads: 0,
    outputCount: 0,
    ingested: false,
    videoAssetPrefix: null,
    videoActive: false,
    qcTechnical: null,
    visualStatus: "unavailable_humanOnly",
    humanReviewPending: false,
    flagsOpened: false,
    flagsClosed: false,
    budgetBefore: null,
    budgetAfter: null,
    settlement: null,
    retry: 0,
    fallback: 0,
    downstream: 0,
  };

  let flagsOpened = false;
  let reservationIdForCleanup = null;
  let submittedOrUnknown = false;
  try {
    const before = await budgetSnapshot(db);
    report.budgetBefore = before;
    if (before.hard !== 437 || before.committed !== 249 || before.reserved !== 0 || before.available !== 188) {
      fail("BLOCKED_I2V_PAID_EXECUTION_PRICING_OR_BUDGET_DIVERGENCE");
    }
    if (before.activeCount !== 0) fail("active reservation already exists");

    const source = await db
      .from("assets")
      .select("id,status,checksum,mime_type,width,height,source_kind,storage_bucket,scene_id,provenance")
      .eq("id", SOURCE_ASSET_ID)
      .single();
    if (source.error) fail(`source: ${source.error.message}`);
    const prov = source.data.provenance ?? {};
    if (
      source.data.status !== "approved" ||
      source.data.checksum !== SOURCE_CHECKSUM ||
      source.data.mime_type !== "image/png" ||
      Number(source.data.width) !== 1024 ||
      Number(source.data.height) !== 1024 ||
      source.data.source_kind !== "internal" ||
      source.data.storage_bucket !== "director-final-assets" ||
      source.data.scene_id !== SCENE_ID ||
      String(prov.active) !== "false" ||
      String(prov.mediaRole) !== "composed_overlay_image"
    ) {
      fail("source asset metadata diverged");
    }

    const planId = randomUUID();
    const runId = randomUUID();
    const jobId = randomUUID();
    const attemptId = randomUUID();
    const reservationId = randomUUID();
    const videoAssetId = randomUUID();
    const qrId = randomUUID();
    report.runIdPrefix = runId.slice(0, 8);
    report.jobIdPrefix = jobId.slice(0, 8);
    report.reservationIdPrefix = reservationId.slice(0, 8);

    const planInsert = await db.from("project_artifacts").insert({
      id: planId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "generation_plan",
      revision: 3,
      schema_version: "phase-11b-i2v-paid-1.0.0",
      value: {
        capability: "video.image_to_video",
        provider: "fal",
        model: MODEL,
        durationSeconds: 5,
        sourceAssetId: SOURCE_ASSET_ID,
        maxSubmit: 1,
        maxOutput: 1,
        retry: 0,
        fallback: 0,
        downstream: false,
        humanReviewRequired: true,
        fingerprint: "6e7199283c45e940",
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      created_by: "phase-11b-i2v-paid",
      correlation_id: CORRELATION,
    });
    if (planInsert.error) fail(`plan insert: ${planInsert.error.message}`);

    const runInsert = await db.from("production_runs").insert({
      id: runId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      generation_plan_artifact_id: planId,
      generation_plan_revision: 3,
      status: "running",
      policy_version: "phase-11b-i2v-paid-1.0.0",
      estimated_cost_minor: ESTIMATE_MINOR,
      currency: "USD",
      correlation_id: CORRELATION,
      state: {
        capability: "video.image_to_video",
        reservationId,
        sourceAssetId: SOURCE_ASSET_ID,
        maxSubmit: 1,
        submitIntentPersisted: true,
        retry: 0,
        fallback: 0,
        downstream: false,
        humanReviewRequired: true,
      },
    });
    if (runInsert.error) fail(`run insert: ${runInsert.error.message}`);

    const jobInsert = await db.from("production_jobs").insert({
      id: jobId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      run_id: runId,
      scene_id: SCENE_ID,
      step_id: STEP_ID,
      attempt_id: attemptId,
      action: "video",
      provider_id: "fal",
      model_id: MODEL,
      status: "queued",
      max_attempts: 1,
      payload: {
        submitIntentPersisted: true,
        submitCount: 0,
        reservationId,
        sourceAssetId: SOURCE_ASSET_ID,
        durationSeconds: 5,
        retry: 0,
        fallback: 0,
        downstream: false,
      },
    });
    if (jobInsert.error) fail(`job insert: ${jobInsert.error.message}`);
    report.submitIntent = true;

    const attemptInsert = await db.from("generation_attempts").insert({
      id: attemptId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      run_id: runId,
      scene_id: SCENE_ID,
      step_id: STEP_ID,
      attempt_number: 1,
      kind: "primary",
      provider_id: "fal",
      model_id: MODEL,
      idempotency_key: IDEMPOTENCY_KEY,
      status: "started",
      estimate_minor: ESTIMATE_MINOR,
      currency: "USD",
    });
    if (attemptInsert.error) fail(`attempt insert: ${attemptInsert.error.message}`);

    const reserved = await db.rpc("reserve_budget", {
      p_id: reservationId,
      p_workspace_id: WORKSPACE_ID,
      p_project_id: PROJECT_ID,
      p_run_id: runId,
      p_attempt_id: attemptId,
      p_amount_minor: RESERVE_MINOR,
      p_currency: "USD",
      p_correlation_id: CORRELATION,
      p_ledger_idempotency_key: `reserve:${reservationId}`,
    });
    if (reserved.error) fail(`reserve: ${reserved.error.message}`);
    report.reservationCreated = true;
    reservationIdForCleanup = reservationId;
    const afterReserve = await budgetSnapshot(db);
    if (
      afterReserve.hard !== 437 ||
      afterReserve.committed !== 249 ||
      afterReserve.reserved !== 168 ||
      afterReserve.available !== 20 ||
      afterReserve.activeCount !== 1
    ) {
      fail(`reservation verify failed ${JSON.stringify(afterReserve)}`);
    }

    const openFails = applyFlags(FLAG_OPEN_ORDER, "1");
    const keepOffFails = applyFlags(FLAGS_ALWAYS_OFF, "0");
    if (openFails || keepOffFails) fail("flag open/verify failed");
    flagsOpened = true;
    report.flagsOpened = true;

    const signed = await db.storage.from("director-final-assets").createSignedUrl(SOURCE_PATH, SIGN_TTL_SEC);
    if (signed.error || !signed.data?.signedUrl) fail("signed URL create failed");
    assertSignHost(signed.data.signedUrl);
    report.signedUrlCount = 1;
    report.mediaSourceReads = 1;
    const imageUrl = signed.data.signedUrl;

    const prior = await db
      .from("production_jobs")
      .select("external_job_id,payload")
      .eq("id", jobId)
      .single();
    if (prior.error) fail(`pre-submit job: ${prior.error.message}`);
    if (prior.data.external_job_id) fail("providerJobId already exists");
    if (prior.data.payload?.submitCount) fail("prior submit exists");

    let requestId = null;
    try {
      const submitted = await fal.queue.submit(MODEL, {
        input: {
          prompt: MOTION_PROMPT,
          image_url: imageUrl,
          duration: "5",
        },
      });
      requestId = submitted.request_id;
      report.falSubmits = 1;
      submittedOrUnknown = true;
    } catch {
      submittedOrUnknown = true;
      report.providerStatus = "submission_unknown";
      await db
        .from("production_jobs")
        .update({
          status: "failed",
          error: { code: "submission_unknown", message: "submit threw; no resubmit" },
          payload: { ...(prior.data.payload ?? {}), submissionUnknown: true, submitCount: 0 },
        })
        .eq("id", jobId);
      report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_SUBMISSION_UNKNOWN_NO_RESUBMIT";
      await persistAttemptTerminal(db, attemptId, "submission_unknown", new Date().toISOString());
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }

    const persist = await db
      .from("production_jobs")
      .update({
        external_job_id: requestId,
        status: "running",
        payload: { ...(prior.data.payload ?? {}), submitCount: 1, submitIntentPersisted: true },
      })
      .eq("id", jobId)
      .is("external_job_id", null)
      .select("id");
    if (persist.error || !persist.data?.length) {
      report.providerStatus = "submission_unknown";
      report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_SUBMISSION_UNKNOWN_NO_RESUBMIT";
      await persistAttemptTerminal(db, attemptId, "submission_unknown", new Date().toISOString());
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }
    report.providerJobIdPrefix = String(requestId).slice(0, 8);
    await db
      .from("generation_attempts")
      .update({ external_job_id: requestId, status: "started" })
      .eq("id", attemptId);

    const started = Date.now();
    let status = "IN_QUEUE";
    let videoUrl = null;
    while (Date.now() - started < POLL_MAX_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      report.falStatusPolls += 1;
      const st = await fal.queue.status(MODEL, { requestId });
      status = st.status;
      report.providerStatus = status;
      if (status === "COMPLETED") {
        const result = await fal.queue.result(MODEL, { requestId });
        videoUrl = result?.data?.video?.url ?? result?.data?.videos?.[0]?.url ?? null;
        break;
      }
      if (status === "FAILED") break;
    }

    if (status !== "COMPLETED" || !videoUrl) {
      if (status === "FAILED") {
        report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_FAILED_NO_RETRY";
        await persistAttemptTerminal(db, attemptId, "provider_failed", new Date().toISOString());
        await db.from("production_jobs").update({ status: "failed" }).eq("id", jobId);
        await db.from("production_runs").update({ status: "failed" }).eq("id", runId);
      } else {
        report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_PROVIDER_JOB_PENDING_NO_RESUBMIT";
        await persistAttemptTerminal(db, attemptId, "provider_pending", new Date().toISOString());
      }
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }

    try {
      assertResultHost(videoUrl);
    } catch {
      report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_OUTPUT_QUARANTINED_NO_RETRY";
      await persistAttemptTerminal(db, attemptId, "quarantined", new Date().toISOString());
      report.budgetAfter = await budgetSnapshot(db);
      await db.from("production_jobs").update({
        status: "failed",
        error: { code: "output_quarantined", message: "result host rejected; no retry" },
      }).eq("id", jobId);
      return report;
    }
    const downloaded = await fetch(videoUrl, { redirect: "error" });
    if (!downloaded.ok) {
      report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_OUTPUT_QUARANTINED_NO_RETRY";
      await persistAttemptTerminal(db, attemptId, "quarantined", new Date().toISOString());
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }
    const mime = downloaded.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (mime !== "video/mp4" && mime !== "video/webm") {
      report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_OUTPUT_QUARANTINED_NO_RETRY";
      await persistAttemptTerminal(db, attemptId, "quarantined", new Date().toISOString());
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }
    const bytes = Buffer.from(await downloaded.arrayBuffer());
    if (bytes.length <= 0 || bytes.length > MAX_BYTES) {
      report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_OUTPUT_QUARANTINED_NO_RETRY";
      await persistAttemptTerminal(db, attemptId, "quarantined", new Date().toISOString());
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const ext = mime === "video/webm" ? "webm" : "mp4";
    const storagePath = `${WORKSPACE_ID}/${PROJECT_ID}/media/video/i2v/${videoAssetId}.${ext}`;
    const upload = await db.storage.from("director-final-assets").upload(storagePath, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (upload.error) fail(`storage upload: ${upload.error.message}`);

    const assetInsert = await db.from("assets").insert({
      id: videoAssetId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      run_id: runId,
      scene_id: SCENE_ID,
      step_id: STEP_ID,
      kind: "video",
      mime_type: mime,
      storage_bucket: "director-final-assets",
      storage_path: storagePath,
      source_kind: "internal",
      source_provider: "fal",
      external_job_id: requestId,
      checksum,
      size_bytes: bytes.length,
      duration_seconds: 5,
      provenance: {
        active: false,
        published: false,
        mergeRequested: false,
        exportRequested: false,
        downstreamRequested: false,
        mediaRole: "i2v_output_video",
        parentAssetId: SOURCE_ASSET_ID,
        parentChecksum: SOURCE_CHECKSUM,
        modelId: MODEL,
        providerId: "fal",
      },
      status: "pending_review",
    });
    if (assetInsert.error) fail(`asset insert: ${assetInsert.error.message}`);
    report.ingested = true;
    report.outputCount = 1;
    report.videoAssetPrefix = videoAssetId.slice(0, 8);
    report.videoActive = false;
    report.qcTechnical = {
      mime: true,
      size: true,
      checksum: true,
      duration: "assumed_5s_no_probe",
      dimensions: "unavailable",
      fps: "unavailable",
      probe: "unavailable",
      provenance: true,
    };
    report.visualStatus = "unavailable_humanOnly";

    const qrMax = await db
      .from("project_artifacts")
      .select("revision")
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "quality_report")
      .order("revision", { ascending: false })
      .limit(1);
    const qrRevision = Number(qrMax.data?.[0]?.revision ?? 0) + 1;
    const qrInsert = await db.from("project_artifacts").insert({
      id: qrId,
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "quality_report",
      revision: qrRevision,
      schema_version: "phase-11b-i2v-qc-1.0.0",
      value: {
        technicalStatus: "needs_review",
        visualStatus: "unavailable_humanOnly",
        humanReviewRequired: true,
        autoApprove: false,
        videoAssetId,
        checksum,
        bytes: bytes.length,
        mime,
        probe: "unavailable",
      },
      created_by: "phase-11b-i2v-paid",
      correlation_id: CORRELATION,
    });
    if (qrInsert.error) {
      console.log(`QC artifact insert skipped: ${redact(qrInsert.error.message)}`);
    }
    const prMax = await db
      .from("project_artifacts")
      .select("revision")
      .eq("project_id", PROJECT_ID)
      .eq("artifact_type", "production_result")
      .order("revision", { ascending: false })
      .limit(1);
    const prRevision = Number(prMax.data?.[0]?.revision ?? 0) + 1;
    const prInsert = await db.from("project_artifacts").insert({
      id: randomUUID(),
      workspace_id: WORKSPACE_ID,
      project_id: PROJECT_ID,
      artifact_type: "production_result",
      revision: prRevision,
      schema_version: "phase-11b-i2v-result-1.0.0",
      value: {
        capability: "video.image_to_video",
        videoAssetId,
        sourceAssetId: SOURCE_ASSET_ID,
        reviewRequest: {
          pending: true,
          decision: null,
          humanReviewRequired: true,
        },
        active: false,
        published: false,
        downstream: false,
      },
      created_by: "phase-11b-i2v-paid",
      correlation_id: CORRELATION,
    });
    if (prInsert.error) {
      console.log(`production_result insert skipped: ${redact(prInsert.error.message)}`);
    }

    await persistAttemptTerminal(db, attemptId, "success", new Date().toISOString());
    await db
      .from("production_jobs")
      .update({
        status: "completed",
        result: { outputAssetId: videoAssetId, checksum, bytes: bytes.length, mime },
      })
      .eq("id", jobId);
    await db
      .from("production_runs")
      .update({
        status: "completed",
        state: {
          capability: "video.image_to_video",
          reservationId,
          sourceAssetId: SOURCE_ASSET_ID,
          videoAssetId,
          reviewRequest: {
            sceneId: SCENE_ID,
            stepId: STEP_ID,
            attemptId,
            reasons: ["unavailable_humanOnly"],
            pending: true,
          },
          waitingReason: "needs_review",
          humanReviewRequired: true,
          downstream: false,
        },
      })
      .eq("id", runId);
    report.humanReviewPending = true;

    const commit = await db.rpc("commit_budget_reservation", {
      p_reservation_id: reservationId,
      p_amount_minor: ESTIMATE_MINOR,
      p_cost_status: "provisional",
      p_ledger_idempotency_key: `commit:${reservationId}`,
      p_expected_revision: 1,
    });
    if (commit.error) {
      report.settlement = { status: "uncertain", reason: redact(commit.error.message) };
    } else {
      report.settlement = {
        status: "provisional",
        amountMinor: ESTIMATE_MINOR,
        evidence: "official_fal_list_price_1.40_usd_no_invoice_field",
      };
    }
    report.verdict = "I2V_FIRST_PAID_SINGLE_EXECUTION_PRIVATE_HUMAN_REVIEW_PENDING";
    report.budgetAfter = await budgetSnapshot(db);
    return report;
  } finally {
    if (flagsOpened) {
      const closeFails = applyFlags(FLAG_CLOSE_ORDER, "0");
      const keepOffFails = applyFlags(FLAGS_ALWAYS_OFF, "0");
      report.flagsClosed = closeFails === 0 && keepOffFails === 0;
      if (!report.flagsClosed) {
        console.log("FLAG | close incomplete — fail-closed, no resubmit");
      }
      console.log("FLAG | finally executed");
    } else {
      report.flagsClosed = true;
    }
    if (reservationIdForCleanup && !submittedOrUnknown) {
      const released = await db.rpc("release_budget_reservation", {
        p_reservation_id: reservationIdForCleanup,
        p_ledger_idempotency_key: `release:${reservationIdForCleanup}`,
        p_expected_revision: 1,
      });
      report.settlement = released.error
        ? { status: "release_failed", reason: redact(released.error.message) }
        : { status: "released_before_submit", amountMinor: 0 };
    }
  }
}

const tmpDir = join(studioRoot, ".tmp");
mkdirSync(tmpDir, { recursive: true });
const outPath = join(tmpDir, "phase-11b-i2v-first-paid-single-execution-report.json");

main()
  .then((report) => {
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    if (String(report.verdict).startsWith("BLOCKED_")) process.exitCode = 2;
  })
  .catch((err) => {
    const report = {
      auth: AUTH,
      verdict: "BLOCKED_I2V_FIRST_PAID_SINGLE_EXECUTION_PRECONDITION",
      error: redact(err instanceof Error ? err.message : "error"),
    };
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.error(redact(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  });

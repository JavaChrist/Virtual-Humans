#!/usr/bin/env node
/**
 * Phase 11C — first paid Voice/TTS single execution.
 * One ElevenLabs submit. Flags closed in finally. No lipsync, no second submit.
 *
 *   CONFIRM_PHASE_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION=1 \
 *   node --import tsx scripts/phase-11c-voice-tts-first-paid-single-execution.mjs
 */
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  applyGenerationAttemptTerminalToStore,
  resolveGenerationAttemptTerminalDecision,
} from "../src/application/production/generation-attempt-terminal-state.ts";
import {
  PHASE_11C_BOUND_NARRATOR_BINDING_ID,
} from "../src/application/production/phase-11c-i2v-narrator-binding-apply.ts";
import {
  PHASE_11C_SEEDED_CONSENT_IDS,
  PHASE_11C_SEEDED_IDENTITY_IDS,
} from "../src/application/production/phase-11c-voice-identity-seed-apply.ts";
import {
  PHASE_11C_CANONICAL_CHAR_COUNT,
  PHASE_11C_CANONICAL_SCRIPT_ID,
  PHASE_11C_CANONICAL_TEXT_SHA256,
} from "../src/application/production/phase-11c-spoken-segment.ts";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "../src/application/production/phase-11b-i2v-attempt-terminal-state.ts";
import { PHASE_11B_I2V_GENERATION_PLAN_ID } from "../src/application/production/phase-11b-artifact-pointer-coherence.ts";
import {
  NARRATOR_FEMALE_VOICE_ENV,
} from "../src/application/production/phase-11c-voice-identity-catalog.ts";
import { hashVoiceSecret } from "../src/application/production/phase-11c-voice-secret-locator.ts";
import {
  PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH,
  PHASE_11C_VOICE_TTS_FIRST_PAID_VERDICT,
  PHASE_11C_VOICE_TTS_PAID_CAP_MINOR,
  PHASE_11C_VOICE_TTS_PAID_ESTIMATE_MINOR,
  PHASE_11C_VOICE_TTS_PAID_FLAG_CLOSE_ORDER,
  PHASE_11C_VOICE_TTS_PAID_FLAG_OPEN_ORDER,
  PHASE_11C_VOICE_TTS_PAID_FLAGS_ALWAYS_OFF,
  PHASE_11C_VOICE_TTS_PAID_SCRIPT_AUTH_CONSUMED,
  PHASE_11C_VOICE_TTS_PREFLIGHT_FINGERPRINT,
  assertCanonicalSpokenFingerprint,
  assertPhase11CVoiceMpegMagic,
  assertPhase11CVoiceTtsPaidNoDownstream,
  assertPhase11CVoiceTtsPaidPayloadRedacted,
  assertPhase11CVoiceTtsPaidScriptMustNotResubmit,
  buildPhase11CVoiceTtsPaidIdempotencyKey,
  buildPhase11CVoiceTtsPaidStoragePath,
  extractSegmentVoiceOverCandidate,
  phase11CVoiceTtsPaidDeterministicIds,
  planPhase11CVoiceTtsPaidExecution,
  readCallTimeNarratorFemaleVoiceId,
  redactPhase11CVoiceTtsPaidError,
  settlePhase11CVoiceTtsPaid,
} from "../src/application/production/phase-11c-voice-tts-first-paid-execution.ts";
import {
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_SCENE_ID,
  PHASE_11C_WORKSPACE_ID,
} from "../src/application/production/phase-11c-voice-allowlist.ts";
import {
  assertPhase11CVoiceOutputMime,
  assertPhase11CVoiceOutputSize,
  checksumPhase11CVoiceBuffer,
} from "../src/application/production/phase-11c-voice-ingest.ts";
import { evaluatePhase11CVoiceTechnicalQuality } from "../src/application/production/phase-11c-voice-qc.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const CORRELATION = "11c-voice-tts-first-paid-single-execution";
const STEP_ID = "voice-tts-segment-2";
const BUCKET = "director-final-assets";
const FEMALE_PREFIX = "99db51be34bc";
const SUBMIT_TIMEOUT_MS = 45_000;

function fail(msg) {
  const err = new Error(msg);
  err.name = "Phase11CVoiceTtsPaidStop";
  throw err;
}

function redact(value) {
  return redactPhase11CVoiceTtsPaidError(String(value ?? ""));
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
  const patch = { retryable: false };
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
  if (updated.error) fail(`attempt terminal persist: ${redact(updated.error.message)}`);
}

async function budgetSnapshot(db) {
  const policy = await db
    .from("workspace_budget_policies")
    .select("hard_limit_minor")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .single();
  if (policy.error) fail(`budget policy: ${redact(policy.error.message)}`);
  const ledger = await db
    .from("cost_ledger")
    .select("amount_minor,cost_status")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .in("cost_status", ["committed", "provisional"]);
  if (ledger.error) fail(`ledger: ${redact(ledger.error.message)}`);
  const committed = (ledger.data ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  const active = await db
    .from("budget_reservations")
    .select("id,amount_minor,status,correlation_id")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .eq("status", "active");
  if (active.error) fail(`reservations: ${redact(active.error.message)}`);
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

function probeMpeg(bytes) {
  const probePath = join(tmpdir(), `vhs-11c-voice-${Date.now()}.mp3`);
  try {
    writeFileSync(probePath, bytes);
    const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,bit_rate:stream=codec_name,sample_rate,channels", "-of", "json", probePath], {
      encoding: "utf8",
    });
    if (r.status !== 0) return { available: false, reason: "unavailable" };
    const parsed = JSON.parse(r.stdout || "{}");
    const stream = parsed.streams?.[0] ?? {};
    return {
      available: true,
      duration: parsed.format?.duration ?? null,
      bitrate: parsed.format?.bit_rate ?? null,
      codec: stream.codec_name ?? null,
      sampleRate: stream.sample_rate ?? null,
      channels: stream.channels ?? null,
    };
  } catch {
    return { available: false, reason: "unavailable" };
  } finally {
    try {
      unlinkSync(probePath);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  if (process.env.CONFIRM_PHASE_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION !== "1") {
    fail("CONFIRM_PHASE_11C_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION=1 is required");
  }
  assertPhase11CVoiceTtsPaidScriptMustNotResubmit(PHASE_11C_VOICE_TTS_PAID_SCRIPT_AUTH_CONSUMED);
  assertPhase11CVoiceTtsPaidNoDownstream({});

  const local = loadEnvFile(join(studioRoot, ".env.local"));
  const remote = loadEnvFile(join(studioRoot, ".env.remote.local"));
  const apiKey = process.env.ELEVENLABS_API_KEY || remote.ELEVENLABS_API_KEY || local.ELEVENLABS_API_KEY;
  if (!apiKey) fail("ELEVENLABS_API_KEY missing");
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  const supabaseHost = new URL(remote.SUPABASE_URL).hostname;
  if (supabaseHost !== "ejdbksxaswhdtsudnmvi.supabase.co") {
    fail("unexpected Supabase host");
  }
  const envForLocator = {
    [NARRATOR_FEMALE_VOICE_ENV]:
      process.env[NARRATOR_FEMALE_VOICE_ENV] || remote[NARRATOR_FEMALE_VOICE_ENV] || local[NARRATOR_FEMALE_VOICE_ENV],
  };
  const voiceId = readCallTimeNarratorFemaleVoiceId(envForLocator);
  const voiceFingerprint = hashVoiceSecret(voiceId);
  if (!voiceFingerprint.startsWith(FEMALE_PREFIX)) fail("narrator_female fingerprint mismatch");

  const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ids = phase11CVoiceTtsPaidDeterministicIds();
  const idempotencyKey = buildPhase11CVoiceTtsPaidIdempotencyKey();
  const report = {
    auth: PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH,
    verdict: "BLOCKED_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRECONDITION",
    reservationCreated: false,
    reservationIdPrefix: ids.reservationId.slice(0, 8),
    runIdPrefix: ids.runId.slice(0, 8),
    jobIdPrefix: ids.jobId.slice(0, 8),
    attemptIdPrefix: ids.attemptId.slice(0, 8),
    outputIdPrefix: ids.outputAssetId.slice(0, 8),
    idempotencyKeyPrefix: idempotencyKey.slice(0, 12),
    fingerprintPrefix: PHASE_11C_VOICE_TTS_PREFLIGHT_FINGERPRINT.slice(0, 12),
    narrator: "narrator_female",
    bindingIdPrefix: PHASE_11C_BOUND_NARRATOR_BINDING_ID.slice(0, 8),
    model: PHASE_11C_MODEL,
    provider: PHASE_11C_PROVIDER,
    elevenlabsSubmits: 0,
    otherProviderCalls: 0,
    submitCount: 0,
    providerRequestIdPrefix: null,
    providerStatus: null,
    signedUrlCount: 0,
    inputMediaReads: 0,
    audioIngests: 0,
    outputMediaWrites: 0,
    outputCount: 0,
    humanReviewDecisions: 0,
    lipsyncCalls: 0,
    downstreamCalls: 0,
    retries: 0,
    fallbacks: 0,
    secondSubmit: 0,
    voiceIdentitiesUpdated: 0,
    voiceConsentsUpdated: 0,
    projectBindingsUpdated: 0,
    outputActive: false,
    outputPublished: false,
    videoActive: false,
    videoPublished: false,
    flagsOpened: false,
    flagsClosed: false,
    flagsFinalOff: false,
    budgetBefore: null,
    budgetAfterReserve: null,
    budgetAfter: null,
    settlement: null,
    qc: null,
    probe: { available: false, reason: "unavailable" },
    replay: null,
    writes: {},
  };

  let flagsOpened = false;
  let reservationIdForCleanup = null;
  let submittedOrUnknown = false;
  try {
    const identities = await db.from("voice_identities").select("id,stable_key,status,revocable,active_for_provider_execution,secret_locator,voice_fingerprint").eq("workspace_id", PHASE_11C_WORKSPACE_ID);
    if (identities.error) fail(`identities: ${redact(identities.error.message)}`);
    const consents = await db.from("voice_consent_attestations").select("id,voice_identity_id,decision,scope,allowed_content_kinds,revoked_at,authorization_source").eq("workspace_id", PHASE_11C_WORKSPACE_ID);
    if (consents.error) fail(`consents: ${redact(consents.error.message)}`);
    const bindings = await db.from("project_voice_bindings").select("id,project_id,voice_identity_id,binding_role,allowed_content_kind,locale,selected_by,status,script_artifact_id,script_revision").eq("workspace_id", PHASE_11C_WORKSPACE_ID);
    if (bindings.error) fail(`bindings: ${redact(bindings.error.message)}`);
    if ((identities.data ?? []).length !== 4 || (consents.data ?? []).length !== 4 || (bindings.data ?? []).length !== 1) {
      fail("voice tables are not 4/4/1");
    }
    const female = (identities.data ?? []).find((r) => r.id === PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female);
    if (
      !female ||
      female.stable_key !== "narrator_female" ||
      female.status !== "available" ||
      female.revocable !== true ||
      female.active_for_provider_execution !== false ||
      female.secret_locator !== `env:${NARRATOR_FEMALE_VOICE_ENV}` ||
      !String(female.voice_fingerprint ?? "").startsWith(FEMALE_PREFIX)
    ) {
      fail("narrator_female identity diverged");
    }
    if ((identities.data ?? []).some((r) => r.active_for_provider_execution === true)) {
      fail("provider-active identity exists");
    }
    const femaleConsent = (consents.data ?? []).find((r) => r.id === PHASE_11C_SEEDED_CONSENT_IDS.narrator_female);
    if (
      !femaleConsent ||
      femaleConsent.decision !== "authorized" ||
      femaleConsent.scope !== "workspace_voice_over" ||
      !Array.isArray(femaleConsent.allowed_content_kinds) ||
      !femaleConsent.allowed_content_kinds.includes("voice_over") ||
      femaleConsent.revoked_at
    ) {
      fail("narrator_female consent diverged");
    }
    const binding = (bindings.data ?? [])[0];
    if (
      binding.id !== PHASE_11C_BOUND_NARRATOR_BINDING_ID ||
      binding.project_id !== PHASE_11C_PROJECT_ID ||
      binding.voice_identity_id !== PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female ||
      binding.binding_role !== "narrator" ||
      binding.allowed_content_kind !== "voice_over" ||
      binding.locale !== "fr" ||
      binding.selected_by !== "christian" ||
      binding.status !== "prepared" ||
      binding.script_artifact_id !== PHASE_11C_CANONICAL_SCRIPT_ID ||
      Number(binding.script_revision) !== 1
    ) {
      fail("binding diverged");
    }
    if ((bindings.data ?? []).some((r) => r.binding_role === "narrator" && r.voice_identity_id !== PHASE_11C_SEEDED_IDENTITY_IDS.narrator_female)) {
      fail("narrator_male selected");
    }

    const script = await db
      .from("project_artifacts")
      .select("id,revision,value")
      .eq("id", PHASE_11C_CANONICAL_SCRIPT_ID)
      .single();
    if (script.error) fail(`script: ${redact(script.error.message)}`);
    if (Number(script.data.revision) !== 1) fail("script revision diverged");
    const spoken = extractSegmentVoiceOverCandidate(script.data.value);
    assertCanonicalSpokenFingerprint(spoken);
    if (spoken.length !== PHASE_11C_CANONICAL_CHAR_COUNT || spoken.textSha256 !== PHASE_11C_CANONICAL_TEXT_SHA256) {
      fail("spoken hash/length diverged");
    }

    const i2vPlan = await db
      .from("project_artifacts")
      .select("id,revision")
      .eq("id", PHASE_11B_I2V_GENERATION_PLAN_ID)
      .single();
    if (i2vPlan.error) fail(`i2v plan: ${redact(i2vPlan.error.message)}`);
    if (Number(i2vPlan.data.revision) !== 3) fail("i2v plan revision diverged");

    const video = await db
      .from("assets")
      .select("id,status,storage_bucket,provenance")
      .eq("id", PHASE_11B_LIVE_VIDEO_ASSET_ID)
      .single();
    if (video.error) fail(`video: ${redact(video.error.message)}`);
    const videoProv = video.data.provenance ?? {};
    report.videoActive = videoProv.active === true;
    report.videoPublished = videoProv.published === true;
    if (video.data.status !== "approved" || video.data.storage_bucket !== BUCKET || report.videoActive || report.videoPublished) {
      fail("i2v video state diverged");
    }

    const existingRun = await db.from("production_runs").select("id").eq("id", ids.runId).maybeSingle();
    if (existingRun.error) fail(`existing run: ${redact(existingRun.error.message)}`);
    const existingJob = await db.from("production_jobs").select("id,payload,external_job_id").eq("id", ids.jobId).maybeSingle();
    if (existingJob.error) fail(`existing job: ${redact(existingJob.error.message)}`);
    const existingAudio = await db
      .from("assets")
      .select("id")
      .eq("project_id", PHASE_11C_PROJECT_ID)
      .eq("kind", "audio")
      .eq("id", ids.outputAssetId)
      .maybeSingle();
    if (existingAudio.error) fail(`existing audio: ${redact(existingAudio.error.message)}`);
    const existingReservation = await db.from("budget_reservations").select("id,status").eq("id", ids.reservationId).maybeSingle();
    if (existingReservation.error) fail(`existing reservation: ${redact(existingReservation.error.message)}`);
    const planner = planPhase11CVoiceTtsPaidExecution(
      existingRun.data || existingJob.data || existingReservation.data
        ? {
            reservationId: existingReservation.data?.id,
            runId: existingRun.data?.id,
            jobId: existingJob.data?.id,
            submitCount: Number(existingJob.data?.payload?.submitCount ?? 0),
            providerJobId: existingJob.data?.external_job_id ?? null,
            reservationActive: existingReservation.data?.status === "active",
            submissionUnknown: Boolean(existingJob.data?.payload?.submissionUnknown),
          }
        : null,
    );
    if (!planner.maySubmit) {
      fail("existing Voice execution for this fingerprint — no second submit");
    }
    if (existingAudio.data) fail("audio output already exists");

    const before = await budgetSnapshot(db);
    report.budgetBefore = before;
    if (before.hard !== 437 || before.committed !== 389 || before.reserved !== 0 || before.available !== 48) {
      fail(`budget diverged ${JSON.stringify(before)}`);
    }
    if (before.available < PHASE_11C_VOICE_TTS_PAID_CAP_MINOR) fail("available budget below 2¢ cap");

    const planInsert = await db.from("project_artifacts").insert({
      id: ids.planId,
      workspace_id: PHASE_11C_WORKSPACE_ID,
      project_id: PHASE_11C_PROJECT_ID,
      artifact_type: "generation_plan",
      revision: 4,
      schema_version: "phase-11c-voice-tts-first-paid-1.0.0",
      value: {
        capability: "audio.voice",
        provider: PHASE_11C_PROVIDER,
        model: PHASE_11C_MODEL,
        narrator: "narrator_female",
        bindingId: PHASE_11C_BOUND_NARRATOR_BINDING_ID,
        segmentId: "segment-2",
        textSha256: PHASE_11C_CANONICAL_TEXT_SHA256,
        charCount: PHASE_11C_CANONICAL_CHAR_COUNT,
        maxSubmit: 1,
        maxOutput: 1,
        retry: 0,
        fallback: 0,
        downstream: false,
        humanReviewRequired: true,
        fingerprint: PHASE_11C_VOICE_TTS_PREFLIGHT_FINGERPRINT,
        idempotencyKey,
      },
      created_by: "phase-11c-voice-tts-paid",
      correlation_id: CORRELATION,
    });
    if (planInsert.error) fail(`plan insert: ${redact(planInsert.error.message)}`);
    report.writes.generation_plan = 1;
    assertPhase11CVoiceTtsPaidPayloadRedacted({
      capability: "audio.voice",
      textSha256: PHASE_11C_CANONICAL_TEXT_SHA256,
    });

    const runInsert = await db.from("production_runs").insert({
      id: ids.runId,
      workspace_id: PHASE_11C_WORKSPACE_ID,
      project_id: PHASE_11C_PROJECT_ID,
      generation_plan_artifact_id: ids.planId,
      generation_plan_revision: 4,
      status: "running",
      policy_version: "phase-11c-voice-tts-first-paid-1.0.0",
      estimated_cost_minor: PHASE_11C_VOICE_TTS_PAID_ESTIMATE_MINOR,
      currency: "USD",
      correlation_id: CORRELATION,
      state: {
        capability: "audio.voice",
        reservationId: ids.reservationId,
        narrator: "narrator_female",
        bindingId: PHASE_11C_BOUND_NARRATOR_BINDING_ID,
        fingerprint: PHASE_11C_VOICE_TTS_PREFLIGHT_FINGERPRINT,
        maxSubmit: 1,
        submitIntentPersisted: true,
        retry: 0,
        fallback: 0,
        downstream: false,
        humanReviewRequired: true,
      },
    });
    if (runInsert.error) fail(`run insert: ${redact(runInsert.error.message)}`);
    report.writes.production_runs = 1;

    const jobInsert = await db.from("production_jobs").insert({
      id: ids.jobId,
      workspace_id: PHASE_11C_WORKSPACE_ID,
      project_id: PHASE_11C_PROJECT_ID,
      run_id: ids.runId,
      scene_id: PHASE_11C_SCENE_ID,
      step_id: STEP_ID,
      attempt_id: ids.attemptId,
      action: "voice",
      provider_id: PHASE_11C_PROVIDER,
      model_id: PHASE_11C_MODEL,
      status: "queued",
      max_attempts: 1,
      payload: {
        submitIntentPersisted: true,
        submitCount: 0,
        reservationId: ids.reservationId,
        narrator: "narrator_female",
        bindingId: PHASE_11C_BOUND_NARRATOR_BINDING_ID,
        segmentId: "segment-2",
        textSha256: PHASE_11C_CANONICAL_TEXT_SHA256,
        charCount: PHASE_11C_CANONICAL_CHAR_COUNT,
        fingerprint: PHASE_11C_VOICE_TTS_PREFLIGHT_FINGERPRINT,
        retry: 0,
        fallback: 0,
        downstream: false,
      },
    });
    if (jobInsert.error) fail(`job insert: ${redact(jobInsert.error.message)}`);
    report.writes.production_jobs = 1;

    const attemptInsert = await db.from("generation_attempts").insert({
      id: ids.attemptId,
      workspace_id: PHASE_11C_WORKSPACE_ID,
      project_id: PHASE_11C_PROJECT_ID,
      run_id: ids.runId,
      scene_id: PHASE_11C_SCENE_ID,
      step_id: STEP_ID,
      attempt_number: 1,
      kind: "primary",
      provider_id: PHASE_11C_PROVIDER,
      model_id: PHASE_11C_MODEL,
      idempotency_key: idempotencyKey,
      status: "started",
      estimate_minor: PHASE_11C_VOICE_TTS_PAID_ESTIMATE_MINOR,
      currency: "USD",
    });
    if (attemptInsert.error) fail(`attempt insert: ${redact(attemptInsert.error.message)}`);
    report.writes.generation_attempts = 1;

    const reserved = await db.rpc("reserve_budget", {
      p_id: ids.reservationId,
      p_workspace_id: PHASE_11C_WORKSPACE_ID,
      p_project_id: PHASE_11C_PROJECT_ID,
      p_run_id: ids.runId,
      p_attempt_id: ids.attemptId,
      p_amount_minor: PHASE_11C_VOICE_TTS_PAID_CAP_MINOR,
      p_currency: "USD",
      p_correlation_id: CORRELATION,
      p_ledger_idempotency_key: `reserve:${ids.reservationId}`,
    });
    if (reserved.error) fail(`reserve: ${redact(reserved.error.message)}`);
    report.reservationCreated = true;
    report.writes.budget_reservations = 1;
    reservationIdForCleanup = ids.reservationId;
    const afterReserve = await budgetSnapshot(db);
    report.budgetAfterReserve = afterReserve;
    if (
      afterReserve.hard !== 437 ||
      afterReserve.committed !== 389 ||
      afterReserve.reserved !== 2 ||
      afterReserve.available !== 46 ||
      afterReserve.activeCount !== 1
    ) {
      fail(`reservation verify failed ${JSON.stringify(afterReserve)}`);
    }

    const prior = await db
      .from("production_jobs")
      .select("external_job_id,payload")
      .eq("id", ids.jobId)
      .single();
    if (prior.error) fail(`pre-submit job: ${redact(prior.error.message)}`);
    if (prior.data.external_job_id) fail("providerJobId already exists");
    if (prior.data.payload?.submitCount) fail("prior submit exists");

    const openFails = applyFlags(PHASE_11C_VOICE_TTS_PAID_FLAG_OPEN_ORDER, "1");
    const keepOffFails = applyFlags(PHASE_11C_VOICE_TTS_PAID_FLAGS_ALWAYS_OFF, "0");
    if (openFails || keepOffFails) fail("flag open/verify failed");
    flagsOpened = true;
    report.flagsOpened = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    let requestStarted = false;
    let bytes = null;
    let mime = "";
    let requestId = null;
    try {
      requestStarted = true;
      const submitted = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: spoken.text,
            model_id: PHASE_11C_MODEL,
          }),
          signal: controller.signal,
        },
      );
      requestId = submitted.headers.get("request-id") || submitted.headers.get("x-request-id");
      mime = submitted.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
      if (!submitted.ok) {
        const certain = submitted.status >= 400 && submitted.status < 500 && submitted.status !== 408 && submitted.status !== 429;
        submittedOrUnknown = !certain;
        report.elevenlabsSubmits = 1;
        report.providerStatus = certain ? `http_${submitted.status}` : "submission_unknown";
        report.verdict = certain
          ? "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_FAILED_NO_RETRY"
          : "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_SUBMISSION_UNKNOWN_NO_RESUBMIT";
        await persistAttemptTerminal(db, ids.attemptId, certain ? "provider_failed" : "submission_unknown", new Date().toISOString());
        await db
          .from("production_jobs")
          .update({
            status: "failed",
            error: { code: certain ? "provider_failed" : "submission_unknown", message: "no resubmit" },
            payload: { ...(prior.data.payload ?? {}), submitCount: 1, submissionUnknown: !certain },
          })
          .eq("id", ids.jobId);
        report.submitCount = 1;
        if (!certain) {
          const held = settlePhase11CVoiceTtsPaid({ demonstratedMinor: null });
          const commit = await db.rpc("commit_budget_reservation", {
            p_reservation_id: ids.reservationId,
            p_amount_minor: held.amountMinor,
            p_cost_status: "provisional",
            p_ledger_idempotency_key: `commit:${ids.reservationId}`,
            p_expected_revision: 1,
          });
          report.settlement = commit.error
            ? { status: "uncertain", reason: redact(commit.error.message) }
            : { status: "provisional", amountMinor: held.amountMinor, evidence: "ambiguous_http_no_firm_cost" };
          reservationIdForCleanup = null;
        }
        report.budgetAfter = await budgetSnapshot(db);
        return report;
      }
      const buffer = Buffer.from(await submitted.arrayBuffer());
      bytes = new Uint8Array(buffer);
      report.elevenlabsSubmits = 1;
      submittedOrUnknown = true;
    } catch {
      submittedOrUnknown = requestStarted;
      report.elevenlabsSubmits = requestStarted ? 1 : 0;
      report.providerStatus = requestStarted ? "submission_unknown" : "failed_before_accept";
      report.verdict = requestStarted
        ? "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_SUBMISSION_UNKNOWN_NO_RESUBMIT"
        : "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_FAILED_NO_RETRY";
      await persistAttemptTerminal(
        db,
        ids.attemptId,
        requestStarted ? "submission_unknown" : "provider_failed",
        new Date().toISOString(),
      );
      await db
        .from("production_jobs")
        .update({
          status: "failed",
          error: { code: requestStarted ? "submission_unknown" : "failed_before_accept", message: "no resubmit" },
          payload: { ...(prior.data.payload ?? {}), submitCount: requestStarted ? 1 : 0, submissionUnknown: requestStarted },
        })
        .eq("id", ids.jobId);
      report.submitCount = requestStarted ? 1 : 0;
      if (requestStarted) {
        const held = settlePhase11CVoiceTtsPaid({ demonstratedMinor: null });
        const commit = await db.rpc("commit_budget_reservation", {
          p_reservation_id: ids.reservationId,
          p_amount_minor: held.amountMinor,
          p_cost_status: "provisional",
          p_ledger_idempotency_key: `commit:${ids.reservationId}`,
          p_expected_revision: 1,
        });
        report.settlement = commit.error
          ? { status: "uncertain", reason: redact(commit.error.message) }
          : { status: "provisional", amountMinor: held.amountMinor, evidence: "ambiguous_timeout_no_firm_cost" };
        reservationIdForCleanup = null;
      }
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    } finally {
      clearTimeout(timer);
    }

    const persist = await db
      .from("production_jobs")
      .update({
        external_job_id: requestId ? String(requestId).slice(0, 64) : null,
        status: "running",
        payload: { ...(prior.data.payload ?? {}), submitCount: 1, submitIntentPersisted: true },
      })
      .eq("id", ids.jobId)
      .select("id");
    if (persist.error || !persist.data?.length) {
      report.providerStatus = "submission_unknown";
      report.verdict = "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_SUBMISSION_UNKNOWN_NO_RESUBMIT";
      report.submitCount = 1;
      report.secondSubmit = 0;
      await persistAttemptTerminal(db, ids.attemptId, "submission_unknown", new Date().toISOString());
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }
    report.submitCount = 1;
    report.providerRequestIdPrefix = requestId ? String(requestId).slice(0, 8) : null;
    report.providerStatus = "completed";

    try {
      assertPhase11CVoiceOutputMime(mime || "audio/mpeg");
      assertPhase11CVoiceOutputSize(bytes.byteLength);
      assertPhase11CVoiceMpegMagic(bytes);
    } catch {
      report.verdict = "VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_OUTPUT_QUARANTINED_NO_RETRY";
      await persistAttemptTerminal(db, ids.attemptId, "quarantined", new Date().toISOString());
      await db.from("production_jobs").update({
        status: "failed",
        error: { code: "output_quarantined", message: "audio rejected; no retry" },
      }).eq("id", ids.jobId);
      const held = settlePhase11CVoiceTtsPaid({ demonstratedMinor: null });
      const commit = await db.rpc("commit_budget_reservation", {
        p_reservation_id: ids.reservationId,
        p_amount_minor: held.amountMinor,
        p_cost_status: "provisional",
        p_ledger_idempotency_key: `commit:${ids.reservationId}`,
        p_expected_revision: 1,
      });
      report.settlement = commit.error
        ? { status: "uncertain", reason: redact(commit.error.message) }
        : { status: "provisional", amountMinor: held.amountMinor, evidence: "quarantined_no_firm_cost" };
      reservationIdForCleanup = null;
      report.budgetAfter = await budgetSnapshot(db);
      return report;
    }

    const checksum = checksumPhase11CVoiceBuffer(bytes);
    const storagePath = buildPhase11CVoiceTtsPaidStoragePath(ids.outputAssetId);
    const upload = await db.storage.from(BUCKET).upload(storagePath, Buffer.from(bytes), {
      contentType: "audio/mpeg",
      upsert: false,
    });
    if (upload.error) fail(`storage upload: ${redact(upload.error.message)}`);
    report.audioIngests = 1;
    report.outputMediaWrites = 1;
    report.writes.storage_objects = 1;

    const provenance = {
      active: false,
      published: false,
      mediaRole: "voice_tts_output_audio",
      scriptArtifactId: PHASE_11C_CANONICAL_SCRIPT_ID,
      scriptRevision: 1,
      segmentId: "segment-2",
      textSha256: PHASE_11C_CANONICAL_TEXT_SHA256,
      charCount: PHASE_11C_CANONICAL_CHAR_COUNT,
      voiceFingerprintPrefix: FEMALE_PREFIX,
      narrator: "narrator_female",
      bindingId: PHASE_11C_BOUND_NARRATOR_BINDING_ID,
      outputAssetId: ids.outputAssetId,
      i2vVideoAssetId: PHASE_11B_LIVE_VIDEO_ASSET_ID,
      i2vVideoRole: "future_lipsync_context_only",
      bucket: BUCKET,
      modelId: PHASE_11C_MODEL,
      providerId: PHASE_11C_PROVIDER,
      lipsyncRequested: false,
      mergeRequested: false,
      exportRequested: false,
      downstreamRequested: false,
      lifecycle: "pending_review",
    };
    assertPhase11CVoiceTtsPaidPayloadRedacted(provenance);
    const assetInsert = await db.from("assets").insert({
      id: ids.outputAssetId,
      workspace_id: PHASE_11C_WORKSPACE_ID,
      project_id: PHASE_11C_PROJECT_ID,
      run_id: ids.runId,
      scene_id: PHASE_11C_SCENE_ID,
      step_id: STEP_ID,
      kind: "audio",
      mime_type: "audio/mpeg",
      storage_bucket: BUCKET,
      storage_path: storagePath,
      source_kind: "internal",
      source_provider: PHASE_11C_PROVIDER,
      external_job_id: requestId ? String(requestId).slice(0, 64) : null,
      checksum,
      size_bytes: bytes.byteLength,
      provenance,
      status: "pending_review",
    });
    if (assetInsert.error) fail(`asset insert: ${redact(assetInsert.error.message)}`);
    report.writes.assets = 1;
    report.outputCount = 1;
    report.outputActive = false;
    report.outputPublished = false;

    const probe = probeMpeg(Buffer.from(bytes));
    report.probe = probe;
    const qc = evaluatePhase11CVoiceTechnicalQuality({
      mime: "audio/mpeg",
      bytes: bytes.byteLength,
      checksum,
      expectedChecksum: checksum,
      durationSeconds: probe.available && probe.duration ? Number(probe.duration) : undefined,
      sampleRate: probe.available && probe.sampleRate ? Number(probe.sampleRate) : undefined,
      channels: probe.available && probe.channels ? Number(probe.channels) : undefined,
      bitrate: probe.available && probe.bitrate ? Number(probe.bitrate) : undefined,
      probeAvailable: probe.available,
      provenanceOk: true,
      estimateOk: true,
    });
    report.qc = {
      technicalStatus: qc.technicalStatus,
      perceptualStatus: qc.perceptualStatus,
      humanReviewRequired: qc.humanReviewRequired,
      autoApprove: qc.autoApprove,
      mime: qc.checks.mime,
      size: qc.checks.size,
      checksum: qc.checks.checksum,
      probe: probe.available ? "pass" : "unavailable",
    };

    await persistAttemptTerminal(db, ids.attemptId, "success", new Date().toISOString());
    report.writes.generation_attempts_terminal = 1;
    await db
      .from("production_jobs")
      .update({
        status: "completed",
        result: {
          outputAssetId: ids.outputAssetId,
          checksum,
          bytes: bytes.byteLength,
          mime: "audio/mpeg",
          lifecycle: "pending_review",
          active: false,
          published: false,
        },
      })
      .eq("id", ids.jobId);
    report.writes.production_jobs_complete = 1;
    await db
      .from("production_runs")
      .update({
        status: "completed",
        state: {
          capability: "audio.voice",
          reservationId: ids.reservationId,
          outputAssetId: ids.outputAssetId,
          narrator: "narrator_female",
          reviewRequest: {
            sceneId: PHASE_11C_SCENE_ID,
            stepId: STEP_ID,
            attemptId: ids.attemptId,
            reasons: ["unavailable_humanOnly"],
            pending: true,
            decision: null,
          },
          waitingReason: "needs_review",
          humanReviewRequired: true,
          downstream: false,
        },
      })
      .eq("id", ids.runId);
    report.writes.production_runs_complete = 1;

    const settlement = settlePhase11CVoiceTtsPaid({ demonstratedMinor: null });
    const commit = await db.rpc("commit_budget_reservation", {
      p_reservation_id: ids.reservationId,
      p_amount_minor: settlement.amountMinor,
      p_cost_status: settlement.costKind,
      p_ledger_idempotency_key: `commit:${ids.reservationId}`,
      p_expected_revision: 1,
    });
    if (commit.error) {
      report.settlement = { status: "uncertain", reason: redact(commit.error.message) };
    } else {
      report.settlement = {
        status: settlement.costKind,
        amountMinor: settlement.amountMinor,
        evidence: "no_firm_invoice_field_conservative_cap",
      };
      report.writes.cost_ledger_commit = 1;
    }
    reservationIdForCleanup = null;
    report.verdict = PHASE_11C_VOICE_TTS_FIRST_PAID_VERDICT;
    report.budgetAfter = await budgetSnapshot(db);
    report.replay = planPhase11CVoiceTtsPaidExecution({
      reservationId: ids.reservationId,
      runId: ids.runId,
      jobId: ids.jobId,
      attemptId: ids.attemptId,
      outputAssetId: ids.outputAssetId,
      submitCount: 1,
      reservationActive: false,
    });
    return report;
  } finally {
    if (flagsOpened) {
      const closeFails = applyFlags(PHASE_11C_VOICE_TTS_PAID_FLAG_CLOSE_ORDER, "0");
      const keepOffFails = applyFlags(PHASE_11C_VOICE_TTS_PAID_FLAGS_ALWAYS_OFF, "0");
      report.flagsClosed = closeFails === 0 && keepOffFails === 0;
      report.flagsFinalOff = report.flagsClosed;
      if (!report.flagsClosed) {
        console.log("FLAG | close incomplete — fail-closed, no resubmit");
      }
      console.log("FLAG | finally executed");
    } else {
      report.flagsClosed = true;
      report.flagsFinalOff = true;
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
      report.writes.budget_reservations_release = 1;
    }
  }
}

const tmpDir = join(studioRoot, ".tmp");
mkdirSync(tmpDir, { recursive: true });
const outPath = join(tmpDir, "phase-11c-voice-tts-first-paid-single-execution-report.json");

main()
  .then((report) => {
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    if (String(report.verdict).startsWith("BLOCKED_")) process.exitCode = 2;
  })
  .catch((err) => {
    const report = {
      auth: PHASE_11C_VOICE_TTS_FIRST_PAID_AUTH,
      verdict: "BLOCKED_VOICE_TTS_FIRST_PAID_SINGLE_EXECUTION_PRECONDITION",
      error: redact(err instanceof Error ? err.message : "error"),
    };
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
    console.error(redact(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  });

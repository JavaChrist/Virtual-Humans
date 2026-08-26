#!/usr/bin/env node
/**
 * Phase 11C — persist Human Review APPROVE on the first paid Voice/TTS audio.
 *
 *   CONFIRM_PHASE_11C_VOICE_TTS_HUMAN_REVIEW_APPROVE=1 \
 *     npx tsx scripts/phase-11c-voice-tts-human-review-approve-once.ts
 *
 * No ElevenLabs / no Storage media / no ledger / no activation / no signed URL.
 * Strategy C: Voice QR/PR are explicit and never become the project-active pointers.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertPhase11APayloadHasNoMediaLeak } from "@/application/production/phase-11a-human-review-reject";
import {
  PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
  PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
} from "@/application/production/phase-11b-artifact-pointer-coherence";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "@/application/production/phase-11b-i2v-attempt-terminal-state";
import { PHASE_11C_BOUND_NARRATOR_BINDING_ID } from "@/application/production/phase-11c-i2v-narrator-binding-apply";
import { PHASE_11C_PROJECT_ID, PHASE_11C_WORKSPACE_ID } from "@/application/production/phase-11c-voice-allowlist";
import {
  applyPhase11CVoiceApproveToAssetProvenance,
  applyPhase11CVoiceApproveToProductionResult,
  applyPhase11CVoiceApproveToQualityReport,
  applyPhase11CVoiceApproveToRunState,
  assertPhase11CVoiceApproveAttestation,
  assertPhase11CVoiceApprovedRemainsInactive,
  assertPhase11CVoiceI2vPointersFrozen,
  assertPhase11CVoiceRequestedDecisionIsApprove,
  assertPhase11CVoiceTtsHrAuthMatchesResume,
  phase11CVoiceApproveIdempotencyKey,
  phase11CVoiceScopedProductionResultId,
  phase11CVoiceScopedQualityReportId,
  resolvePhase11CVoiceReviewRequestId,
  PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
  PHASE_11C_VOICE_TTS_AUDIO_BYTES,
  PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
  PHASE_11C_VOICE_TTS_AUDIO_MIME,
  PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH,
  PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
  PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE,
  PHASE_11C_VOICE_TTS_HR_APPROVE_VERDICT,
  PHASE_11C_VOICE_TTS_HR_ATTEMPT_ID,
  PHASE_11C_VOICE_TTS_HR_JOB_ID,
  PHASE_11C_VOICE_TTS_HR_RUN_ID,
} from "@/application/production/phase-11c-voice-tts-human-review-approve";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_PREVIEW = resolve(studioRoot, ".tmp", "voice-tts-private-preview.mp3");
const ACTOR_TYPE = "shared_password";
const ACTOR_ID = "phase-11c-human-operator";
const CORRELATION_ID = "11c-voice-tts-hr-approve-once";
const REQUESTED_DECISION = "approved";
const HARD = 437;
const COMMITTED = 391;
const RESERVED = 0;
const AVAILABLE = 46;

const FLAG_KEYS = [
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "DIRECTOR_V2_PAID_AI_ENABLED",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_CAPABILITY_ENABLED",
  "VHS11B_I2V_PAID_ENABLED",
  "VHS11B_I2V_FAL_ENABLED",
  "VHS11B_FAL_I2V_DIRECTOR_EXCEPTION",
  "VHS11B_I2V_WORKER_ENABLED",
  "VHS11B_I2V_DOWNSTREAM_ENABLED",
  "VHS11C_VOICE_CAPABILITY_ENABLED",
  "VHS11C_VOICE_PAID_ENABLED",
  "VHS11C_VOICE_ELEVENLABS_ENABLED",
  "VHS11C_VOICE_WORKER_ENABLED",
  "VHS11C_ELEVENLABS_VOICE_DIRECTOR_EXCEPTION",
  "VHS11C_VOICE_DOWNSTREAM_ENABLED",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_FAL_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
];

function fail(msg: string): never {
  console.error(JSON.stringify({
    ok: false,
    stop: true,
    reason: msg,
    auth: PHASE_11C_VOICE_TTS_HR_APPROVE_AUTH,
  }));
  process.exit(2);
}

function loadEnvFile(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2] ?? "";
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map[m[1]!] = v;
  }
  return map;
}

function remoteDb() {
  const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
  for (const key of FLAG_KEYS) {
    const v = (remote[key] || process.env[key] || "0").trim().toLowerCase();
    if (v === "1" || v === "true") fail(`flag_not_off:${key}`);
  }
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  const host = new URL(remote.SUPABASE_URL).hostname;
  if (host !== "ejdbksxaswhdtsudnmvi.supabase.co") fail("unexpected Supabase host");
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function verifyLocalPreview(): { bytes: number; checksum: string } {
  if (!existsSync(LOCAL_PREVIEW)) fail("BLOCKED_LOCAL_PREVIEW_MISSING");
  const bytes = Number(statSync(LOCAL_PREVIEW).size);
  if (bytes !== PHASE_11C_VOICE_TTS_AUDIO_BYTES) fail("BLOCKED_LOCAL_PREVIEW_SIZE");
  const checksum = createHash("sha256").update(readFileSync(LOCAL_PREVIEW)).digest("hex");
  if (checksum !== PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM) fail("BLOCKED_LOCAL_PREVIEW_CHECKSUM");
  return { bytes, checksum };
}

async function budgetSnapshot(db: SupabaseClient) {
  const { data: policy, error: pErr } = await db
    .from("workspace_budget_policies")
    .select("hard_limit_minor")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .single();
  if (pErr || !policy) fail("budget policy missing");
  const { data: ledgerRows, error: lErr } = await db
    .from("cost_ledger")
    .select("amount_minor,cost_status")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .in("cost_status", ["committed", "provisional"]);
  if (lErr) fail("ledger read failed");
  const committed = (ledgerRows ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  const { data: activeRes, error: rErr } = await db
    .from("budget_reservations")
    .select("id")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .eq("status", "active");
  if (rErr) fail("reservation read failed");
  const reserved = (activeRes ?? []).length;
  return {
    hard: Number(policy.hard_limit_minor),
    committed,
    reserved,
    available: Number(policy.hard_limit_minor) - committed - reserved,
  };
}

async function nextArtifactRevision(
  db: SupabaseClient,
  artifactType: "quality_report" | "production_result",
): Promise<number> {
  const { data, error } = await db
    .from("project_artifacts")
    .select("revision")
    .eq("project_id", PHASE_11C_PROJECT_ID)
    .eq("artifact_type", artifactType)
    .order("revision", { ascending: false })
    .limit(1);
  if (error) fail(`revision_read_${artifactType}`);
  return Number(data?.[0]?.revision ?? 0) + 1;
}

async function ensureScopedArtifact(
  db: SupabaseClient,
  input: {
    id: string;
    artifactType: "quality_report" | "production_result";
    value: Record<string, unknown>;
  },
): Promise<{ id: string; revision: number; created: boolean }> {
  const { data: existing, error: eErr } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", input.id)
    .maybeSingle();
  if (eErr) fail(`artifact_read_${input.artifactType}`);
  if (existing) {
    return { id: existing.id, revision: Number(existing.revision), created: false };
  }
  const revision = await nextArtifactRevision(db, input.artifactType);
  const { error: iErr } = await db.from("project_artifacts").insert({
    id: input.id,
    workspace_id: PHASE_11C_WORKSPACE_ID,
    project_id: PHASE_11C_PROJECT_ID,
    artifact_type: input.artifactType,
    revision,
    schema_version: "phase-11c-voice-tts-hr-approve-1.0.0",
    value: input.value,
    created_by: ACTOR_ID,
    correlation_id: CORRELATION_ID,
  });
  if (iErr) fail(`artifact_insert_${input.artifactType} ${iErr.message}`);
  return { id: input.id, revision, created: true };
}

async function main() {
  if (process.env.CONFIRM_PHASE_11C_VOICE_TTS_HUMAN_REVIEW_APPROVE !== "1") {
    fail("set CONFIRM_PHASE_11C_VOICE_TTS_HUMAN_REVIEW_APPROVE=1");
  }
  assertPhase11CVoiceTtsHrAuthMatchesResume();
  assertPhase11CVoiceRequestedDecisionIsApprove(REQUESTED_DECISION);
  assertPhase11CVoiceApproveAttestation(PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT);
  const local = verifyLocalPreview();
  const db = remoteDb();
  const nowIso = new Date().toISOString();

  const { data: audio, error: aErr } = await db
    .from("assets")
    .select("id,status,checksum,mime_type,size_bytes,storage_bucket,source_kind,provenance,run_id")
    .eq("id", PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID)
    .single();
  if (aErr || !audio) fail("BLOCKED_VOICE_HUMAN_REVIEW_TARGET_DIVERGENCE asset");
  const prov = asRecord(audio.provenance);
  if (
    audio.status !== "pending_review" ||
    String(prov.active) !== "false" ||
    String(prov.published ?? false) !== "false" ||
    audio.checksum !== PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM ||
    audio.mime_type !== PHASE_11C_VOICE_TTS_AUDIO_MIME ||
    Number(audio.size_bytes) !== PHASE_11C_VOICE_TTS_AUDIO_BYTES ||
    audio.storage_bucket !== "director-final-assets" ||
    audio.source_kind !== "internal" ||
    String(prov.mediaRole) !== "voice_tts_output_audio" ||
    audio.run_id !== PHASE_11C_VOICE_TTS_HR_RUN_ID ||
    local.checksum !== audio.checksum
  ) {
    fail("BLOCKED_VOICE_HUMAN_REVIEW_TARGET_DIVERGENCE metadata");
  }

  const { data: video } = await db
    .from("assets")
    .select("id,status,provenance")
    .eq("id", PHASE_11B_LIVE_VIDEO_ASSET_ID)
    .single();
  if (!video || video.status !== "approved") fail("i2v video diverged");
  const videoProv = asRecord(video.provenance);
  if (String(videoProv.active) === "true" || String(videoProv.published) === "true") {
    fail("i2v video activated");
  }

  const { data: qrActive } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PHASE_11C_PROJECT_ID)
    .eq("artifact_type", "quality_report")
    .single();
  const { data: prActive } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PHASE_11C_PROJECT_ID)
    .eq("artifact_type", "production_result")
    .single();
  assertPhase11CVoiceI2vPointersFrozen({
    activeQualityReportId: String(qrActive?.artifact_id ?? ""),
    activeProductionResultId: String(prActive?.artifact_id ?? ""),
    videoActive: false,
    videoPublished: false,
  });
  if (qrActive?.artifact_id !== PHASE_11B_ACTIVE_QUALITY_REPORT_ID) fail("active QR drifted");
  if (prActive?.artifact_id !== PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID) fail("active PR drifted");

  const { data: run, error: runErr } = await db
    .from("production_runs")
    .select("id,status,revision,state")
    .eq("id", PHASE_11C_VOICE_TTS_HR_RUN_ID)
    .single();
  if (runErr || !run || run.status !== "completed") fail("run not completed");
  if (asRecord(run.state).waitingReason !== "needs_review") fail("waitingReason not needs_review");

  const { data: job } = await db
    .from("production_jobs")
    .select("id,status,payload")
    .eq("id", PHASE_11C_VOICE_TTS_HR_JOB_ID)
    .single();
  if (!job || job.status !== "completed") fail("job not completed");
  const submitCount = Number(asRecord(job.payload).submitCount ?? 0);
  if (submitCount !== 1) fail("submitCount_not_1");

  const { data: attempt } = await db
    .from("generation_attempts")
    .select("id,status,retryable")
    .eq("id", PHASE_11C_VOICE_TTS_HR_ATTEMPT_ID)
    .single();
  if (!attempt || attempt.status !== "completed") fail("attempt not completed");

  const { count: identities } = await db
    .from("voice_identities")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID);
  const { count: consents } = await db
    .from("voice_consent_attestations")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID);
  const { count: bindings } = await db
    .from("project_voice_bindings")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID);
  if (identities !== 4 || consents !== 4 || bindings !== 1) fail("catalog_count_diverged");
  const { data: binding, error: bErr } = await db
    .from("project_voice_bindings")
    .select("id,voice_identity_id")
    .eq("id", PHASE_11C_BOUND_NARRATOR_BINDING_ID)
    .single();
  if (bErr || !binding) fail("binding missing");
  const { data: identity } = await db
    .from("voice_identities")
    .select("id,active_for_provider_execution")
    .eq("id", binding.voice_identity_id)
    .single();
  if (identity?.active_for_provider_execution === true) fail("identity_provider_active");

  const budget = await budgetSnapshot(db);
  if (budget.hard !== HARD || budget.committed !== COMMITTED || budget.reserved !== RESERVED || budget.available !== AVAILABLE) {
    fail(`budget diverged ${JSON.stringify(budget)}`);
  }

  const reviewRequestId = resolvePhase11CVoiceReviewRequestId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID);
  const idempotencyKey = phase11CVoiceApproveIdempotencyKey(reviewRequestId);
  const qualityReportId = phase11CVoiceScopedQualityReportId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID);
  const productionResultId = phase11CVoiceScopedProductionResultId(PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID);

  const { data: existingHr } = await db
    .from("human_review_decisions")
    .select("id,decision,comment,idempotency_key")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingHr && existingHr.decision !== "approved") fail("BLOCKED_VOICE_HUMAN_REVIEW_DECISION_CONFLICT");

  const facts = {
    audioAssetId: PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
    audioChecksumSha256: PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
    qualityReportId,
    productionResultId,
    reviewRequestId,
    decisionId: existingHr?.id ?? randomUUID(),
    nowIso,
  };
  const qrValue = applyPhase11CVoiceApproveToQualityReport({
    facts,
    technicalStatus: "needs_review",
  });
  const prValue = applyPhase11CVoiceApproveToProductionResult({ facts });
  assertPhase11APayloadHasNoMediaLeak(qrValue);
  assertPhase11APayloadHasNoMediaLeak(prValue);

  const qrArt = await ensureScopedArtifact(db, {
    id: qualityReportId,
    artifactType: "quality_report",
    value: qrValue,
  });
  const prArt = await ensureScopedArtifact(db, {
    id: productionResultId,
    artifactType: "production_result",
    value: prValue,
  });

  const { count: existingForQr } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("quality_report_artifact_id", qrArt.id);
  if ((existingForQr ?? 0) > 0 && !existingHr) fail("audio_decision_already_present");

  let persistStatus: "created" | "existing" = existingHr ? "existing" : "created";
  let resolvedDecisionId = facts.decisionId;
  if (!existingHr) {
    const { error: hrErr } = await db.from("human_review_decisions").insert({
      id: facts.decisionId,
      workspace_id: PHASE_11C_WORKSPACE_ID,
      project_id: PHASE_11C_PROJECT_ID,
      quality_report_artifact_id: qrArt.id,
      quality_report_revision: qrArt.revision,
      production_result_artifact_id: prArt.id,
      production_result_revision: prArt.revision,
      decision: "approved",
      comment: PHASE_11C_VOICE_TTS_HR_APPROVE_COMMENT,
      reviewed_issue_codes: [PHASE_11C_VOICE_TTS_HR_APPROVE_ISSUE_CODE],
      actor_type: ACTOR_TYPE,
      actor_id: ACTOR_ID,
      correlation_id: CORRELATION_ID,
      idempotency_key: idempotencyKey,
    });
    if (hrErr) fail("persist_failed " + hrErr.message);
    persistStatus = "created";
    resolvedDecisionId = facts.decisionId;
  } else {
    resolvedDecisionId = existingHr.id;
    persistStatus = "existing";
  }

  const { data: replayRow, error: replayErr } = await db
    .from("human_review_decisions")
    .select("id,decision")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .eq("idempotency_key", idempotencyKey)
    .single();
  if (replayErr || !replayRow || replayRow.id !== resolvedDecisionId || replayRow.decision !== "approved") {
    fail("replay_not_existing");
  }

  const { count: decisionsAfter } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("quality_report_artifact_id", qrArt.id);
  if (decisionsAfter !== 1) fail("voice_decision_count_" + String(decisionsAfter));
  const staleBlocked = decisionsAfter === 1;

  const nextProvenance = applyPhase11CVoiceApproveToAssetProvenance(prov, {
    reviewRequestId,
    decisionId: resolvedDecisionId,
  });
  const { error: assetErr } = await db
    .from("assets")
    .update({ status: "approved", provenance: nextProvenance })
    .eq("id", PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID)
    .eq("status", "pending_review");
  if (assetErr) fail("asset_update " + assetErr.message);

  const nextState = applyPhase11CVoiceApproveToRunState(asRecord(run.state), {
    nowIso,
    reviewRequestId,
    decisionId: resolvedDecisionId,
  });
  const runPatch: Record<string, unknown> = {
    status: "completed",
    state: nextState,
    updated_at: nowIso,
  };
  if (run.revision != null) runPatch.revision = Number(run.revision) + 1;
  let runQuery = db
    .from("production_runs")
    .update(runPatch)
    .eq("id", PHASE_11C_VOICE_TTS_HR_RUN_ID)
    .eq("status", "completed");
  if (run.revision != null) runQuery = runQuery.eq("revision", run.revision);
  const { error: runUpdErr } = await runQuery;
  if (runUpdErr) fail("run_update " + runUpdErr.message);

  const { data: audioAfter } = await db
    .from("assets")
    .select("id,status,checksum,size_bytes,storage_bucket,provenance")
    .eq("id", PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID)
    .single();
  if (!audioAfter || audioAfter.status !== "approved") fail("audio not approved");
  if (String(asRecord(audioAfter.provenance).active) !== "false") fail("audio activated");
  if (String(asRecord(audioAfter.provenance).published) !== "false") fail("audio published");
  if (audioAfter.checksum !== PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM) fail("checksum mutated");
  if (Number(audioAfter.size_bytes) !== PHASE_11C_VOICE_TTS_AUDIO_BYTES) fail("size mutated");
  if (audioAfter.storage_bucket !== "director-final-assets") fail("bucket mutated");

  const { data: videoAfter } = await db
    .from("assets")
    .select("id,status,provenance")
    .eq("id", PHASE_11B_LIVE_VIDEO_ASSET_ID)
    .single();
  if (videoAfter?.status !== "approved") fail("video mutated");
  if (String(asRecord(videoAfter?.provenance).active) === "true") fail("video activated");

  const { data: qrActiveAfter } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PHASE_11C_PROJECT_ID)
    .eq("artifact_type", "quality_report")
    .single();
  const { data: prActiveAfter } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PHASE_11C_PROJECT_ID)
    .eq("artifact_type", "production_result")
    .single();
  if (qrActiveAfter?.artifact_id !== PHASE_11B_ACTIVE_QUALITY_REPORT_ID) fail("active QR mutated");
  if (prActiveAfter?.artifact_id !== PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID) fail("active PR mutated");
  if (Number(qrActiveAfter?.revision) !== Number(qrActive?.revision)) fail("active QR revision mutated");
  if (Number(prActiveAfter?.revision) !== Number(prActive?.revision)) fail("active PR revision mutated");

  const { data: jobAfter } = await db
    .from("production_jobs")
    .select("status,payload")
    .eq("id", PHASE_11C_VOICE_TTS_HR_JOB_ID)
    .single();
  if (jobAfter?.status !== "completed") fail("job mutated");
  if (Number(asRecord(jobAfter?.payload).submitCount ?? 0) !== 1) fail("second submit");

  const { data: runAfter } = await db
    .from("production_runs")
    .select("status,state")
    .eq("id", PHASE_11C_VOICE_TTS_HR_RUN_ID)
    .single();
  if (runAfter?.status !== "completed") fail("run not completed");
  if (asRecord(runAfter?.state).waitingReason === "needs_review") fail("waitingReason still open");

  const budgetAfter = await budgetSnapshot(db);
  if (budgetAfter.committed !== COMMITTED || budgetAfter.reserved !== RESERVED) fail("budget mutated");

  assertPhase11CVoiceApprovedRemainsInactive({
    decision: "approved",
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
    lipsyncRequested: false,
    providerCalls: 0,
  });

  console.log(JSON.stringify({
    ok: true,
    verdict: PHASE_11C_VOICE_TTS_HR_APPROVE_VERDICT,
    persistStatus,
    replayStatus: "existing",
    staleBlocked,
    decisionIdPrefix: String(resolvedDecisionId).slice(0, 8),
    qualityReportIdPrefix: qualityReportId.slice(0, 8),
    qualityReportRevision: qrArt.revision,
    productionResultIdPrefix: productionResultId.slice(0, 8),
    productionResultRevision: prArt.revision,
    reviewRequestId,
    decisions: decisionsAfter,
    audioStatus: audioAfter.status,
    audioActive: false,
    audioPublished: false,
    videoActive: false,
    waitingReason: asRecord(runAfter?.state).waitingReason ?? null,
    submitCount: 1,
    maySubmit: false,
    i2vPointersFrozen: true,
    scopedArtifactsCreated: { qualityReport: qrArt.created, productionResult: prArt.created },
    budget: budgetAfter,
    localPreviewVerified: true,
    providerCalls: 0,
    signedUrlCount: 0,
    mediaReads: 0,
  }, null, 2));
}

main().catch((err) => fail(err instanceof Error ? err.message : "error"));

#!/usr/bin/env node
/**
 * Phase 11C close — read-only Production metadata audit.
 *
 *   CONFIRM_PHASE_11C_CLOSE_AND_NEXT_GATE_AUDIT=1 \
 *     npx tsx scripts/phase-11c-close-and-next-gate-audit-readonly.ts
 *
 * No provider / no Storage media / no writes / no signed URL.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID,
  PHASE_11B_ACTIVE_QUALITY_REPORT_ID,
} from "@/application/production/phase-11b-artifact-pointer-coherence";
import { PHASE_11B_LIVE_VIDEO_ASSET_ID } from "@/application/production/phase-11b-i2v-attempt-terminal-state";
import { PHASE_11C_PROJECT_ID, PHASE_11C_WORKSPACE_ID } from "@/application/production/phase-11c-voice-allowlist";
import {
  PHASE_11C_CLOSE_AUTH,
  PHASE_11C_CLOSE_DECISION_ID_PREFIX,
  PHASE_11C_CLOSE_VERDICT,
  PHASE_11C_CLOSE_VOICE_PR_REVISION,
  PHASE_11C_CLOSE_VOICE_QR_REVISION,
  PHASE_11C_NEXT_AUTH,
  assertPhase11CCloseAuthMatchesHrNext,
  assertPhase11CCloseI2vPointersFrozen,
  assertPhase11CCloseKeepsAudioInactive,
  assertPhase11CCloseNoSideEffects,
  choosePhase11CNextAuth,
  classifyPhase11CRideCloudReadiness,
  classifyPhase11CSecondSubmitDebt,
  evaluatePhase11CCloseOptions,
  phase11CCloseScopedArtifactIds,
} from "@/application/production/phase-11c-close-and-next-gate-audit";
import {
  PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID,
  PHASE_11C_VOICE_TTS_AUDIO_BYTES,
  PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM,
  PHASE_11C_VOICE_TTS_HR_ATTEMPT_ID,
  PHASE_11C_VOICE_TTS_HR_JOB_ID,
  PHASE_11C_VOICE_TTS_HR_RUN_ID,
} from "@/application/production/phase-11c-voice-tts-human-review-approve";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HARD = 437;
const COMMITTED = 391;

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
  console.error(JSON.stringify({ ok: false, stop: true, reason: msg, auth: PHASE_11C_CLOSE_AUTH }));
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function main() {
  if (process.env.CONFIRM_PHASE_11C_CLOSE_AND_NEXT_GATE_AUDIT !== "1") {
    fail("set CONFIRM_PHASE_11C_CLOSE_AND_NEXT_GATE_AUDIT=1");
  }
  assertPhase11CCloseAuthMatchesHrNext();
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
  const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ids = phase11CCloseScopedArtifactIds();
  const { data: audio, error: aErr } = await db
    .from("assets")
    .select("id,status,checksum,size_bytes,mime_type,storage_bucket,provenance")
    .eq("id", PHASE_11C_VOICE_TTS_AUDIO_ASSET_ID)
    .single();
  if (aErr || !audio) fail("audio missing");
  const prov = asRecord(audio.provenance);
  assertPhase11CCloseKeepsAudioInactive({
    lifecycle: audio.status === "approved" ? "approved" : String(audio.status),
    humanReviewDecision:
      String(prov.humanDecision ?? "") === "approved" || prov.assetDecision === "HUMAN_APPROVED"
        ? "approved"
        : "none",
    active: String(prov.active) === "true",
    published: String(prov.published) === "true",
  });
  if (audio.checksum !== PHASE_11C_VOICE_TTS_AUDIO_CHECKSUM) fail("checksum mutated");
  if (Number(audio.size_bytes) !== PHASE_11C_VOICE_TTS_AUDIO_BYTES) fail("size mutated");
  if (audio.storage_bucket !== "director-final-assets") fail("bucket mutated");

  const { data: video } = await db
    .from("assets")
    .select("id,status,provenance")
    .eq("id", PHASE_11B_LIVE_VIDEO_ASSET_ID)
    .single();
  if (!video || video.status !== "approved") fail("i2v video diverged");
  if (String(asRecord(video.provenance).active) === "true") fail("i2v video activated");

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
  assertPhase11CCloseI2vPointersFrozen({
    activeQualityReportId: String(qrActive?.artifact_id ?? ""),
    activeProductionResultId: String(prActive?.artifact_id ?? ""),
    voiceQualityReportActive: qrActive?.artifact_id === ids.qualityReportId,
    voiceProductionResultActive: prActive?.artifact_id === ids.productionResultId,
  });
  if (qrActive?.artifact_id !== PHASE_11B_ACTIVE_QUALITY_REPORT_ID) fail("active QR drifted");
  if (prActive?.artifact_id !== PHASE_11B_ACTIVE_PRODUCTION_RESULT_ID) fail("active PR drifted");

  const { data: voiceQr } = await db
    .from("project_artifacts")
    .select("id,revision")
    .eq("id", ids.qualityReportId)
    .single();
  const { data: voicePr } = await db
    .from("project_artifacts")
    .select("id,revision")
    .eq("id", ids.productionResultId)
    .single();
  if (!voiceQr || Number(voiceQr.revision) !== PHASE_11C_CLOSE_VOICE_QR_REVISION) fail("voice QR revision");
  if (!voicePr || Number(voicePr.revision) !== PHASE_11C_CLOSE_VOICE_PR_REVISION) fail("voice PR revision");

  const { data: decisions, error: dErr } = await db
    .from("human_review_decisions")
    .select("id,decision")
    .eq("quality_report_artifact_id", ids.qualityReportId);
  if (dErr) fail("hr read failed");
  if ((decisions ?? []).length !== 1) fail("hr_count_" + String(decisions?.length));
  const decision = decisions![0]!;
  if (decision.decision !== "approved") fail("hr not approved");
  if (!String(decision.id).startsWith(PHASE_11C_CLOSE_DECISION_ID_PREFIX)) fail("hr id prefix");

  const { data: job } = await db
    .from("production_jobs")
    .select("status,payload")
    .eq("id", PHASE_11C_VOICE_TTS_HR_JOB_ID)
    .single();
  const submitCount = Number(asRecord(job?.payload).submitCount ?? 0);
  if (!job || job.status !== "completed" || submitCount !== 1) fail("job/submitCount");

  const { data: run } = await db
    .from("production_runs")
    .select("status,state")
    .eq("id", PHASE_11C_VOICE_TTS_HR_RUN_ID)
    .single();
  if (!run || run.status !== "completed") fail("run not completed");
  if (asRecord(run.state).waitingReason === "needs_review") fail("waitingReason still open");

  const { data: attempt } = await db
    .from("generation_attempts")
    .select("status")
    .eq("id", PHASE_11C_VOICE_TTS_HR_ATTEMPT_ID)
    .single();
  if (!attempt || attempt.status !== "completed") fail("attempt not completed");

  const { data: policy } = await db
    .from("workspace_budget_policies")
    .select("hard_limit_minor")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .single();
  const { data: ledger } = await db
    .from("cost_ledger")
    .select("amount_minor,cost_status")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .in("cost_status", ["committed", "provisional"]);
  const committed = (ledger ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  const { data: activeRes } = await db
    .from("budget_reservations")
    .select("id")
    .eq("workspace_id", PHASE_11C_WORKSPACE_ID)
    .eq("status", "active");
  if (Number(policy?.hard_limit_minor) !== HARD || committed !== COMMITTED) fail("budget diverged");
  if ((activeRes ?? []).length !== 0) fail("active reservation present");

  const second = classifyPhase11CSecondSubmitDebt({
    submitCount,
    maySubmit: false,
    jobStatus: job.status,
    runStatus: run.status,
    attemptStatus: attempt.status,
    flagsOff: true,
  });
  const ride = classifyPhase11CRideCloudReadiness({
    technicalProofsPrivateInactive: true,
    rideCloudProjectExists: false,
    rideCloudInputsPresent: false,
  });
  const nextAuth = choosePhase11CNextAuth({
    audioApprovedInactive: true,
    secondSubmitPossible: second.secondSubmitPossible,
    i2vPointersFrozen: true,
  });
  assertPhase11CCloseNoSideEffects({
    providerCalls: 0,
    elevenLabsCalls: 0,
    signedUrlCount: 0,
    mediaReads: 0,
    mediaWrites: 0,
    humanReviewWrites: 0,
    productionWrites: 0,
    budgetWrites: 0,
    flagsWritten: 0,
    deploymentsTriggered: 0,
  });

  console.log(JSON.stringify({
    ok: true,
    verdict: PHASE_11C_CLOSE_VERDICT,
    audioStatus: audio.status,
    audioActive: false,
    audioPublished: false,
    decisionIdPrefix: String(decision.id).slice(0, 8),
    decisions: 1,
    voiceQrRevision: voiceQr.revision,
    voicePrRevision: voicePr.revision,
    voicePointersActive: false,
    i2vQrActive: String(qrActive?.artifact_id).slice(0, 8),
    i2vPrActive: String(prActive?.artifact_id).slice(0, 8),
    submitCount,
    maySubmit: false,
    secondSubmitPossible: second.secondSubmitPossible,
    options: evaluatePhase11CCloseOptions(),
    rideCloudReadiness: ride,
    nextAuth,
    budget: {
      hard: HARD,
      committed,
      reserved: 0,
      available: HARD - committed,
    },
    localFlagsOff: true,
    vercelFlagsIndividuallyReread: false,
    productionWrites: 0,
    providerCalls: 0,
    signedUrlCount: 0,
    mediaReads: 0,
  }, null, 2));
}

main().catch((err) => fail(err instanceof Error ? err.message : "error"));

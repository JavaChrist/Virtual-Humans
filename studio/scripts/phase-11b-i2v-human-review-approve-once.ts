#!/usr/bin/env node
/**
 * Phase 11B — persist Human Review APPROVE on the first paid I2V video only.
 *
 *   CONFIRM_PHASE_11B_I2V_HUMAN_REVIEW_APPROVE=1 \
 *     npx tsx scripts/phase-11b-i2v-human-review-approve-once.ts
 *
 * No fal / no Storage media / no ledger / no activation / no signed URL.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { assertPhase11APayloadHasNoMediaLeak } from "@/application/production/phase-11a-human-review-reject";
import {
  applyPhase11BI2vApproveToAssetProvenance,
  applyPhase11BI2vApproveToProductionResult,
  applyPhase11BI2vApproveToRunState,
  assertPhase11BI2vApproveAttestation,
  assertPhase11BI2vQualityReportScope,
  assertPhase11BI2vRequestedDecisionIsApprove,
  phase11BI2vApproveIdempotencyKey,
  resolvePhase11BI2vReviewRequestId,
  PHASE_11B_I2V_HR_APPROVE_AUTH,
  PHASE_11B_I2V_HR_APPROVE_COMMENT,
  PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE,
  PHASE_11B_I2V_PARENT_ASSET_ID,
  PHASE_11B_I2V_VIDEO_ASSET_ID,
  PHASE_11B_I2V_VIDEO_BYTES,
  PHASE_11B_I2V_VIDEO_CHECKSUM,
} from "@/application/production/phase-11b-i2v-human-review-approve";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const RUN_ID = "4c5b53a5-584d-4f0d-a08f-3bf5d9a8f460";
const JOB_ID = "2e43152b-051a-41e1-8ecf-6619f868f795";
const QR_ID = "0da85052-9aaf-4e81-a719-193d5e90547c";
const PR_ID = "b115a420-ba43-4758-8456-ec8ba5241749";
const ACTOR_TYPE = "shared_password";
const ACTOR_ID = "phase-11b-human-operator";
const CORRELATION_ID = "11b-i2v-hr-approve-once";
const REQUESTED_DECISION = "approved";
const HARD = 437;
const COMMITTED = 389;

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
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_FAL_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
];

function fail(msg: string): never {
  console.error(JSON.stringify({ ok: false, stop: true, reason: msg, auth: PHASE_11B_I2V_HR_APPROVE_AUTH }));
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

async function main() {
  if (process.env.CONFIRM_PHASE_11B_I2V_HUMAN_REVIEW_APPROVE !== "1") {
    fail("set CONFIRM_PHASE_11B_I2V_HUMAN_REVIEW_APPROVE=1");
  }
  assertPhase11BI2vRequestedDecisionIsApprove(REQUESTED_DECISION);
  assertPhase11BI2vApproveAttestation(PHASE_11B_I2V_HR_APPROVE_COMMENT);
  const db = remoteDb();
  const nowIso = new Date().toISOString();

  const { data: video, error: vErr } = await db
    .from("assets")
    .select("id,status,checksum,mime_type,size_bytes,storage_bucket,source_kind,provenance")
    .eq("id", PHASE_11B_I2V_VIDEO_ASSET_ID)
    .single();
  if (vErr || !video) fail("BLOCKED_I2V_HUMAN_REVIEW_TARGET_DIVERGENCE asset");
  const prov = asRecord(video.provenance);
  if (
    video.status !== "pending_review" ||
    String(prov.active) !== "false" ||
    video.checksum !== PHASE_11B_I2V_VIDEO_CHECKSUM ||
    video.mime_type !== "video/mp4" ||
    Number(video.size_bytes) !== PHASE_11B_I2V_VIDEO_BYTES ||
    video.storage_bucket !== "director-final-assets" ||
    video.source_kind !== "internal" ||
    String(prov.parentAssetId) !== PHASE_11B_I2V_PARENT_ASSET_ID ||
    String(prov.mediaRole) !== "i2v_output_video" ||
    prov.stale === true ||
    video.status === "quarantined"
  ) {
    fail("BLOCKED_I2V_HUMAN_REVIEW_TARGET_DIVERGENCE metadata");
  }

  const { data: parent } = await db
    .from("assets")
    .select("id,status,provenance")
    .eq("id", PHASE_11B_I2V_PARENT_ASSET_ID)
    .single();
  if (!parent || parent.status !== "approved") fail("parent diverged");
  if (String(asRecord(parent.provenance).active) === "true") fail("parent activated");

  const { data: qrArt, error: qErr } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", QR_ID)
    .single();
  if (qErr || !qrArt) fail("quality_report missing");
  assertPhase11BI2vQualityReportScope(asRecord(qrArt.value), PHASE_11B_I2V_VIDEO_ASSET_ID);

  const { count: existingHr } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("quality_report_artifact_id", QR_ID);
  if ((existingHr ?? 0) !== 0) fail("BLOCKED_I2V_HUMAN_REVIEW_DECISION_CONFLICT");

  const { data: prArt, error: pErr } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", PR_ID)
    .single();
  if (pErr || !prArt) fail("production_result missing");
  const prValue = asRecord(prArt.value);
  if (prValue.videoAssetId !== PHASE_11B_I2V_VIDEO_ASSET_ID) fail("production_result asset mismatch");

  const { data: run, error: runErr } = await db
    .from("production_runs")
    .select("id,status,revision,state")
    .eq("id", RUN_ID)
    .single();
  if (runErr || !run || run.status !== "completed") fail("run not completed");
  if (asRecord(run.state).waitingReason !== "needs_review") fail("waitingReason not needs_review");
  const { data: job } = await db.from("production_jobs").select("id,status").eq("id", JOB_ID).single();
  if (!job || job.status !== "completed") fail("job not completed");

  const { data: policy } = await db
    .from("workspace_budget_policies")
    .select("hard_limit_minor")
    .eq("workspace_id", WORKSPACE_ID)
    .single();
  if (Number(policy?.hard_limit_minor) !== HARD) fail("hard limit changed");
  const { data: ledgerRows } = await db
    .from("cost_ledger")
    .select("amount_minor,cost_status")
    .eq("workspace_id", WORKSPACE_ID)
    .in("cost_status", ["committed", "provisional"]);
  const committedSum = (ledgerRows ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  if (committedSum !== COMMITTED) fail("committed sum changed before write");
  const { data: activeRes } = await db.from("budget_reservations").select("id").eq("status", "active");
  if ((activeRes ?? []).length !== 0) fail("active reservation present");

  const reviewRequestId = resolvePhase11BI2vReviewRequestId(PHASE_11B_I2V_VIDEO_ASSET_ID);
  const idempotencyKey = phase11BI2vApproveIdempotencyKey(reviewRequestId);
  const decisionId = randomUUID();
  const expectedRevision = Number(prArt.revision);
  const updatedPr = applyPhase11BI2vApproveToProductionResult({
    productionResult: prValue,
    facts: {
      videoAssetId: PHASE_11B_I2V_VIDEO_ASSET_ID,
      parentAssetId: PHASE_11B_I2V_PARENT_ASSET_ID,
      videoChecksumSha256: PHASE_11B_I2V_VIDEO_CHECKSUM,
      qualityReportId: QR_ID,
      reviewRequestId,
      decisionId,
      nowIso,
    },
  });
  assertPhase11APayloadHasNoMediaLeak(updatedPr);

  const { error: qrPtrErr } = await db.rpc("set_active_artifact_revision", {
    p_workspace_id: WORKSPACE_ID,
    p_project_id: PROJECT_ID,
    p_artifact_type: "quality_report",
    p_artifact_id: QR_ID,
    p_expected_revision: 4,
    p_updated_by: ACTOR_ID,
  });
  if (qrPtrErr) fail("set_active quality_report " + qrPtrErr.message);

  const { error: prPtrErr } = await db.rpc("set_active_artifact_revision", {
    p_workspace_id: WORKSPACE_ID,
    p_project_id: PROJECT_ID,
    p_artifact_type: "production_result",
    p_artifact_id: PR_ID,
    p_expected_revision: 8,
    p_updated_by: ACTOR_ID,
  });
  if (prPtrErr) fail("set_active production_result " + prPtrErr.message);

  const persistArgs = {
    p_id: decisionId,
    p_workspace_id: WORKSPACE_ID,
    p_project_id: PROJECT_ID,
    p_quality_report_artifact_id: QR_ID,
    p_quality_report_revision: qrArt.revision,
    p_production_result_artifact_id: PR_ID,
    p_production_result_revision: prArt.revision,
    p_decision: "approved",
    p_comment: PHASE_11B_I2V_HR_APPROVE_COMMENT,
    p_reviewed_issue_codes: [PHASE_11B_I2V_HR_APPROVE_ISSUE_CODE],
    p_idempotency_key: idempotencyKey,
    p_correlation_id: CORRELATION_ID,
    p_actor_type: ACTOR_TYPE,
    p_actor_id: ACTOR_ID,
    p_updated_production_result: updatedPr,
    p_production_result_new_id: randomUUID(),
    p_expected_production_result_revision: expectedRevision,
  };

  const { data: persistData, error: persistErr } = await db.rpc(
    "persist_human_review_decision",
    persistArgs,
  );
  if (persistErr) fail("persist_failed " + persistErr.message);
  const persistStatus = (persistData as { status?: string } | null)?.status;
  const resolvedDecisionId =
    (persistData as { decision_id?: string } | null)?.decision_id || decisionId;
  if (persistStatus !== "created") fail("unexpected persist status " + String(persistStatus));

  const { data: replayData, error: replayErr } = await db.rpc("persist_human_review_decision", {
    ...persistArgs,
    p_id: randomUUID(),
    p_production_result_new_id: randomUUID(),
  });
  if (replayErr) fail("replay_failed " + replayErr.message);
  if ((replayData as { status?: string } | null)?.status !== "existing") fail("replay_not_existing");
  if ((replayData as { decision_id?: string } | null)?.decision_id !== resolvedDecisionId) {
    fail("replay_decision_id_mismatch");
  }

  const { data: staleData, error: staleErr } = await db.rpc("persist_human_review_decision", {
    ...persistArgs,
    p_id: randomUUID(),
    p_idempotency_key: `${idempotencyKey}:stale`,
    p_production_result_new_id: randomUUID(),
    p_expected_production_result_revision: expectedRevision + 50,
  });
  if (!staleErr && (staleData as { status?: string } | null)?.status === "created") {
    fail("stale revision must not create");
  }

  const { count: decisionsAfter } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("quality_report_artifact_id", QR_ID);
  if (decisionsAfter !== 1) fail("i2v_decision_count_" + String(decisionsAfter));

  const nextProvenance = applyPhase11BI2vApproveToAssetProvenance(prov, {
    reviewRequestId,
    decisionId: resolvedDecisionId,
    parentAssetId: PHASE_11B_I2V_PARENT_ASSET_ID,
  });
  const { error: assetErr } = await db
    .from("assets")
    .update({ status: "approved", provenance: nextProvenance })
    .eq("id", PHASE_11B_I2V_VIDEO_ASSET_ID)
    .eq("status", "pending_review");
  if (assetErr) fail("asset_update " + assetErr.message);

  const nextState = applyPhase11BI2vApproveToRunState(asRecord(run.state), {
    nowIso,
    reviewRequestId,
    decisionId: resolvedDecisionId,
  });
  const { error: runUpdErr } = await db
    .from("production_runs")
    .update({
      status: "completed",
      state: nextState,
      revision: Number(run.revision) + 1,
      updated_at: nowIso,
    })
    .eq("id", RUN_ID)
    .eq("revision", run.revision)
    .eq("status", "completed");
  if (runUpdErr) fail("run_update " + runUpdErr.message);

  const { data: videoAfter } = await db
    .from("assets")
    .select("id,status,checksum,size_bytes,storage_bucket,provenance")
    .eq("id", PHASE_11B_I2V_VIDEO_ASSET_ID)
    .single();
  if (!videoAfter || videoAfter.status !== "approved") fail("video not approved");
  if (String(asRecord(videoAfter.provenance).active) !== "false") fail("video activated");
  if (String(asRecord(videoAfter.provenance).published) !== "false") fail("video published");
  if (videoAfter.checksum !== PHASE_11B_I2V_VIDEO_CHECKSUM) fail("checksum mutated");
  if (Number(videoAfter.size_bytes) !== PHASE_11B_I2V_VIDEO_BYTES) fail("size mutated");
  if (videoAfter.storage_bucket !== "director-final-assets") fail("bucket mutated");

  const { data: parentAfter } = await db
    .from("assets")
    .select("id,status,provenance")
    .eq("id", PHASE_11B_I2V_PARENT_ASSET_ID)
    .single();
  if (parentAfter?.status !== "approved") fail("parent mutated");
  if (String(asRecord(parentAfter?.provenance).active) === "true") fail("parent activated");

  const { data: jobAfter } = await db.from("production_jobs").select("status").eq("id", JOB_ID).single();
  if (jobAfter?.status !== "completed") fail("job mutated");
  const { data: runAfter } = await db.from("production_runs").select("status,state").eq("id", RUN_ID).single();
  if (runAfter?.status !== "completed") fail("run not completed");
  if (asRecord(runAfter?.state).waitingReason === "needs_review") fail("waitingReason still open");

  const { data: ledgerAfter } = await db
    .from("cost_ledger")
    .select("amount_minor,cost_status")
    .eq("workspace_id", WORKSPACE_ID)
    .in("cost_status", ["committed", "provisional"]);
  const committedAfter = (ledgerAfter ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  if (committedAfter !== COMMITTED) fail("budget mutated");

  const { data: attempt } = await db
    .from("generation_attempts")
    .select("status")
    .eq("run_id", RUN_ID)
    .single();

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict: "I2V_FIRST_PAID_VIDEO_HUMAN_APPROVED_PRIVATE_INACTIVE",
        persistStatus,
        replayStatus: (replayData as { status?: string } | null)?.status ?? null,
        staleBlocked: Boolean(staleErr) || (staleData as { status?: string } | null)?.status !== "created",
        decisionIdPrefix: String(resolvedDecisionId).slice(0, 8),
        reviewRequestId,
        expectedRevision,
        decisions: decisionsAfter,
        videoStatus: videoAfter.status,
        videoActive: false,
        waitingReason: asRecord(runAfter?.state).waitingReason ?? null,
        attemptStatus: attempt?.status ?? null,
        providerCalls: 0,
        signedUrlCount: 0,
        mediaReads: 0,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => fail(err instanceof Error ? err.message : "error"));

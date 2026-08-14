#!/usr/bin/env node
/**
 * Phase 11A — persist Human Review REJECT on composed overlay only.
 *
 *   CONFIRM_PHASE_11A_COMPOSED_HR_REJECT=1 \
 *     npx tsx scripts/phase-11a-composed-human-review-reject-once.ts
 *
 * No OpenAI / no retry / no Storage write / no ledger / no parent mutation.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  applyPhase11AComposedRejectToAssetProvenance,
  applyPhase11AComposedRejectToProductionResult,
  applyPhase11AComposedRejectToRunState,
  assertPhase11AComposedQualityReportScope,
  assertPhase11AComposedRequestedDecisionIsReject,
  buildPhase11AComposedRejectReviewRequestId,
  phase11AComposedRejectIdempotencyKey,
  PHASE_11A_COMPOSED_HR_REJECT_AUTH,
  PHASE_11A_COMPOSED_HR_REJECT_COMMENT,
  PHASE_11A_COMPOSED_HR_REJECT_ISSUE_CODE,
} from "@/application/production/phase-11a-composed-human-review-reject";
import { assertPhase11APayloadHasNoMediaLeak } from "@/application/production/phase-11a-human-review-reject";
import type { ProductionResult } from "@/domain/production";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const RUN_ID = "39329a01-a0b0-4744-a7d3-308d258cd73b";
const JOB_ID = "edc6e84a-9181-4607-8e42-3e6c6e9344f3";
const COMPOSED_ID = "6a2beca9-d938-5c07-9502-911680d01bea";
const PARENT_ID = "7832765d-45e9-4bcd-923b-d7dbfd023f60";
const LEGACY_ID = "5d68ef64-9219-41c8-bb2d-59079a9bcee9";
const COMPOSED_CHECKSUM_PREFIX = "d056b85aa4f9452d";
const PARENT_CHECKSUM_PREFIX = "1ac51f484420ef88";
const LEGACY_CHECKSUM_PREFIX = "c508e3e54f2ccac7";
const BUCKET = "director-final-assets";
const ACTOR_TYPE = "shared_password";
const ACTOR_ID = "phase-11a-human-operator";
const CORRELATION_ID = "corr-11a-compose-hr-reject";
const REQUESTED_DECISION = "rejected";
const HARD = 274;
const COMMITTED = 249;

const FLAG_KEYS = [
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
];

function fail(msg: string): never {
  console.error(JSON.stringify({ ok: false, stop: true, reason: msg, auth: PHASE_11A_COMPOSED_HR_REJECT_AUTH }));
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

function prefix(id: string, n = 8): string {
  return String(id || "").slice(0, n);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function countPng(db: ReturnType<typeof remoteDb>, prefixPath: string): Promise<number> {
  const { data, error } = await db.storage.from(BUCKET).list(prefixPath, { limit: 100 });
  if (error) fail(`storage list: ${error.message}`);
  return (data || []).filter((o) => o.name && String(o.name).endsWith(".png")).length;
}

async function main() {
  if (process.env.CONFIRM_PHASE_11A_COMPOSED_HR_REJECT !== "1") {
    fail("set CONFIRM_PHASE_11A_COMPOSED_HR_REJECT=1");
  }
  if (process.env.PHASE_11A_ALLOW_EXECUTE === "1") fail("PHASE_11A_ALLOW_EXECUTE forbidden");
  assertPhase11AComposedRequestedDecisionIsReject(REQUESTED_DECISION);
  assertPhase11APayloadHasNoMediaLeak({ comment: PHASE_11A_COMPOSED_HR_REJECT_COMMENT });
  const db = remoteDb();
  const nowIso = new Date().toISOString();

  const { data: assets, error: aErr } = await db
    .from("assets")
    .select("id,status,checksum,provenance,source_provider,storage_bucket,mime_type,width,height,size_bytes")
    .in("id", [COMPOSED_ID, PARENT_ID, LEGACY_ID]);
  if (aErr) fail("assets " + aErr.message);
  const composed = (assets ?? []).find((a) => a.id === COMPOSED_ID);
  const parent = (assets ?? []).find((a) => a.id === PARENT_ID);
  const legacy = (assets ?? []).find((a) => a.id === LEGACY_ID);
  if (!composed || !parent || !legacy) fail("expected three image assets");
  if (composed.status !== "pending_review" && composed.status !== "rejected") fail("composed status=" + composed.status);
  if (!String(composed.checksum).startsWith(COMPOSED_CHECKSUM_PREFIX)) fail("composed checksum mismatch");
  if (composed.storage_bucket !== BUCKET || composed.mime_type !== "image/png") fail("composed storage/mime");
  if (Number(composed.width) !== 1024 || Number(composed.height) !== 1024) fail("composed dims");
  const composedProv = asRecord(composed.provenance);
  if (composedProv.active === true) fail("composed is active");
  if (composedProv.mediaRole !== "composed_overlay_image") fail("composed role");
  if (composedProv.parentAssetId !== PARENT_ID) fail("parent mismatch");
  if (composed.source_provider !== "deterministic-overlay") fail("composed provider");
  if (parent.status !== "pending_review") fail("parent status changed");
  if (!String(parent.checksum).startsWith(PARENT_CHECKSUM_PREFIX)) fail("parent checksum");
  if (asRecord(parent.provenance).active === true) fail("parent active");
  if (legacy.status !== "rejected") fail("legacy status changed");
  if (!String(legacy.checksum).startsWith(LEGACY_CHECKSUM_PREFIX)) fail("legacy checksum");
  if (asRecord(legacy.provenance).active === true) fail("legacy active");

  const reviewRequestId = buildPhase11AComposedRejectReviewRequestId({
    projectId: PROJECT_ID,
    composedAssetId: COMPOSED_ID,
  });
  const idempotencyKey = phase11AComposedRejectIdempotencyKey(reviewRequestId);

  const { data: existingDecision, error: exErr } = await db
    .from("human_review_decisions")
    .select("id,decision,idempotency_key,quality_report_artifact_id")
    .eq("project_id", PROJECT_ID)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (exErr) fail("existing decision " + exErr.message);
  if (existingDecision && existingDecision.decision !== "rejected") {
    fail("BLOCKED_DECISION_CONFLICT existing decision is not rejected");
  }

  const { data: qrActive } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "quality_report")
    .maybeSingle();
  const { data: prActive } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "production_result")
    .maybeSingle();
  if (!qrActive || !prActive) fail("active delivery pointers missing");

  const { data: qrArt } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", qrActive.artifact_id)
    .maybeSingle();
  const { data: prArt } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", prActive.artifact_id)
    .maybeSingle();
  if (!qrArt || !prArt) fail("active artifacts missing");
  assertPhase11AComposedQualityReportScope(asRecord(qrArt.value), COMPOSED_ID);
  const prValue = asRecord(prArt.value);
  if (prValue.phase11a && asRecord(prValue.phase11a).parentAssetId !== PARENT_ID) {
    fail("production_result parent mismatch");
  }
  if (!JSON.stringify(prValue).includes(COMPOSED_ID)) fail("production_result missing composed id");
  assertPhase11APayloadHasNoMediaLeak(prValue);

  const { data: run, error: runErr } = await db
    .from("production_runs")
    .select("id,status,revision,state")
    .eq("id", RUN_ID)
    .maybeSingle();
  if (runErr || !run) fail("run missing");
  if (run.status !== "completed" && run.status !== "running") fail("run status=" + run.status);
  const { data: job, error: jobErr } = await db
    .from("production_jobs")
    .select("id,status")
    .eq("id", JOB_ID)
    .maybeSingle();
  if (jobErr || !job) fail("job missing");
  if (job.status !== "completed") fail("job not completed");

  const { data: policy } = await db
    .from("workspace_budget_policies")
    .select("hard_limit_minor")
    .eq("workspace_id", WORKSPACE_ID)
    .maybeSingle();
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

  const pngBefore =
    (await countPng(db, `${WORKSPACE_ID}/${PROJECT_ID}/media/image`)) +
    (await countPng(db, `${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`));

  const { count: composedDecisionsBefore } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID)
    .eq("quality_report_artifact_id", qrActive.artifact_id);
  if ((composedDecisionsBefore ?? 0) > 0 && !existingDecision) {
    fail("BLOCKED_DECISION_CONFLICT composed already has a distinct decision");
  }

  const expectedRevision = Number(prActive.revision);
  const decisionId = existingDecision?.id ?? randomUUID();
  const updatedPr = applyPhase11AComposedRejectToProductionResult({
    productionResult: prArt.value as ProductionResult,
    facts: {
      composedAssetId: COMPOSED_ID,
      parentAssetId: PARENT_ID,
      composedChecksumSha256: String(composed.checksum),
      qualityReportId: String(qrActive.artifact_id),
      reviewRequestId,
      decisionId,
      nowIso,
    },
  });
  assertPhase11APayloadHasNoMediaLeak(updatedPr);

  const persistArgs = {
    p_id: decisionId,
    p_workspace_id: WORKSPACE_ID,
    p_project_id: PROJECT_ID,
    p_quality_report_artifact_id: qrActive.artifact_id,
    p_quality_report_revision: qrActive.revision,
    p_production_result_artifact_id: prActive.artifact_id,
    p_production_result_revision: prActive.revision,
    p_decision: "rejected",
    p_comment: PHASE_11A_COMPOSED_HR_REJECT_COMMENT,
    p_reviewed_issue_codes: [PHASE_11A_COMPOSED_HR_REJECT_ISSUE_CODE],
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
  if (persistStatus !== "created" && persistStatus !== "existing") {
    fail("unexpected persist status " + String(persistStatus));
  }

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
    p_idempotency_key: idempotencyKey + ":stale",
    p_production_result_new_id: randomUUID(),
    p_expected_production_result_revision: expectedRevision + 50,
  });
  if (!staleErr && (staleData as { status?: string } | null)?.status === "created") {
    fail("stale revision must not create");
  }

  const { count: composedDecisionsAfter } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID)
    .eq("quality_report_artifact_id", qrActive.artifact_id);
  if (composedDecisionsAfter !== 1) fail("composed_decision_count_" + String(composedDecisionsAfter));

  if (composed.status !== "rejected") {
    const nextProvenance = applyPhase11AComposedRejectToAssetProvenance(composedProv, {
      reviewRequestId,
      decisionId: resolvedDecisionId,
      parentAssetId: PARENT_ID,
    });
    const { error: assetErr } = await db
      .from("assets")
      .update({ status: "rejected", provenance: nextProvenance })
      .eq("id", COMPOSED_ID)
      .eq("project_id", PROJECT_ID);
    if (assetErr) fail("asset_update " + assetErr.message);
  }

  const waiting = asRecord(run.state).waitingReason;
  if (waiting === "needs_review" || asRecord(run.state).status === "running") {
    const nextState = applyPhase11AComposedRejectToRunState(asRecord(run.state), {
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
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", RUN_ID)
      .eq("revision", run.revision);
    if (runUpdErr) fail("run_update " + runUpdErr.message);
  }

  const { data: afterAssets } = await db
    .from("assets")
    .select("id,status,checksum,provenance")
    .in("id", [COMPOSED_ID, PARENT_ID, LEGACY_ID]);
  const composedAfter = (afterAssets ?? []).find((a) => a.id === COMPOSED_ID)!;
  const parentAfter = (afterAssets ?? []).find((a) => a.id === PARENT_ID)!;
  const legacyAfter = (afterAssets ?? []).find((a) => a.id === LEGACY_ID)!;
  if (composedAfter.status !== "rejected") fail("composed not rejected");
  if (asRecord(composedAfter.provenance).active === true) fail("composed activated");
  if (parentAfter.status !== "pending_review") fail("parent mutated");
  if (parentAfter.checksum !== parent.checksum) fail("parent checksum mutated");
  if (asRecord(parentAfter.provenance).humanDecision) fail("parent received HR decision");
  if (legacyAfter.status !== "rejected" || legacyAfter.checksum !== legacy.checksum) fail("legacy mutated");

  const { data: jobAfter } = await db.from("production_jobs").select("id,status").eq("id", JOB_ID).maybeSingle();
  if (jobAfter?.status !== "completed") fail("job mutated");
  const { data: runAfter } = await db.from("production_runs").select("status,state").eq("id", RUN_ID).maybeSingle();
  if (runAfter?.status !== "completed") fail("run not completed");
  if (asRecord(runAfter?.state).waitingReason === "needs_review") fail("waitingReason still open");

  const { data: prActiveAfter } = await db
    .from("active_artifact_revisions")
    .select("revision")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "production_result")
    .maybeSingle();
  const { data: prAfter } = await db
    .from("project_artifacts")
    .select("value")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "production_result")
    .eq("revision", prActiveAfter?.revision ?? -1)
    .maybeSingle();
  const delivery = asRecord(asRecord(prAfter?.value).delivery).status;
  if (delivery !== "blocked") fail("delivery not blocked");

  const pngAfter =
    (await countPng(db, `${WORKSPACE_ID}/${PROJECT_ID}/media/image`)) +
    (await countPng(db, `${WORKSPACE_ID}/${PROJECT_ID}/media/image/composed`));
  if (pngAfter !== pngBefore) fail("storage writes detected");

  const { data: ledgerAfter } = await db
    .from("cost_ledger")
    .select("amount_minor,cost_status")
    .eq("workspace_id", WORKSPACE_ID)
    .in("cost_status", ["committed", "provisional"]);
  const committedAfter = (ledgerAfter ?? []).reduce((n, r) => n + Number(r.amount_minor), 0);
  if (committedAfter !== COMMITTED) fail("ledger mutated");

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict: "PASS_PROVIDER_ASSET_COMPOSED_ASSET_HUMAN_REJECTED",
        auth: PHASE_11A_COMPOSED_HR_REJECT_AUTH,
        composedAssetId: prefix(COMPOSED_ID),
        parentAssetId: prefix(PARENT_ID),
        legacyAssetId: prefix(LEGACY_ID),
        decisionId: prefix(resolvedDecisionId),
        reviewRequestId: prefix(reviewRequestId, 20),
        issueCode: PHASE_11A_COMPOSED_HR_REJECT_ISSUE_CODE,
        persistStatus,
        replayStatus: (replayData as { status?: string } | null)?.status ?? null,
        staleConflict: Boolean(staleErr) || (staleData as { status?: string } | null)?.status !== "created",
        composedDecisions: composedDecisionsAfter,
        expectedRevision,
        composedStatus: composedAfter.status,
        composedActive: false,
        parentStatus: parentAfter.status,
        parentActive: false,
        legacyStatus: legacyAfter.status,
        runFinal: runAfter?.status ?? null,
        jobFinal: jobAfter?.status ?? null,
        delivery,
        technicalPipeline: "PASS",
        compositorVisual: "FAIL",
        assetDecision: "HUMAN_REJECTED",
        ledger: "274/249/0/25",
        storageWrites: 0,
        providerCalls: 0,
      },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});

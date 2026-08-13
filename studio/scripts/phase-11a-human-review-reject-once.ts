#!/usr/bin/env node
/**
 * Phase 11A — persist Human Review REJECT once (no regenerate).
 *
 *   CONFIRM_PHASE_11A_HUMAN_REVIEW_REJECT=1 \
 *     npx tsx scripts/phase-11a-human-review-reject-once.ts
 *
 * No OpenAI / no retry / no activation / no ledger / no Storage write.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  applyPhase11AHumanRejectToProductionResult,
  applyPhase11ARejectToAssetProvenance,
  applyPhase11ARejectToRunState,
  assertPhase11APayloadHasNoMediaLeak,
  assertPhase11ARequestedDecisionIsReject,
  auditPhase11AReviewScaffold,
  buildPhase11AMinimalProductionResult,
  buildPhase11AMinimalQualityReport,
  buildPhase11ARejectReviewRequestId,
  phase11ARejectIdempotencyKey,
  PHASE_11A_HR_REJECT_AUTH,
  PHASE_11A_HR_REJECT_COMMENT,
  PHASE_11A_HR_REJECT_ISSUE_CODE,
  type Phase11ARejectFacts,
  type Phase11AScaffoldArtifact,
} from "@/application/production/phase-11a-human-review-reject";
import {
  PHASE_11A_SMOKE_MODEL,
  PHASE_11A_SMOKE_PROJECT_ID,
  PHASE_11A_SMOKE_PROVIDER,
  PHASE_11A_SMOKE_SCENE_ID,
} from "@/application/production/phase-11a-openai-image-allowlist";
import type { ProductionResult } from "@/domain/production";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = PHASE_11A_SMOKE_PROJECT_ID;
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const RUN_ID = "f43377a6-a8aa-4632-867f-370112aca7da";
const RESERVATION_ID = "5b680c05-26da-4f15-a911-a4d983f322e7";
const ASSET_PREFIX = "5d68ef64";
const CHECKSUM_PREFIX = "c508e3e5";
const BUCKET = "director-final-assets";
const ACTOR_TYPE = "shared_password";
const ACTOR_ID = "phase-11a-human-operator";
const CORRELATION_ID = "corr-11a-hr-reject-once";
const REQUESTED_DECISION = "rejected";

const FLAG_KEYS = [
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
];

function fail(msg: string): never {
  console.error(JSON.stringify({ ok: false, stop: true, reason: msg, auth: PHASE_11A_HR_REJECT_AUTH }));
  process.exit(2);
}

function loadEnvFile(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2] ?? "";
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
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
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function prefix(id: string, n = 8): string {
  return String(id || "").slice(0, n);
}

function asArtifact(
  row: { id: string; revision: number; value: unknown } | null,
): Phase11AScaffoldArtifact | null {
  if (!row) return null;
  if (!row.value || typeof row.value !== "object") return null;
  return {
    id: row.id,
    revision: row.revision,
    value: row.value as Record<string, unknown>,
  };
}

async function main() {
  if (process.env.CONFIRM_PHASE_11A_HUMAN_REVIEW_REJECT !== "1") {
    fail("set CONFIRM_PHASE_11A_HUMAN_REVIEW_REJECT=1");
  }
  assertPhase11ARequestedDecisionIsReject(REQUESTED_DECISION);
  const db = remoteDb();
  const nowIso = new Date().toISOString();

  const { data: assets, error: aErr } = await db
    .from("assets")
    .select(
      "id,workspace_id,project_id,scene_id,kind,mime_type,storage_bucket,storage_path,source_provider,checksum,size_bytes,width,height,status,provenance,run_id",
    )
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (aErr) fail("assets " + aErr.message);
  if (!assets || assets.length !== 1) fail("expected 1 image asset");
  const asset = assets[0]!;
  if (!String(asset.id).startsWith(ASSET_PREFIX)) fail("asset id mismatch");
  if (asset.workspace_id !== WORKSPACE_ID) fail("workspace mismatch");
  if (asset.scene_id !== PHASE_11A_SMOKE_SCENE_ID) fail("scene mismatch");
  if (asset.storage_bucket !== BUCKET) fail("bucket mismatch");
  if (asset.mime_type !== "image/png") fail("mime mismatch");
  if (Number(asset.width) !== 1024 || Number(asset.height) !== 1024) fail("dims mismatch");
  if (!String(asset.checksum || "").startsWith(CHECKSUM_PREFIX)) fail("checksum mismatch");
  if (asset.status !== "pending_review" && asset.status !== "rejected") {
    fail("asset status=" + asset.status);
  }
  const provenance =
    asset.provenance && typeof asset.provenance === "object"
      ? (asset.provenance as Record<string, unknown>)
      : {};
  if (provenance.active === true) fail("asset is active");
  if (asset.source_provider !== PHASE_11A_SMOKE_PROVIDER) fail("source_provider mismatch");

  const { count: hrBefore, error: hrErr } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID);
  if (hrErr) fail("hr " + hrErr.message);

  const { data: run, error: runErr } = await db
    .from("production_runs")
    .select(
      "id,status,revision,generation_plan_artifact_id,committed_cost_minor,released_cost_minor,estimated_cost_minor,state,correlation_id",
    )
    .eq("id", RUN_ID)
    .maybeSingle();
  if (runErr || !run) fail("run missing");
  const waiting = (run.state as { waitingReason?: string } | null)?.waitingReason;
  if (waiting !== "needs_review" && waiting !== undefined) {
    if (waiting !== "human_rejected") fail("waitingReason=" + String(waiting));
  }
  if (Number(run.committed_cost_minor) !== 1) fail("run committed_cost_minor != 1");
  if (Number(run.released_cost_minor) !== 0) fail("run released_cost_minor != 0");

  const { data: reservation, error: rErr } = await db
    .from("budget_reservations")
    .select("id,status,amount_minor")
    .eq("id", RESERVATION_ID)
    .maybeSingle();
  if (rErr || !reservation) fail("reservation missing");
  if (reservation.status !== "committed") fail("reservation not committed");
  if (Number(reservation.amount_minor) !== 1) fail("reservation amount != 1");

  const { data: ledger, error: lErr } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor,cost_status")
    .eq("reservation_id", RESERVATION_ID);
  if (lErr) fail("ledger " + lErr.message);
  const commits = (ledger ?? []).filter((e) => e.entry_type === "commit");
  const releases = (ledger ?? []).filter((e) => e.entry_type === "release");
  const reserves = (ledger ?? []).filter((e) => e.entry_type === "reservation");
  if (reserves.length !== 1 || Number(reserves[0]?.amount_minor) !== 1) fail("ledger reserve mismatch");
  if (commits.length !== 1 || Number(commits[0]?.amount_minor) !== 1) fail("ledger commit mismatch");
  if (releases.length !== 0) fail("unexpected ledger release");

  const { data: activeRes, error: arErr } = await db
    .from("budget_reservations")
    .select("id")
    .eq("status", "active");
  if (arErr) fail("active reservations " + arErr.message);
  if ((activeRes ?? []).length !== 0) fail("active reservation present");

  const { data: jobs, error: jErr } = await db
    .from("production_jobs")
    .select("id,status,provider_id,model_id,payload")
    .eq("run_id", RUN_ID);
  if (jErr) fail("jobs " + jErr.message);
  if (!jobs || jobs.length !== 1) fail("expected 1 job");
  const job = jobs[0]!;
  if (job.status !== "completed") fail("job not completed");
  if (job.provider_id !== PHASE_11A_SMOKE_PROVIDER || job.model_id !== PHASE_11A_SMOKE_MODEL) {
    fail("job provider/model mismatch");
  }

  const { data: openJobs, error: ojErr } = await db
    .from("production_jobs")
    .select("id")
    .eq("project_id", PROJECT_ID)
    .in("status", ["queued", "leased", "running"]);
  if (ojErr) fail("open jobs " + ojErr.message);
  if ((openJobs ?? []).length !== 0) fail("active media job present");

  const { data: qrRows, error: qrErr } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "quality_report")
    .order("revision", { ascending: true });
  if (qrErr) fail("quality_report " + qrErr.message);
  const { data: prRows, error: prErr } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "production_result")
    .order("revision", { ascending: true });
  if (prErr) fail("production_result " + prErr.message);

  const reviewRequestId = buildPhase11ARejectReviewRequestId({
    projectId: PROJECT_ID,
    assetId: String(asset.id),
  });
  const idempotencyKey = phase11ARejectIdempotencyKey(reviewRequestId);

  const { data: existingDecision } = await db
    .from("human_review_decisions")
    .select("id,decision,idempotency_key,production_result_revision")
    .eq("project_id", PROJECT_ID)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if ((hrBefore ?? 0) > 0 && !existingDecision) {
    fail("BLOCKED_DECISION_CONFLICT distinct decision already present");
  }
  if (existingDecision && existingDecision.decision !== "rejected") {
    fail("BLOCKED_DECISION_CONFLICT existing decision is not rejected");
  }

  const attemptId = "step:scene-2:image:gpt-image-1:a1";
  const facts: Phase11ARejectFacts = {
    qualityReportId: randomUUID(),
    productionResultId: randomUUID(),
    projectId: PROJECT_ID,
    createdBy: ACTOR_ID,
    correlationId: CORRELATION_ID,
    nowIso,
    runId: RUN_ID,
    jobId: String(job.id),
    attemptId,
    assetId: String(asset.id),
    generationPlanArtifactId: String(run.generation_plan_artifact_id),
    checksumSha256: String(asset.checksum),
    sizeBytes: Number(asset.size_bytes),
    estimatedCostMinor: Number(run.estimated_cost_minor),
    committedCostMinor: Number(run.committed_cost_minor),
  };

  const qrList = (qrRows ?? [])
    .map((row) => asArtifact(row as { id: string; revision: number; value: unknown }))
    .filter((row): row is Phase11AScaffoldArtifact => Boolean(row));
  const prList = (prRows ?? [])
    .map((row) => asArtifact(row as { id: string; revision: number; value: unknown }))
    .filter((row): row is Phase11AScaffoldArtifact => Boolean(row));
  const latestQr = qrList.length ? [qrList[qrList.length - 1]!] : [];
  const latestPr = prList.length ? [prList[prList.length - 1]!] : [];
  const audit = auditPhase11AReviewScaffold({
    qualityReports: latestQr,
    productionResults: latestPr,
    expectedRunId: RUN_ID,
    expectedAssetId: String(asset.id),
    expectedSceneId: PHASE_11A_SMOKE_SCENE_ID,
  });
  if (audit.status === "inconsistent") {
    fail("BLOCKED_REVIEW_SCAFFOLD_INCONSISTENT " + audit.reason);
  }

  let qrCreated = false;
  let prCreated = false;
  let qr = latestQr[0];
  let pr = latestPr[0];

  if (!existingDecision) {
    if (!qr) {
      const value = buildPhase11AMinimalQualityReport({ ...facts, qualityReportId: facts.qualityReportId });
      const { error: insQr } = await db.from("project_artifacts").insert({
        id: facts.qualityReportId,
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        artifact_type: "quality_report",
        revision: 1,
        schema_version: "1.0.0",
        value,
        created_at: nowIso,
        created_by: ACTOR_ID,
        correlation_id: CORRELATION_ID,
      });
      if (insQr) fail("quality_report_insert " + insQr.message);
      qr = { id: facts.qualityReportId, revision: 1, value: value as unknown as Record<string, unknown> };
      qrCreated = true;
    }
    const { error: actQr } = await db.from("active_artifact_revisions").upsert(
      {
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        artifact_type: "quality_report",
        artifact_id: qr.id,
        revision: qr.revision,
        updated_at: nowIso,
        updated_by: ACTOR_ID,
      },
      { onConflict: "project_id,artifact_type" },
    );
    if (actQr) fail("activate_qr " + actQr.message);

    if (!pr) {
      const value = buildPhase11AMinimalProductionResult({
        ...facts,
        qualityReportId: qr.id,
        productionResultId: facts.productionResultId,
      });
      assertPhase11APayloadHasNoMediaLeak(value);
      const { error: insPr } = await db.from("project_artifacts").insert({
        id: facts.productionResultId,
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        artifact_type: "production_result",
        revision: 1,
        schema_version: "1.1.0",
        value,
        created_at: nowIso,
        created_by: ACTOR_ID,
        correlation_id: CORRELATION_ID,
      });
      if (insPr) fail("production_result_insert " + insPr.message);
      pr = { id: facts.productionResultId, revision: 1, value: value as unknown as Record<string, unknown> };
      prCreated = true;
    }
    const { error: actPr } = await db.from("active_artifact_revisions").upsert(
      {
        workspace_id: WORKSPACE_ID,
        project_id: PROJECT_ID,
        artifact_type: "production_result",
        artifact_id: pr.id,
        revision: pr.revision,
        updated_at: nowIso,
        updated_by: ACTOR_ID,
      },
      { onConflict: "project_id,artifact_type" },
    );
    if (actPr) fail("activate_pr " + actPr.message);
  } else {
    if (!qr || !pr) fail("existing decision missing scaffold");
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

  const { data: prArt } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", prActive.artifact_id)
    .maybeSingle();
  if (!prArt) fail("active production_result missing");

  const decisionId = existingDecision?.id ?? randomUUID();
  const expectedRevision = Number(prActive.revision);
  const updatedPr = applyPhase11AHumanRejectToProductionResult({
    productionResult: prArt.value as ProductionResult,
    decisionId,
    qualityReportId: String(qrActive.artifact_id),
    reviewRequestId,
    nowIso,
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
    p_comment: PHASE_11A_HR_REJECT_COMMENT,
    p_reviewed_issue_codes: [PHASE_11A_HR_REJECT_ISSUE_CODE],
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
  if ((replayData as { status?: string } | null)?.status !== "existing") {
    fail("replay_not_existing");
  }
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

  const { count: hrAfter } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID);
  if (hrAfter !== 1) fail("decision_count_" + String(hrAfter));

  const { count: qrCount } = await db
    .from("project_artifacts")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "quality_report");
  if ((qrCount ?? 0) !== 1) fail("quality_report_count_" + String(qrCount));

  const shouldPatchAsset = asset.status !== "rejected";
  if (shouldPatchAsset) {
    const nextProvenance = applyPhase11ARejectToAssetProvenance(provenance, {
      reviewRequestId,
      decisionId: resolvedDecisionId,
    });
    const { error: assetErr } = await db
      .from("assets")
      .update({
        status: "rejected",
        provenance: nextProvenance,
      })
      .eq("id", asset.id)
      .eq("project_id", PROJECT_ID);
    if (assetErr) fail("asset_update " + assetErr.message);
  }

  const shouldPatchRun =
    run.status === "running" || waiting === "needs_review";
  if (shouldPatchRun) {
    const prevState =
      run.state && typeof run.state === "object" ? (run.state as Record<string, unknown>) : {};
    const nextState = applyPhase11ARejectToRunState(prevState, {
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

  const { data: ledgerAfter } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor")
    .eq("reservation_id", RESERVATION_ID);
  if ((ledgerAfter ?? []).length !== (ledger ?? []).length) fail("ledger mutated");

  const { data: jobsAfter } = await db
    .from("production_jobs")
    .select("id,status")
    .eq("project_id", PROJECT_ID);
  if ((jobsAfter ?? []).length !== 1) fail("job count changed");
  if (jobsAfter?.[0]?.status !== "completed") fail("job status changed");

  const { data: assetAfter } = await db
    .from("assets")
    .select("id,status,provenance,storage_bucket")
    .eq("id", asset.id)
    .maybeSingle();
  const activeAfter =
    assetAfter?.provenance && typeof assetAfter.provenance === "object"
      ? (assetAfter.provenance as { active?: boolean }).active === true
      : false;

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict: "PASS_TECHNICAL_ASSET_HUMAN_REJECTED",
        auth: PHASE_11A_HR_REJECT_AUTH,
        runId: prefix(RUN_ID),
        jobId: prefix(String(job.id)),
        assetId: prefix(String(asset.id)),
        requestedDecision: "REJECT",
        decisionsBefore: hrBefore ?? 0,
        scaffoldAudit: audit.status,
        qualityReport: { action: qrCreated ? "created" : "reused", id: prefix(String(qrActive.artifact_id)), revision: qrActive.revision },
        productionResultScaffold: {
          action: prCreated ? "created" : "reused",
          id: prefix(String(prActive.artifact_id)),
          revision: expectedRevision,
        },
        reviewRequestId: prefix(reviewRequestId, 16),
        expectedRevision,
        persistStatus,
        replayStatus: (replayData as { status?: string } | null)?.status ?? null,
        staleConflict: Boolean(staleErr) || (staleData as { status?: string } | null)?.status !== "created",
        decisionId: prefix(resolvedDecisionId),
        decisionCount: hrAfter,
        assetStatus: assetAfter?.status ?? null,
        assetActive: activeAfter,
        assetBucket: assetAfter?.storage_bucket ?? null,
        runFinal: "completed",
        jobFinal: "completed",
        technicalPipeline: "PASS",
        assetDecision: "HUMAN_REJECTED",
        ledger: "1/1/0",
        storageWrites: 0,
        providerCalls: 0,
        retryCreated: 0,
      },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});

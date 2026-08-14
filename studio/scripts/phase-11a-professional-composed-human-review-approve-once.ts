#!/usr/bin/env node
/**
 * Phase 11A — persist Human Review APPROVE on professional 1.2.0 composed overlay only.
 *
 *   CONFIRM_PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE=1 \
 *     npx tsx scripts/phase-11a-professional-composed-human-review-approve-once.ts
 *
 * No OpenAI / no Storage write / no ledger / no activation / no signed URL.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  applyPhase11AProfessionalApproveToAssetProvenance,
  applyPhase11AProfessionalApproveToProductionResult,
  applyPhase11AProfessionalApproveToRunState,
  assertPhase11AProfessionalApproveAttestation,
  assertPhase11AProfessionalQualityReportScope,
  assertPhase11AProfessionalRequestedDecisionIsApprove,
  phase11AProfessionalApproveIdempotencyKey,
  resolvePhase11AProfessionalReviewRequestId,
  PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID,
  PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM,
  PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH,
  PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT,
  PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE,
  PHASE_11A_PROFESSIONAL_REVIEW_REQUEST_PREFIX,
} from "@/application/production/phase-11a-professional-composed-human-review-approve";
import { assertPhase11APayloadHasNoMediaLeak } from "@/application/production/phase-11a-human-review-reject";
import type { ProductionResult } from "@/domain/production";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const RUN_ID = "39329a01-a0b0-4744-a7d3-308d258cd73b";
const JOB_ID = "edc6e84a-9181-4607-8e42-3e6c6e9344f3";
const PARENT_PREFIX = "7832765d";
const REJECTED_110_PREFIX = "4429654f";
const REJECTED_110_DECISION_PREFIX = "058faa7d";
const REJECTED_100_PREFIX = "6a2beca9";
const REJECTED_100_DECISION_PREFIX = "f1fcb832";
const SMOKE_PREFIX = "5d68ef64";
const PARENT_CHECKSUM_PREFIX = "1ac51f484420ef88";
const REJECTED_110_CHECKSUM_PREFIX = "b284e877e5a80e7a";
const REJECTED_100_CHECKSUM_PREFIX = "d056b85aa4f9452d";
const SMOKE_CHECKSUM_PREFIX = "c508e3e54f2ccac7";
const BUCKET = "director-final-assets";
const ACTOR_TYPE = "shared_password";
const ACTOR_ID = "phase-11a-human-operator";
const CORRELATION_ID = "corr-11a-professional-compose-hr-approve";
const REQUESTED_DECISION = "approved";
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
  console.error(
    JSON.stringify({
      ok: false,
      stop: true,
      reason: msg,
      auth: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH,
    }),
  );
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
  if (process.env.CONFIRM_PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE !== "1") {
    fail("set CONFIRM_PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE=1");
  }
  if (process.env.PHASE_11A_ALLOW_EXECUTE === "1") fail("PHASE_11A_ALLOW_EXECUTE forbidden");
  assertPhase11AProfessionalRequestedDecisionIsApprove(REQUESTED_DECISION);
  assertPhase11AProfessionalApproveAttestation(PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT);
  const db = remoteDb();
  const nowIso = new Date().toISOString();

  const { data: assets, error: aErr } = await db
    .from("assets")
    .select(
      "id,status,checksum,provenance,source_provider,storage_bucket,mime_type,width,height,size_bytes",
    )
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (aErr) fail("assets " + aErr.message);

  const composedMatches = (assets ?? []).filter((a) => {
    const p = asRecord(a.provenance);
    return (
      a.id === PHASE_11A_PROFESSIONAL_COMPOSED_ASSET_ID &&
      p.mediaRole === "composed_overlay_image" &&
      a.checksum === PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM &&
      a.status === "pending_review" &&
      p.active === false &&
      String(p.parentAssetId || "").startsWith(PARENT_PREFIX) &&
      p.compositorVersion === "phase-11a-vector-compositor-1.2.0" &&
      p.fontFamily === "vhs-overlay-latin-vector-v1" &&
      p.fontId === "vhs-overlay-latin-vector-outlines-v1" &&
      p.layoutVersion === "phase-11a-overlay-layout-1.2.0" &&
      p.panelVersion === "phase-11a-contrast-panel-1.2.0"
    );
  });
  if (composedMatches.length !== 1) fail(`professional composed resolution ${composedMatches.length}`);
  const composed = composedMatches[0]!;
  const parent = (assets ?? []).find((a) => String(a.id).startsWith(PARENT_PREFIX));
  const rejected110 = (assets ?? []).find((a) => String(a.id).startsWith(REJECTED_110_PREFIX));
  const rejected100 = (assets ?? []).find((a) => String(a.id).startsWith(REJECTED_100_PREFIX));
  const smoke = (assets ?? []).find((a) => String(a.id).startsWith(SMOKE_PREFIX));
  if (!parent || !rejected110 || !rejected100 || !smoke) fail("expected five image assets");
  if (Number(composed.size_bytes) !== 1_338_305) fail("composed size");
  if (composed.storage_bucket !== BUCKET || composed.mime_type !== "image/png") fail("composed storage/mime");
  if (Number(composed.width) !== 1024 || Number(composed.height) !== 1024) fail("composed dims");
  if (composed.source_provider !== "deterministic-overlay") fail("composed provider");
  if (parent.status !== "pending_review") fail("parent status changed");
  if (!String(parent.checksum).startsWith(PARENT_CHECKSUM_PREFIX)) fail("parent checksum");
  if (asRecord(parent.provenance).active === true) fail("parent active");
  if (rejected110.status !== "rejected") fail("1.1.0 status changed");
  if (!String(rejected110.checksum).startsWith(REJECTED_110_CHECKSUM_PREFIX)) fail("1.1.0 checksum");
  if (asRecord(rejected110.provenance).active === true) fail("1.1.0 active");
  if (rejected100.status !== "rejected") fail("1.0.0 status changed");
  if (!String(rejected100.checksum).startsWith(REJECTED_100_CHECKSUM_PREFIX)) fail("1.0.0 checksum");
  if (asRecord(rejected100.provenance).active === true) fail("1.0.0 active");
  if (smoke.status !== "rejected") fail("smoke status changed");
  if (!String(smoke.checksum).startsWith(SMOKE_CHECKSUM_PREFIX)) fail("smoke checksum");
  if (asRecord(smoke.provenance).active === true) fail("smoke active");

  const { data: reviews, error: rErr } = await db
    .from("human_review_decisions")
    .select("id,decision,quality_report_artifact_id")
    .eq("project_id", PROJECT_ID);
  if (rErr) fail("hr " + rErr.message);
  if (
    !(reviews ?? []).some(
      (d) => String(d.id).startsWith(REJECTED_110_DECISION_PREFIX) && d.decision === "rejected",
    )
  ) {
    fail("1.1.0 decision missing");
  }
  if (
    !(reviews ?? []).some(
      (d) => String(d.id).startsWith(REJECTED_100_DECISION_PREFIX) && d.decision === "rejected",
    )
  ) {
    fail("1.0.0 decision missing");
  }

  const { data: qrRows, error: qErr } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "quality_report");
  if (qErr) fail("qr " + qErr.message);
  const qrMatches = (qrRows ?? []).filter((row) => {
    const v = asRecord(row.value);
    return v.kind === "phase_11a_composed_overlay_quality_report" && asRecord(v.asset).id === composed.id;
  });
  if (qrMatches.length !== 1) fail(`quality report count ${qrMatches.length}`);
  const qrArt = qrMatches[0]!;
  assertPhase11AProfessionalQualityReportScope(asRecord(qrArt.value), composed.id);

  const targetDecisions = (reviews ?? []).filter((d) => d.quality_report_artifact_id === qrArt.id);
  if (targetDecisions.length !== 0) fail("professional composed already has a decision");

  const { data: prRows, error: pErr } = await db
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "production_result");
  if (pErr) fail("pr " + pErr.message);
  const prMatches = (prRows ?? []).filter((row) => {
    const v = asRecord(row.value);
    return asRecord(v.delivery).finalAssetId === composed.id;
  });
  if (prMatches.length < 1) fail("production_result for professional composed missing");
  const prArt = prMatches.sort((a, b) => Number(b.revision) - Number(a.revision))[0]!;
  const prValue = asRecord(prArt.value);
  if (asRecord(prValue.phase11a).parentAssetId !== parent.id) fail("production_result parent mismatch");
  const seededRequest = String(asRecord(prValue.phase11a).reviewRequestId || "");
  const reviewRequestId = resolvePhase11AProfessionalReviewRequestId({
    projectId: PROJECT_ID,
    composedAssetId: composed.id,
  });
  if (!reviewRequestId.startsWith(PHASE_11A_PROFESSIONAL_REVIEW_REQUEST_PREFIX)) {
    fail("reviewRequestId prefix");
  }
  if (seededRequest !== reviewRequestId) fail("seeded reviewRequestId mismatch");
  assertPhase11APayloadHasNoMediaLeak(prValue);

  const idempotencyKey = phase11AProfessionalApproveIdempotencyKey(reviewRequestId);
  const { data: existingDecision, error: exErr } = await db
    .from("human_review_decisions")
    .select("id,decision,idempotency_key,quality_report_artifact_id")
    .eq("project_id", PROJECT_ID)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (exErr) fail("existing decision " + exErr.message);
  if (existingDecision) fail("BLOCKED_DECISION_CONFLICT unexpected existing decision");

  const { data: run, error: runErr } = await db
    .from("production_runs")
    .select("id,status,revision,state")
    .eq("id", RUN_ID)
    .maybeSingle();
  if (runErr || !run) fail("run missing");
  if (run.status !== "completed") fail("run status=" + run.status);
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

  const expectedRevision = Number(prArt.revision);
  const decisionId = randomUUID();
  const updatedPr = applyPhase11AProfessionalApproveToProductionResult({
    productionResult: prArt.value as ProductionResult,
    facts: {
      composedAssetId: composed.id,
      parentAssetId: parent.id,
      composedChecksumSha256: String(composed.checksum),
      qualityReportId: String(qrArt.id),
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
    p_quality_report_artifact_id: qrArt.id,
    p_quality_report_revision: qrArt.revision,
    p_production_result_artifact_id: prArt.id,
    p_production_result_revision: prArt.revision,
    p_decision: "approved",
    p_comment: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_COMMENT,
    p_reviewed_issue_codes: [PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE],
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
    .eq("quality_report_artifact_id", qrArt.id);
  if (composedDecisionsAfter !== 1) fail("composed_decision_count_" + String(composedDecisionsAfter));

  const nextProvenance = applyPhase11AProfessionalApproveToAssetProvenance(
    asRecord(composed.provenance),
    {
      reviewRequestId,
      decisionId: resolvedDecisionId,
      parentAssetId: parent.id,
    },
  );
  const { error: assetErr } = await db
    .from("assets")
    .update({ status: "approved", provenance: nextProvenance })
    .eq("id", composed.id)
    .eq("project_id", PROJECT_ID)
    .eq("status", "pending_review");
  if (assetErr) fail("asset_update " + assetErr.message);

  const waiting = asRecord(run.state).waitingReason;
  if (waiting === "needs_review") {
    const nextState = applyPhase11AProfessionalApproveToRunState(asRecord(run.state), {
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
  }

  const { data: afterAssets } = await db
    .from("assets")
    .select("id,status,checksum,provenance")
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  const composedAfter = (afterAssets ?? []).find((a) => a.id === composed.id)!;
  const parentAfter = (afterAssets ?? []).find((a) => a.id === parent.id)!;
  const rejected110After = (afterAssets ?? []).find((a) => a.id === rejected110.id)!;
  const rejected100After = (afterAssets ?? []).find((a) => a.id === rejected100.id)!;
  const smokeAfter = (afterAssets ?? []).find((a) => a.id === smoke.id)!;
  if (composedAfter.status !== "approved") fail("composed not approved");
  if (asRecord(composedAfter.provenance).active === true) fail("composed activated");
  if (composedAfter.checksum !== PHASE_11A_PROFESSIONAL_COMPOSED_CHECKSUM) fail("composed checksum mutated");
  if (parentAfter.status !== "pending_review") fail("parent mutated");
  if (parentAfter.checksum !== parent.checksum) fail("parent checksum mutated");
  if (asRecord(parentAfter.provenance).humanDecision) fail("parent received HR decision");
  if (rejected110After.status !== "rejected" || rejected110After.checksum !== rejected110.checksum) {
    fail("1.1.0 mutated");
  }
  if (rejected100After.status !== "rejected" || rejected100After.checksum !== rejected100.checksum) {
    fail("1.0.0 mutated");
  }
  if (smokeAfter.status !== "rejected" || smokeAfter.checksum !== smoke.checksum) fail("smoke mutated");

  const { data: histDecisions, error: histErr } = await db
    .from("human_review_decisions")
    .select("id,decision")
    .eq("project_id", PROJECT_ID);
  if (histErr) fail("hist decisions " + histErr.message);
  if (
    !(histDecisions ?? []).some(
      (d) => String(d.id).startsWith(REJECTED_110_DECISION_PREFIX) && d.decision === "rejected",
    )
  ) {
    fail("1.1.0 decision mutated");
  }
  if (
    !(histDecisions ?? []).some(
      (d) => String(d.id).startsWith(REJECTED_100_DECISION_PREFIX) && d.decision === "rejected",
    )
  ) {
    fail("1.0.0 decision mutated");
  }

  const { data: jobAfter } = await db.from("production_jobs").select("id,status").eq("id", JOB_ID).maybeSingle();
  if (jobAfter?.status !== "completed") fail("job mutated");
  const { data: runAfter } = await db.from("production_runs").select("status,state").eq("id", RUN_ID).maybeSingle();
  if (runAfter?.status !== "completed") fail("run not completed");
  if (asRecord(runAfter?.state).waitingReason === "needs_review") fail("waitingReason still open");

  const { data: prAfterRows } = await db
    .from("project_artifacts")
    .select("revision,value")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", "production_result");
  const prAfter = (prAfterRows ?? [])
    .filter((row) => asRecord(asRecord(row.value).delivery).finalAssetId === composed.id)
    .sort((a, b) => Number(b.revision) - Number(a.revision))[0];
  const delivery = asRecord(asRecord(prAfter?.value).delivery).status;
  if (delivery !== "merge_ready") fail("delivery not merge_ready");
  if (asRecord(asRecord(prAfter?.value).phase11a).mergeExportAuthorized === true) {
    fail("merge/export authorized");
  }
  if (asRecord(asRecord(prAfter?.value).phase11a).outputActive === true) fail("output activated");

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
        verdict: "PHASE_11A_PASS_WITH_HUMAN_APPROVED_PROFESSIONAL_IMAGE",
        auth: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_AUTH,
        composedAssetId: prefix(composed.id),
        parentAssetId: prefix(parent.id),
        rejected110AssetId: prefix(rejected110.id),
        rejected100AssetId: prefix(rejected100.id),
        smokeAssetId: prefix(smoke.id),
        decisionId: prefix(resolvedDecisionId),
        reviewRequestId: prefix(reviewRequestId, 28),
        issueCode: PHASE_11A_PROFESSIONAL_COMPOSED_HR_APPROVE_ISSUE_CODE,
        persistStatus,
        replayStatus: (replayData as { status?: string } | null)?.status ?? null,
        staleConflict: Boolean(staleErr) || (staleData as { status?: string } | null)?.status !== "created",
        composedDecisions: composedDecisionsAfter,
        expectedRevision,
        composedStatus: composedAfter.status,
        composedActive: false,
        parentStatus: parentAfter.status,
        parentActive: false,
        rejected110Status: rejected110After.status,
        rejected100Status: rejected100After.status,
        smokeStatus: smokeAfter.status,
        runFinal: runAfter?.status ?? null,
        jobFinal: jobAfter?.status ?? null,
        delivery,
        technicalPipeline: "PASS",
        typographicPipeline: "PASS",
        assetDecision: "HUMAN_APPROVED",
        ledger: "274/249/0/25",
        storageWrites: 0,
        providerCalls: 0,
        signedUrls: 0,
      },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});

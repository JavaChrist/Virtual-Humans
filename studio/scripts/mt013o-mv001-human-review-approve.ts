#!/usr/bin/env node
/**
 * MT-013O — MV-001 HUMAN REVIEW APPROVE (exactly once)
 *
 *   CONFIRM_MT013O_HUMAN_REVIEW_APPROVE=1 npx tsx scripts/mt013o-mv001-human-review-approve.ts
 *
 * No fal / no ledger / no merge / no deploy / no signed URL.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { allowedHumanReviewDecisions } from "@/domain/motion/review/allowed-decisions";
import type { MotionQcResult } from "@/domain/motion/types";
import { MOTION_QC_RESULT_SCHEMA_VERSION } from "@/domain/motion/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");
const AUTH = "AUTH_MV001_HUMAN_REVIEW_APPROVE_ONCE";
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const OUTPUT_ID = "2d7ffcad-fa49-4ad6-9cbb-0b710c570345";
const QR_PREFIX = "1516c218";
const PROVIDER_PREFIX = "019f";
const PROVIDER_SUFFIX = "b8ee";

const ATTESTATION_REDACTED = [
  "Human attestation (redacted): operator viewed private MV-001 output and approves it as usable",
  "first Motion Transfer benchmark result.",
  "Acknowledges: technical QC executed; automatic Motion/identity/hands-feet/posture metrics unavailable;",
  "human exam covers humanOnly controls only; approval does not certify perfect quality;",
  "does not make Motion Production-ready; does not authorize new generation.",
].join(" ");

function load(p: string, mode: "fill" | "override") {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (mode === "override" || !process.env[k]?.trim()) process.env[k] = v;
  }
}

function fail(msg: string): never {
  console.error(JSON.stringify({ ok: false, stop: true, reason: msg, auth: AUTH }));
  process.exit(2);
}

function redact(id: string | null | undefined) {
  if (!id) return null;
  return id.length <= 10 ? "[r]" : `${id.slice(0, 8)}…`;
}

function buildCanonQcFromReport(overall: string): MotionQcResult {
  if (overall !== "human_review") {
    throw new Error("quality_report overallStatus must be human_review");
  }
  return {
    schemaVersion: MOTION_QC_RESULT_SCHEMA_VERSION,
    motionFidelity: "unknown",
    identityFidelity: "unknown",
    outfitFidelity: "unknown",
    cameraCompliance: "unknown",
    bodyIntegrity: "unknown",
    temporalConsistency: "unknown",
    checkpointResults: [],
    issues: [
      {
        code: "human.sport_validation",
        severity: "blocking",
        requirementClass: "human_only",
        message: "Human-only validation required — automatic metrics unavailable.",
      },
    ],
    overallStatus: "human_review",
    humanValidationRequired: true,
  };
}

async function main() {
  if (process.env.CONFIRM_MT013O_HUMAN_REVIEW_APPROVE !== "1") {
    fail("Set CONFIRM_MT013O_HUMAN_REVIEW_APPROVE=1");
  }

  load(join(studioRoot, ".env.local"), "fill");
  load(join(studioRoot, ".env.remote.local"), "override");
  const url = process.env.MV001_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.MV001_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!url || !key) fail("missing supabase credentials");
  if (/127\.0\.0\.1|localhost/.test(url)) fail("refusing local supabase");

  const c = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Preconditions ──
  const { data: decisions } = await c
    .from("human_review_decisions")
    .select("id,decision")
    .eq("project_id", PROJ);
  if ((decisions || []).length > 0) {
    fail("decision_already_exists");
  }

  const { data: qrRows } = await c
    .from("project_artifacts")
    .select("id,revision,value,schema_version")
    .eq("project_id", PROJ)
    .eq("artifact_type", "quality_report");
  if (!qrRows || qrRows.length !== 1) fail("quality_report_count_not_1");
  const qr = qrRows[0]!;
  if (!String(qr.id).startsWith(QR_PREFIX)) fail("quality_report_id_mismatch");
  if (qr.value?.overallStatus !== "human_review") {
    fail(`quality_report_not_human_review:${qr.value?.overallStatus}`);
  }
  const expectedQrRevision = qr.revision;
  if (expectedQrRevision !== 1) fail(`unexpected_qr_revision:${expectedQrRevision}`);

  const { data: asset } = await c
    .from("assets")
    .select("*")
    .eq("id", OUTPUT_ID)
    .eq("project_id", PROJ)
    .maybeSingle();
  if (!asset) fail("output_asset_missing");
  if (asset.provenance?.active === true) fail("output_already_active");
  if (asset.provenance?.motionRole !== "motion_provider_output") {
    fail("output_role_mismatch");
  }
  if (asset.storage_bucket !== "director-final-assets") fail("bucket_not_private");

  const { data: jobs } = await c
    .from("production_jobs")
    .select("*")
    .eq("project_id", PROJ);
  if (!jobs || jobs.length !== 1) fail("jobs_count_not_1");
  const job = jobs[0]!;
  const motion = job.payload?.motion || {};
  const providerJobId =
    job.payload?.externalJobId || job.external_job_id || null;
  if (Number(motion.submitCount) !== 1) fail("submitCount_not_1");
  if (
    !providerJobId ||
    !String(providerJobId).startsWith(PROVIDER_PREFIX) ||
    !String(providerJobId).endsWith(PROVIDER_SUFFIX)
  ) {
    fail("providerJobId_mismatch");
  }
  if (motion.humanReviewHandoffStatus !== "seeded") fail("hr_not_seeded");
  if (motion.reconciliationRequired === true) fail("reconciliationRequired");
  if (job.error?.code !== "qc_rejected") {
    // History must still preserve technical terminal
    fail("qc_rejected_history_missing");
  }

  const { data: attempts } = await c
    .from("generation_attempts")
    .select("id")
    .eq("project_id", PROJ);
  if ((attempts || []).length !== 1) fail("attempts_count_not_1");

  // Find MV-001 reservation ledger trio (162 / 135 / 27)
  const { data: resRows } = await c
    .from("budget_reservations")
    .select("id,status,amount_minor")
    .eq("project_id", PROJ)
    .eq("amount_minor", 162);
  const res = resRows?.[0];
  if (!res || res.status !== "committed") fail("reservation_not_committed_162");
  const { data: mvLedger } = await c
    .from("cost_ledger")
    .select("entry_type,amount_minor")
    .eq("reservation_id", res.id);
  const reserve = mvLedger?.find((l) => l.entry_type === "reservation")?.amount_minor;
  const commit = mvLedger?.find((l) => l.entry_type === "commit")?.amount_minor;
  const release = mvLedger?.find((l) => l.entry_type === "release")?.amount_minor;
  if (reserve !== 162 || commit !== 135 || release !== 27) {
    fail(`ledger_mismatch:${reserve}/${commit}/${release}`);
  }

  // Flags must remain OFF (runtime Motion UNAVAILABLE) — local env authority for this Auth
  for (const flag of [
    "MOTION_TRANSFER_ENABLED",
    "MOTION_TRANSFER_PAID_ENABLED",
    "MOTION_TRANSFER_FAL_ENABLED",
    "MOTION_TRANSFER_WORKER_ENABLED",
  ]) {
    const v = (process.env[flag] || "0").trim();
    if (v === "1" || v.toLowerCase() === "true") {
      fail(`flag_not_off:${flag}=${v}`);
    }
  }

  // Allow-list APPROVE
  const qc = buildCanonQcFromReport(qr.value.overallStatus);
  const allowed = allowedHumanReviewDecisions(qc, null, {
    outcome: "needs_review",
    humanValidationRequired: true,
    qualityReportPresent: true,
    qualityReportStale: false,
    lateQuarantined: false,
    reconciliationRequired: false,
  });
  if (!allowed.allowed.includes("approved")) {
    fail(`approve_not_allowed:${allowed.approveBlockedReasons.join(",")}`);
  }

  const { data: run } = await c
    .from("production_runs")
    .select("id,status,generation_plan_artifact_id,state,revision")
    .eq("project_id", PROJ)
    .maybeSingle();
  if (!run) fail("run_missing");
  // No concurrent queued/leased/running jobs besides the settled failed job
  const { data: liveJobs } = await c
    .from("production_jobs")
    .select("id,status")
    .eq("project_id", PROJ)
    .in("status", ["queued", "leased", "running"]);
  if ((liveJobs || []).length > 0) fail("concurrent_live_job");

  const now = new Date().toISOString();
  // audit_log.actor_type CHECK: shared_password | system | worker (delivery canon = shared_password)
  const actorType = "shared_password";
  const actorId = "mv001-human-operator";
  const correlationId = `corr-mt013o-approve-${Date.now()}`;
  const reviewRequestId = `mv001-hr-approve-${createHash("sha256")
    .update(`${PROJ}|${OUTPUT_ID}|${qr.id}|approved`)
    .digest("hex")
    .slice(0, 24)}`;
  const idempotencyKey = `hr-decision:${reviewRequestId}`;
  const decisionId = randomUUID();

  // ── Bootstrap delivery scaffold required by persist_human_review_decision ──
  // quality_report → active
  const { error: actQrErr } = await c.from("active_artifact_revisions").upsert(
    {
      workspace_id: WS,
      project_id: PROJ,
      artifact_type: "quality_report",
      artifact_id: qr.id,
      revision: expectedQrRevision,
      updated_at: now,
      updated_by: actorId,
    },
    { onConflict: "project_id,artifact_type" },
  );
  if (actQrErr) fail(`activate_qr_failed:${actQrErr.message}`);

  // production_result rev1 (pending human review) if absent
  const { data: prActive } = await c
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PROJ)
    .eq("artifact_type", "production_result")
    .maybeSingle();

  let prId = prActive?.artifact_id as string | undefined;
  let prRevision = prActive?.revision as number | undefined;

  if (!prId) {
    prId = randomUUID();
    prRevision = 1;
    const prValue = {
      schemaVersion: "1.1.0",
      artifactType: "production_result",
      kind: "mv001_motion_transfer_result",
      generationPlanRevisionId: run.generation_plan_artifact_id,
      status: "completed",
      currency: "USD",
      estimatedCost: { amountMinor: 135, currency: "USD" },
      committedCost: { amountMinor: 135, currency: "USD" },
      releasedCost: { amountMinor: 27, currency: "USD" },
      startedAt: job.created_at,
      completedAt: now,
      scenes: [
        {
          sceneId: "motion",
          sceneOrder: 1,
          status: "completed",
          steps: [
            {
              stepId: "motion_transfer",
              order: 1,
              status: "completed",
              attempts: [],
              outputAssets: [
                {
                  assetId: OUTPUT_ID,
                  kind: "video",
                  mimeType: "video/mp4",
                  role: "motion_provider_output",
                },
              ],
              estimatedCost: { amountMinor: 135, currency: "USD" },
              committedCost: { amountMinor: 135, currency: "USD" },
              warnings: [],
            },
          ],
          outputAssets: [{ assetId: OUTPUT_ID, kind: "video", mimeType: "video/mp4" }],
          estimatedCost: { amountMinor: 135, currency: "USD" },
          committedCost: { amountMinor: 135, currency: "USD" },
          warnings: [],
        },
      ],
      manifest: {
        planRevisionId: run.generation_plan_artifact_id,
        runId: run.id,
        policyVersion: "mt013o-mv001-1",
        scenes: [
          {
            sceneId: "motion",
            sceneOrder: 1,
            status: "completed",
            stepIds: ["motion_transfer"],
            committedAmountMinor: 135,
            estimatedAmountMinor: 135,
          },
        ],
        attempts: [
          {
            attemptId: attempts![0]!.id,
            stepId: "motion_transfer",
            sceneId: "motion",
            attemptNumber: 1,
            kind: "primary",
            providerId: "fal",
            modelId: "fal-ai/kling-video/v3/pro/motion-control",
            status: "completed",
            estimatedAmountMinor: 135,
            actualAmountMinor: 135,
            currency: "USD",
            externalJobIdFingerprint: `${PROVIDER_PREFIX}…${PROVIDER_SUFFIX}`,
          },
        ],
        generatedAt: now,
      },
      warnings: [
        {
          code: "motion.metrics_unavailable",
          message: "Automatic Motion fidelity metrics unavailable — human review required.",
        },
      ],
      delivery: {
        status: "quality_review",
        updatedAt: now,
        qualityReportId: qr.id,
        finalAssetId: OUTPUT_ID,
      },
      motion: {
        benchmarkId: "MV-001",
        providerJobIdRedacted: `${PROVIDER_PREFIX}…${PROVIDER_SUFFIX}`,
        humanReviewHandoffStatus: "seeded",
        technicalJobErrorPreserved: "qc_rejected",
      },
    };

    const { error: prInsErr } = await c.from("project_artifacts").insert({
      id: prId,
      workspace_id: WS,
      project_id: PROJ,
      artifact_type: "production_result",
      revision: 1,
      schema_version: "1.1.0",
      value: prValue,
      created_at: now,
      created_by: actorId,
      correlation_id: correlationId,
    });
    if (prInsErr) fail(`production_result_insert:${prInsErr.message}`);

    const { error: actPrErr } = await c.from("active_artifact_revisions").upsert(
      {
        workspace_id: WS,
        project_id: PROJ,
        artifact_type: "production_result",
        artifact_id: prId,
        revision: 1,
        updated_at: now,
        updated_by: actorId,
      },
      { onConflict: "project_id,artifact_type" },
    );
    if (actPrErr) fail(`activate_pr_failed:${actPrErr.message}`);
  } else {
    // Re-read expected revision for optimistic concurrency
    prRevision = prActive!.revision;
  }

  // Re-fetch active PR as expectedRevision authority
  const { data: prActive2 } = await c
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PROJ)
    .eq("artifact_type", "production_result")
    .maybeSingle();
  if (!prActive2) fail("production_result_not_active");
  prId = prActive2.artifact_id;
  prRevision = prActive2.revision;

  const { data: prArt } = await c
    .from("project_artifacts")
    .select("id,revision,value")
    .eq("id", prId)
    .maybeSingle();
  if (!prArt) fail("production_result_artifact_missing");

  const updatedPr = {
    ...(prArt.value as Record<string, unknown>),
    schemaVersion: "1.1.0",
    delivery: {
      status: "merge_ready",
      updatedAt: now,
      qualityReportId: qr.id,
      humanReviewId: decisionId,
      finalAssetId: OUTPUT_ID,
      // Explicit: merge_ready is delivery state only — merge/export NOT authorized by this Auth
      mergeExportAuthorized: false,
      note: "MV-001 human approved; merge/export remain OFF until separate Auth",
    },
    motion: {
      ...((prArt.value as { motion?: object })?.motion || {}),
      benchmarkId: "MV-001",
      humanDecision: "approved",
      humanAttestation: true,
      reviewRequestId,
      technicalJobErrorPreserved: "qc_rejected",
      outputLifecycle: "approved",
      outputActive: false,
      productionCapabilityEnabled: false,
    },
  };

  const prNewId = randomUUID();

  const { data: persistData, error: persistErr } = await c.rpc(
    "persist_human_review_decision",
    {
      p_id: decisionId,
      p_workspace_id: WS,
      p_project_id: PROJ,
      p_quality_report_artifact_id: qr.id,
      p_quality_report_revision: expectedQrRevision,
      p_production_result_artifact_id: prId,
      p_production_result_revision: prRevision,
      p_decision: "approved",
      p_comment: ATTESTATION_REDACTED.slice(0, 2000),
      p_reviewed_issue_codes: ["human.sport_validation"],
      p_idempotency_key: idempotencyKey,
      p_correlation_id: correlationId,
      p_actor_type: actorType,
      p_actor_id: actorId,
      p_updated_production_result: updatedPr,
      p_production_result_new_id: prNewId,
      p_expected_production_result_revision: prRevision,
    },
  );

  if (persistErr) fail(`persist_failed:${persistErr.message}`);

  const persistStatus = (persistData as { status?: string })?.status;
  const resolvedDecisionId =
    (persistData as { decision_id?: string })?.decision_id || decisionId;

  // Replay — must be existing, no second row
  const { data: replayData, error: replayErr } = await c.rpc(
    "persist_human_review_decision",
    {
      p_id: randomUUID(),
      p_workspace_id: WS,
      p_project_id: PROJ,
      p_quality_report_artifact_id: qr.id,
      p_quality_report_revision: expectedQrRevision,
      p_production_result_artifact_id: prId,
      p_production_result_revision: prRevision,
      p_decision: "approved",
      p_comment: ATTESTATION_REDACTED.slice(0, 2000),
      p_reviewed_issue_codes: ["human.sport_validation"],
      p_idempotency_key: idempotencyKey,
      p_correlation_id: correlationId,
      p_actor_type: actorType,
      p_actor_id: actorId,
      p_updated_production_result: updatedPr,
      p_production_result_new_id: randomUUID(),
      p_expected_production_result_revision: prRevision,
    },
  );
  if (replayErr) fail(`replay_failed:${replayErr.message}`);
  if ((replayData as { status?: string })?.status !== "existing") {
    fail(`replay_not_existing:${(replayData as { status?: string })?.status}`);
  }
  if (
    (replayData as { decision_id?: string })?.decision_id !== resolvedDecisionId
  ) {
    fail("replay_decision_id_mismatch");
  }

  const { count: decisionCount } = await c
    .from("human_review_decisions")
    .select("*", { count: "exact", head: true })
    .eq("project_id", PROJ);
  if (decisionCount !== 1) fail(`decision_count_${decisionCount}`);

  // Lifecycle mark on asset (private approved) — keep active=false
  const prevProv =
    asset.provenance && typeof asset.provenance === "object"
      ? (asset.provenance as Record<string, unknown>)
      : {};
  const { error: assetErr } = await c
    .from("assets")
    .update({
      provenance: {
        ...prevProv,
        motionRole: "motion_provider_output",
        providerOutputLifecycle: "approved",
        outputLifecycle: "approved",
        lifecycle: "approved_private",
        active: false,
        humanDecision: "approved",
        decisionId: resolvedDecisionId,
        reviewRequestId,
        auth: AUTH,
      },
    })
    .eq("id", OUTPUT_ID);
  if (assetErr) fail(`asset_lifecycle:${assetErr.message}`);

  // Delivery/review state on job payload — preserve error history
  const newPayload = {
    ...job.payload,
    motion: {
      ...motion,
      humanReviewHandoffStatus: "decided",
      humanDecision: "approved",
      decisionId: resolvedDecisionId,
      reviewRequestId,
      outputLifecycle: "approved",
      phase: motion.phase, // keep qc_pending / do not rewrite to erase history
    },
  };
  await c
    .from("production_jobs")
    .update({ payload: newPayload })
    .eq("id", job.id);
  // Do NOT clear job.error / status failed — history preserved

  // Run → completed (execution+review done; capability still not enabled)
  const prevState =
    run.state && typeof run.state === "object"
      ? (run.state as Record<string, unknown>)
      : {};
  const { error: runUpdErr } = await c
    .from("production_runs")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
      committed_cost_minor: 135,
      released_cost_minor: 27,
      revision: Number(run.revision || 1) + 1,
      state: {
        ...prevState,
        id: run.id,
        status: "completed",
        kind: "mv001_motion_transfer",
        humanDecision: "approved",
        benchmarkVerdict: "PASS_WITH_HUMAN_APPROVAL",
        productionCapabilityEnabled: false,
        technicalJobErrorPreserved: "qc_rejected",
        auth: AUTH,
      },
    })
    .eq("id", run.id);
  if (runUpdErr) fail(`run_update:${runUpdErr.message}`);

  await c.from("audit_log").insert({
    workspace_id: WS,
    project_id: PROJ,
    action: "motion.mv001.human_review.approved",
    resource_type: "human_review_decision",
    resource_id: resolvedDecisionId,
    actor_type: actorType,
    actor_id: actorId,
    correlation_id: correlationId,
    metadata: {
      decision: "approved",
      reviewRequestId,
      qualityReportId: qr.id,
      outputAssetId: OUTPUT_ID,
      attestation: true,
      mergeExport: false,
      productionCapabilityEnabled: false,
      technicalHistoryPreserved: true,
      jobErrorPreserved: "qc_rejected",
      persistStatus,
      replayStatus: "existing",
    },
  });

  const report = {
    auth: AUTH,
    ok: true,
    verdict: "PASS_WITH_HUMAN_APPROVAL",
    productionCapabilityEnabled: false,
    decision: {
      id: redact(resolvedDecisionId),
      decision: "approved",
      count: 1,
      reviewRequestId,
      persistStatus,
      replayStatus: "existing",
      expectedRevision: prRevision,
      attestation: true,
    },
    output: {
      id: redact(OUTPUT_ID),
      active: false,
      lifecycle: "approved",
      private: true,
    },
    historyPreserved: {
      jobStatus: "failed",
      jobError: "qc_rejected",
    },
    providerCalls: 0,
    fal: 0,
    retry: 0,
    mergeExport: 0,
    signedUrl: 0,
    ledger: { reserve: 162, commit: 135, release: 27 },
    runtimeMotion: "UNAVAILABLE",
  };

  mkdirSync(join(studioRoot, ".tmp"), { recursive: true });
  writeFileSync(
    join(studioRoot, ".tmp", "mt013o-human-review-approve.json"),
    JSON.stringify(report, null, 2),
  );

  const doc = `# MT-013O — MV-001 HUMAN REVIEW APPROVE

**Date :** 2026-08-12  
**Auth :** \`${AUTH}\`  
**Decision :** \`approved\` (exactly once)

---

## Verdict

\`\`\`text
MV001_BENCHMARK = PASS_WITH_HUMAN_APPROVAL
HUMAN_REVIEW_DECISIONS = 1 (approved)
OUTPUT_LIFECYCLE = approved (private, active=false)
PRODUCTION_CAPABILITY = NOT_YET_ENABLED
PROVIDER_CALLS = 0
MERGE_EXPORT = 0
RUNTIME_MOTION = UNAVAILABLE
TECHNICAL_HISTORY_PRESERVED = job.failed/qc_rejected
\`\`\`

## Decision

- reviewRequestId: \`${reviewRequestId}\`
- decisionId: \`${redact(resolvedDecisionId)}\`
- quality_report: \`${redact(qr.id)}\` rev ${expectedQrRevision}
- expectedRevision (production_result): **${prRevision}**
- persist: \`${persistStatus}\` · replay: \`existing\`
- attestation: recorded (redacted comment on decision row)

## Output

- asset \`${redact(OUTPUT_ID)}\` · lifecycle **approved** · **active=false** · bucket privé

## Non-goals confirmed

- no fal / submit / poll / resultFetch
- no retry / fallback
- no ledger mutation
- no merge/export
- no signed URL
- no Registry promotion
- \`qc_rejected\` job error **retained**

## Next

Capability Production Motion remains **NOT_YET_ENABLED**. Separate Auth required for any enablement, merge, or export.
`;

  writeFileSync(
    join(studioRoot, "..", "docs", "Developer-Handover", "97_MT013O_MV001_HUMAN_REVIEW_APPROVE.md"),
    doc,
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(
    JSON.stringify({
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
    }),
  );
  process.exit(1);
});

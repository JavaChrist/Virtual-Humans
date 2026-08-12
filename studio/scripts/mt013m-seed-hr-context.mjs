#!/usr/bin/env node
/**
 * Persist quality_report + Human Review handoff context ONLY.
 * Does NOT approve/reject/merge/export. No fal calls.
 *
 *   CONFIRM_MT013M_SEED_HR_CONTEXT=1 node scripts/mt013m-seed-hr-context.mjs
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (process.env.CONFIRM_MT013M_SEED_HR_CONTEXT !== "1") {
  console.error(
    JSON.stringify({
      ok: false,
      reason: "Set CONFIRM_MT013M_SEED_HR_CONTEXT=1",
    }),
  );
  process.exit(2);
}

function load(p, mode) {
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
    if (mode === "override" || !process.env[k]) process.env[k] = v;
  }
}
load(".env.local", "fill");
load(".env.remote.local", "override");

const AUTH = "AUTH_MV001_FINAL_PAID_SINGLE_CALL";
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const c = createClient(
  process.env.MV001_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.MV001_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: existing } = await c
  .from("project_artifacts")
  .select("id")
  .eq("project_id", PROJ)
  .eq("artifact_type", "quality_report")
  .limit(1);
if (existing?.length) {
  console.log(
    JSON.stringify({
      ok: true,
      alreadySeeded: true,
      reportId: `${String(existing[0].id).slice(0, 8)}…`,
    }),
  );
  process.exit(0);
}

const { data: job, error: jobErr } = await c
  .from("production_jobs")
  .select("id,run_id,attempt_id,payload")
  .eq("project_id", PROJ)
  .maybeSingle();
if (jobErr || !job) {
  console.error(JSON.stringify({ ok: false, reason: jobErr?.message || "no job" }));
  process.exit(1);
}

const m = job.payload?.motion || {};
const now = new Date().toISOString();
const reportId = randomUUID();
const checksum = String(m.downloadChecksum || "")
  .replace(/^sha256:/i, "")
  .slice(0, 12);

const { error: aerr } = await c.from("project_artifacts").insert({
  id: reportId,
  workspace_id: WS,
  project_id: PROJ,
  artifact_type: "quality_report",
  revision: 1,
  schema_version: "mt013m-qc-1.0.0",
  value: {
    overallStatus: "human_review",
    humanValidationRequired: true,
    technicalQc: "completed",
    motionMeasurements: "unavailable",
    identityMetrics: "unavailable",
    handsFeetMetrics: "unavailable",
    fidelityMetrics: "unavailable",
    ingestedAssetId: m.ingestedAssetId || null,
    downloadChecksumPrefix: checksum || null,
    providerJobIdRedacted: "019f…b8ee",
    drainPhaseObserved: m.phase || null,
    note: "HR context seeded after private ingest; no human decision applied.",
    automaticApproval: false,
    mergeExport: false,
    auth: AUTH,
  },
  created_at: now,
  created_by: AUTH,
  correlation_id: "corr-mt013m-hr-seed",
});
if (aerr) {
  console.error(JSON.stringify({ ok: false, reason: aerr.message }));
  process.exit(1);
}

const { error: audErr } = await c.from("audit_log").insert({
  workspace_id: WS,
  project_id: PROJ,
  action: "motion.mv001.human_review.seeded",
  resource_type: "production_run",
  resource_id: job.run_id,
  actor_type: "system",
  actor_id: AUTH,
  correlation_id: "corr-mt013m-hr-seed",
  metadata: {
    handoff: "seeded",
    overallStatus: "human_review",
    noDecisionApplied: true,
    ingestedAssetId: m.ingestedAssetId || null,
    outputActive: false,
  },
});
if (audErr) {
  console.error(JSON.stringify({ ok: false, reason: audErr.message }));
  process.exit(1);
}

const payload = {
  ...job.payload,
  motion: {
    ...m,
    humanReviewHandoffStatus: "seeded",
    phase: "qc_pending",
    outputLifecycle: "human_review_pending",
  },
};
await c.from("production_jobs").update({ payload }).eq("id", job.id);
await c
  .from("production_runs")
  .update({ status: "needs_review", updated_at: now })
  .eq("id", job.run_id);
await c
  .from("generation_attempts")
  .update({ status: "completed", completed_at: now })
  .eq("id", job.attempt_id);

console.log(
  JSON.stringify({
    ok: true,
    qualityReportId: `${reportId.slice(0, 8)}…`,
    handoff: "seeded",
    decisionApplied: false,
    automaticApproval: false,
  }),
);

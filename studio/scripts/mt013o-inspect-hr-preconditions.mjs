#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const c = createClient(
  process.env.MV001_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.MV001_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";
const OUT = "2d7ffcad-fa49-4ad6-9cbb-0b710c570345";

const { data: active } = await c
  .from("active_artifact_revisions")
  .select("*")
  .eq("project_id", PROJ);
const { data: arts } = await c
  .from("project_artifacts")
  .select("id,artifact_type,revision,schema_version,value,created_at")
  .eq("project_id", PROJ);
const { data: dec } = await c
  .from("human_review_decisions")
  .select("id,decision,quality_report_artifact_id,created_at,idempotency_key")
  .eq("project_id", PROJ);
const { data: asset } = await c
  .from("assets")
  .select("id,provenance,status,source_kind,storage_bucket,mime_type,checksum")
  .eq("id", OUT)
  .maybeSingle();
const { data: job } = await c
  .from("production_jobs")
  .select("status,error,payload,run_id")
  .eq("project_id", PROJ)
  .maybeSingle();
const { data: res } = await c
  .from("budget_reservations")
  .select("status,amount_minor")
  .eq("project_id", PROJ);
const { data: ledger } = await c
  .from("cost_ledger")
  .select("entry_type,amount_minor")
  .eq("project_id", PROJ)
  .eq("reservation_id", "d60c7616-7ea6-487f-838b-271d870c883f");

console.log(
  JSON.stringify(
    {
      active,
      arts: (arts || []).map((a) => ({
        id: String(a.id).slice(0, 8),
        type: a.artifact_type,
        rev: a.revision,
        overall: a.value?.overallStatus,
        schema: a.schema_version,
      })),
      decisions: dec,
      asset: {
        id: String(asset?.id || "").slice(0, 8),
        active: asset?.provenance?.active,
        role: asset?.provenance?.motionRole,
        lifecycle:
          asset?.provenance?.lifecycle || asset?.provenance?.outputLifecycle,
        bucket: asset?.storage_bucket,
        mime: asset?.mime_type,
      },
      job: {
        status: job?.status,
        error: job?.error?.code,
        hr: job?.payload?.motion?.humanReviewHandoffStatus,
        phase: job?.payload?.motion?.phase,
        recon: job?.payload?.motion?.reconciliationRequired,
        ledgerSettled: job?.payload?.motion?.ledgerSettled,
      },
      reservations: res,
      ledger,
    },
    null,
    2,
  ),
);

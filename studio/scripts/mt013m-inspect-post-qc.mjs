#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
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
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";

const { data: assets } = await c
  .from("assets")
  .select("id,kind,mime_type,checksum,status,provenance,storage_path,size_bytes")
  .eq("project_id", PROJ);
const { data: arts } = await c
  .from("project_artifacts")
  .select("id,artifact_type,schema_version,value,created_at")
  .eq("project_id", PROJ)
  .in("artifact_type", ["quality_report", "generation_plan"]);
const { data: job } = await c
  .from("production_jobs")
  .select("status,error,payload,result")
  .eq("project_id", PROJ)
  .maybeSingle();
const { data: res } = await c
  .from("budget_reservations")
  .select("id,status,amount_minor,revision")
  .eq("project_id", PROJ);
const { count: ledger } = await c
  .from("cost_ledger")
  .select("*", { count: "exact", head: true })
  .eq("workspace_id", WS);
const m = job?.payload?.motion || {};
console.log(
  JSON.stringify(
    {
      ledgerRows: ledger,
      reservations: (res || []).map((r) => ({
        id: `${String(r.id).slice(0, 4)}…`,
        status: r.status,
        amount: r.amount_minor,
        rev: r.revision,
      })),
      job: {
        status: job?.status,
        error: job?.error,
        phase: m.phase,
        submitCount: m.submitCount,
        pollCount: m.pollCount,
        downloadStatus: m.downloadStatus,
        downloadChecksum: m.downloadChecksum
          ? `${String(m.downloadChecksum).slice(0, 12)}…`
          : null,
        ingestStatus: m.ingestStatus,
        ingestedAssetId: m.ingestedAssetId
          ? `${String(m.ingestedAssetId).slice(0, 8)}…`
          : null,
        qcStatus: m.qcStatus,
        qualityReportId: m.qualityReportId
          ? `${String(m.qualityReportId).slice(0, 8)}…`
          : null,
        hr: m.humanReviewHandoffStatus,
        ledgerSettled: m.ledgerSettled,
        recon: m.reconciliationRequired,
        terminal: m.terminal,
        drainErrorCode: m.drainErrorCode,
      },
      assets: (assets || []).map((a) => ({
        id: `${String(a.id).slice(0, 8)}…`,
        kind: a.kind,
        mime: a.mime_type,
        role: a.provenance?.motionRole,
        active: a.provenance?.active,
        status: a.status,
        sha: a.checksum ? `${a.checksum.slice(0, 12)}…` : null,
        pathTail: (a.storage_path || "").split("/").slice(-2).join("/"),
        size: a.size_bytes,
      })),
      artifacts: (arts || []).map((a) => ({
        type: a.artifact_type,
        schema: a.schema_version,
        overall: a.value?.overallStatus,
        human: a.value?.humanValidationRequired,
        id: `${String(a.id).slice(0, 8)}…`,
      })),
    },
    null,
    2,
  ),
);

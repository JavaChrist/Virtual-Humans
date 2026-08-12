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
const { data: j, error } = await c
  .from("production_jobs")
  .select(
    "id,status,attempt_count,max_attempts,error,result,payload,leased_by,available_at,updated_at,external_job_id",
  )
  .eq("project_id", PROJ)
  .maybeSingle();
if (error) {
  console.error(error.message);
  process.exit(1);
}
const m = j?.payload?.motion || {};
const err = j?.error;
console.log(
  JSON.stringify(
    {
      id: j?.id ? `${String(j.id).slice(0, 8)}…` : null,
      status: j?.status,
      attempt_count: j?.attempt_count,
      max_attempts: j?.max_attempts,
      errorCode: err?.code ?? err?.errorCode ?? null,
      errorMessage: err?.publicMessage
        ? String(err.publicMessage).slice(0, 300)
        : err?.message
          ? String(err.message).slice(0, 300)
          : null,
      errorKeys: err && typeof err === "object" ? Object.keys(err) : null,
      leased_by: j?.leased_by ?? null,
      available_at: j?.available_at,
      updated_at: j?.updated_at,
      mode: j?.payload?.mode,
      externalJobId: j?.external_job_id
        ? `${String(j.external_job_id).slice(0, 4)}…${String(j.external_job_id).slice(-4)}`
        : j?.payload?.externalJobId
          ? `${String(j.payload.externalJobId).slice(0, 4)}…${String(j.payload.externalJobId).slice(-4)}`
          : null,
      phase: m.phase,
      submitCount: m.submitCount,
      pollCount: m.pollCount,
      terminal: m.terminal,
      drainErrorCode: m.drainErrorCode,
      downloadStatus: m.downloadStatus,
      ingestStatus: m.ingestStatus,
      hr: m.humanReviewHandoffStatus,
      ledgerSettled: m.ledgerSettled,
      recon: m.reconciliationRequired,
    },
    null,
    2,
  ),
);

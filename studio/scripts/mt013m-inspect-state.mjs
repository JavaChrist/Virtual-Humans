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

const url = process.env.MV001_SUPABASE_URL || process.env.SUPABASE_URL;
const key =
  process.env.MV001_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(JSON.stringify({ ok: false, reason: "missing supabase env" }));
  process.exit(2);
}
let host = "unknown";
try {
  host = new URL(url).host;
} catch {
  host = "invalid-url";
}
console.error(`supabase_host=${host} key_present=${Boolean(key)}`);

const c = createClient(url, key, { auth: { persistSession: false } });
const WS = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const PROJ = "390c25db-69e1-403a-83c5-7afcb4b85e84";

function redact(id) {
  if (!id) return null;
  const s = String(id);
  return s.length <= 10 ? "[r]" : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

const runsRes = await c
  .from("production_runs")
  .select(
    "id,status,estimated_cost_minor,committed_cost_minor,released_cost_minor,correlation_id,created_at",
  )
  .eq("project_id", PROJ);
const jobsRes = await c
  .from("production_jobs")
  .select("id,status,attempt_id,run_id,action,provider_id,payload,created_at")
  .eq("project_id", PROJ);
const attsRes = await c
  .from("generation_attempts")
  .select(
    "id,status,external_job_id,estimate_minor,actual_cost_minor,idempotency_key,attempt_number,kind,created_at,completed_at",
  )
  .eq("project_id", PROJ);
const resRes = await c
  .from("budget_reservations")
  .select("id,status,amount_minor,run_id,attempt_id,revision,created_at")
  .eq("project_id", PROJ)
  .order("created_at", { ascending: false })
  .limit(5);
const assetsRes = await c
  .from("assets")
  .select(
    "id,kind,mime_type,checksum,source_kind,storage_path,status,provenance",
  )
  .eq("project_id", PROJ);
const ledgerRes = await c
  .from("cost_ledger")
  .select("*", { count: "exact", head: true })
  .eq("workspace_id", WS);
const budgetRes = await c
  .from("workspace_budget_policies")
  .select("hard_limit_minor")
  .eq("workspace_id", WS)
  .maybeSingle();

const runs = runsRes.data;
const jobs = jobsRes.data;
const atts = attsRes.data;
const res = resRes.data;
const assets = assetsRes.data;
const ledger = ledgerRes.count;
const budget = budgetRes.data;

console.error(
  JSON.stringify({
    errors: {
      runs: runsRes.error?.message ?? null,
      jobs: jobsRes.error?.message ?? null,
      atts: attsRes.error?.message ?? null,
      res: resRes.error?.message ?? null,
      assets: assetsRes.error?.message ?? null,
      ledger: ledgerRes.error?.message ?? null,
      budget: budgetRes.error?.message ?? null,
    },
  }),
);

const jobsView = (jobs || []).map((j) => {
  const m = j.payload?.motion || {};
  return {
    id: redact(j.id),
    status: j.status,
    phase: m.phase,
    submitCount: m.submitCount,
    pollCount: m.pollCount,
    providerJobId: redact(m.providerJobId || j.payload?.externalJobId),
    externalJobId: redact(j.payload?.externalJobId),
    mode: j.payload?.mode,
    downloadStatus: m.downloadStatus,
    ingestStatus: m.ingestStatus,
    hr: m.humanReviewHandoffStatus,
    ledgerSettled: m.ledgerSettled,
    recon: m.reconciliationRequired,
    terminal: m.terminal,
  };
});

console.log(
  JSON.stringify(
    {
      budget,
      ledgerRows: ledger,
      runs: (runs || []).map((r) => ({
        id: redact(r.id),
        status: r.status,
        est: r.estimated_cost_minor,
        committed: r.committed_cost_minor,
        released: r.released_cost_minor,
      })),
      jobs: jobsView,
      attempts: (atts || []).map((a) => ({
        id: redact(a.id),
        status: a.status,
        external: redact(a.external_job_id),
        est: a.estimate_minor,
        actual: a.actual_cost_minor,
        n: a.attempt_number,
        kind: a.kind,
      })),
      reservations: (res || []).map((r) => ({
        id: redact(r.id),
        status: r.status,
        amount: r.amount_minor,
        rev: r.revision,
      })),
      assets: (assets || []).map((a) => ({
        id: redact(a.id),
        kind: a.kind,
        mime: a.mime_type,
        role: a.provenance?.motionRole,
        active: a.provenance?.active,
        pathTail: (a.storage_path || "").split("/").slice(-2).join("/"),
        sha: a.checksum ? `${a.checksum.slice(0, 12)}…` : null,
      })),
    },
    null,
    2,
  ),
);

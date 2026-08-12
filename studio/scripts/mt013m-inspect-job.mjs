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

const { data: jobs, error } = await c
  .from("production_jobs")
  .select("*")
  .eq("project_id", PROJ);
if (error) {
  console.error(error.message);
  process.exit(1);
}
const now = Date.now();
for (const j of jobs || []) {
  const avail = Date.parse(j.available_at);
  console.log(
    JSON.stringify(
      {
        id: `${String(j.id).slice(0, 8)}…`,
        status: j.status,
        workspace_match: j.workspace_id === WS,
        available_at: j.available_at,
        available_in_ms: Number.isFinite(avail) ? avail - now : null,
        lease_expires_at: j.lease_expires_at,
        leased_by: j.leased_by ? "[set]" : null,
        lease_token: j.lease_token ? "[set]" : null,
        attempts: j.attempts,
        max_attempts: j.max_attempts,
        priority: j.priority,
        action: j.action,
        mode: j.payload?.mode,
        phase: j.payload?.motion?.phase,
        submitCount: j.payload?.motion?.submitCount,
        pollCount: j.payload?.motion?.pollCount,
        externalJobId: j.payload?.externalJobId
          ? `${String(j.payload.externalJobId).slice(0, 4)}…${String(j.payload.externalJobId).slice(-4)}`
          : null,
      },
      null,
      2,
    ),
  );
}

// Try claim RPC once and immediately release if ours
const { data: claimed, error: claimErr } = await c.rpc("claim_production_jobs", {
  p_worker_id: "mt013m-inspect-claim",
  p_limit: 1,
  p_lease_seconds: 30,
});
if (claimErr) {
  console.error("claim_error", claimErr.message);
} else {
  const row = (claimed || [])[0];
  console.log(
    JSON.stringify(
      {
        claimProbe: row
          ? {
              id: `${String(row.id).slice(0, 8)}…`,
              workspace_id: `${String(row.workspace_id).slice(0, 8)}…`,
              status: row.status,
              action: row.action,
            }
          : null,
        claimedCount: (claimed || []).length,
      },
      null,
      2,
    ),
  );
  if (row?.id && row.lease_token) {
    await c.rpc("release_production_job", {
      p_job_id: row.id,
      p_lease_token: row.lease_token,
      p_worker_id: "mt013m-inspect-claim",
      p_available_at: new Date().toISOString(),
    });
    console.log("claimProbe_released");
  }
}

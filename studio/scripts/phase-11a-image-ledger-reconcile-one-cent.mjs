#!/usr/bin/env node
/**
 * Phase 11A-LEDGER-RECONCILE-ONE-CENT
 *
 *   CONFIRM_PHASE_11A_LEDGER_RECONCILE_ONE_CENT=1 \
 *   node scripts/phase-11a-image-ledger-reconcile-one-cent.mjs
 *
 * Settles the existing 1¢ OpenAI image smoke reservation.
 * No provider call. No Human Review. No flag flip. No new asset/run/job.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const AUTH = "AUTH_11A_RECONCILE_EXISTING_IMAGE_RESERVATION_1_CENT_NO_PROVIDER";
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const WORKSPACE_ID = "3c308f57-f448-40ba-aaca-bc0d8d546d01";
const ASSET_PREFIX = "5d68ef64";
const CHECKSUM_PREFIX = "c508e3e5";
const REPORT_PATH = join(
  studioRoot,
  ".tmp",
  "phase-11a-image-ledger-reconcile-one-cent-report.json",
);

const FLAG_KEYS = [
  "DIRECTOR_V2_ENABLED",
  "DIRECTOR_V2_PERSISTENCE_ENABLED",
  "DIRECTOR_V2_PAID_GENERATION_ENABLED",
  "DIRECTOR_V2_WORKER_ENABLED",
  "VHS124_OPENAI_IMAGE_DIRECTOR_EXCEPTION",
  "MOTION_TRANSFER_ENABLED",
  "MOTION_TRANSFER_PAID_ENABLED",
  "MOTION_TRANSFER_WORKER_ENABLED",
];

function fail(msg) {
  const err = new Error(msg);
  err.name = "Phase11ALedgerReconcileStop";
  throw err;
}

function loadEnvFile(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map[m[1]] = v;
  }
  return map;
}

function remoteDb() {
  const remote = loadEnvFile(resolve(studioRoot, ".env.remote.local"));
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail("missing .env.remote.local Supabase credentials");
  }
  return createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function prefix(id, n = 8) {
  return String(id || "").slice(0, n);
}

function run(cmd, args) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    cwd: studioRoot,
    env: process.env,
  });
}

function readProductionFlags() {
  const r = run("npx", ["vercel", "env", "ls", "production"]);
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  const flags = {};
  for (const key of FLAG_KEYS) {
    const present = new RegExp(`\\b${key}\\b`).test(text);
    flags[key] = present ? "PRESENT" : "ABSENT";
  }
  return { flags, inspectOk: r.status === 0 };
}

async function budgetSnapshot(db) {
  const { data: policy, error: pErr } = await db
    .from("workspace_budget_policies")
    .select("hard_limit_minor")
    .eq("workspace_id", WORKSPACE_ID)
    .maybeSingle();
  if (pErr) fail(`policy: ${pErr.message}`);
  const { data: resRows, error: rErr } = await db
    .from("budget_reservations")
    .select("amount_minor,status")
    .eq("workspace_id", WORKSPACE_ID);
  if (rErr) fail(`reservations: ${rErr.message}`);
  let reserved = 0;
  for (const row of resRows ?? []) {
    if (String(row.status) === "active") reserved += Number(row.amount_minor || 0);
  }
  const { data: ledger, error: lErr } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor")
    .eq("workspace_id", WORKSPACE_ID);
  if (lErr) fail(`ledger: ${lErr.message}`);
  let committed = 0;
  let refunds = 0;
  for (const e of ledger ?? []) {
    const t = String(e.entry_type || "");
    if (t === "commit" || t === "debit") committed += Number(e.amount_minor || 0);
    if (t === "refund" || t === "credit") refunds += Number(e.amount_minor || 0);
  }
  const net = committed - refunds;
  const hard = Number(policy?.hard_limit_minor || 0);
  return {
    hardMinor: hard,
    committedMinor: net,
    reservedMinor: reserved,
    availableMinor: hard - net - reserved,
  };
}

async function diagnose(db) {
  const { data: active, error: aErr } = await db
    .from("budget_reservations")
    .select(
      "id,project_id,run_id,attempt_id,amount_minor,status,revision,correlation_id,committed_at,released_at",
    )
    .eq("status", "active");
  if (aErr) fail(`active reservations: ${aErr.message}`);

  const { data: smokeRes, error: sErr } = await db
    .from("budget_reservations")
    .select(
      "id,project_id,run_id,attempt_id,amount_minor,status,revision,correlation_id,committed_at,released_at",
    )
    .eq("project_id", PROJECT_ID)
    .eq("run_id", "f43377a6-a8aa-4632-867f-370112aca7da")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr || !smokeRes) fail(`smoke reservation missing: ${sErr?.message || "not found"}`);

  const alreadySettled =
    String(smokeRes.status) === "committed" &&
    Number(smokeRes.amount_minor) === 1 &&
    (!active || active.length === 0);

  if (!alreadySettled) {
    if (!active || active.length !== 1) {
      fail(`expected exactly 1 active reservation, got ${active?.length ?? 0}`);
    }
    if (active[0].project_id !== PROJECT_ID) {
      fail("active reservation belongs to another project");
    }
    if (Number(active[0].amount_minor) !== 1) {
      fail(`reserved amount ${active[0].amount_minor} ≠ 1`);
    }
    if (active[0].id !== smokeRes.id) {
      fail("active reservation is not the smoke reservation");
    }
  }

  const reservation = alreadySettled ? smokeRes : active[0];

  const { data: ledger, error: lErr } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor,cost_status,idempotency_key")
    .eq("reservation_id", reservation.id)
    .order("created_at");
  if (lErr) fail(`reservation ledger: ${lErr.message}`);
  const types = (ledger ?? []).map((e) => e.entry_type);
  const commitRows = (ledger ?? []).filter((e) => e.entry_type === "commit");
  const releaseRows = (ledger ?? []).filter((e) => e.entry_type === "release");
  if (alreadySettled) {
    if (commitRows.length !== 1 || Number(commitRows[0].amount_minor) !== 1) {
      fail("settled reservation missing unique 1¢ commit");
    }
    if (releaseRows.length !== 0) fail("unexpected release on settled 1¢ reservation");
  } else {
    if (commitRows.length !== 0) fail("commit already present for this reservation");
    if (releaseRows.length !== 0) fail("release already present for this reservation");
    if (types.length !== 1 || types[0] !== "reservation") {
      fail(`unexpected ledger rows for reservation: ${types.join(",")}`);
    }
  }

  const { data: run, error: runErr } = await db
    .from("production_runs")
    .select(
      "id,status,revision,estimated_cost_minor,committed_cost_minor,released_cost_minor,correlation_id,state",
    )
    .eq("id", reservation.run_id)
    .maybeSingle();
  if (runErr || !run) fail(`run missing: ${runErr?.message || "not found"}`);
  const waiting = run.state?.waitingReason;
  if (waiting !== "needs_review") fail(`waitingReason=${waiting}`);
  if (!alreadySettled && Number(run.committed_cost_minor) !== 0) {
    fail(`run committed_cost_minor=${run.committed_cost_minor}`);
  }
  if (alreadySettled && Number(run.committed_cost_minor) !== 1) {
    fail(`settled run committed_cost_minor=${run.committed_cost_minor}`);
  }

  const { data: jobs, error: jErr } = await db
    .from("production_jobs")
    .select("id,status,action,provider_id,model_id,attempt_id,scene_id")
    .eq("run_id", run.id);
  if (jErr) fail(`jobs: ${jErr.message}`);
  if (!jobs || jobs.length !== 1) fail(`expected 1 job, got ${jobs?.length ?? 0}`);
  const job = jobs[0];
  if (job.status !== "completed") fail(`job status=${job.status}`);
  if (job.provider_id !== "openai" || job.model_id !== "gpt-image-1") {
    fail("job provider/model mismatch");
  }

  const { data: assets, error: asErr } = await db
    .from("assets")
    .select(
      "id,status,kind,mime_type,storage_bucket,checksum,size_bytes,width,height,source_provider,source_kind,run_id",
    )
    .eq("project_id", PROJECT_ID)
    .eq("kind", "image");
  if (asErr) fail(`assets: ${asErr.message}`);
  const asset = (assets ?? []).find((a) => String(a.id).startsWith(ASSET_PREFIX));
  if (!asset) fail("expected asset 5d68ef64… missing");
  if (asset.status !== "pending_review") fail(`asset status=${asset.status}`);
  if (asset.source_provider !== "openai") fail("asset source_provider ≠ openai");
  if (!String(asset.checksum || "").startsWith(CHECKSUM_PREFIX)) {
    fail("checksum prefix mismatch");
  }
  if (Number(asset.width) !== 1024 || Number(asset.height) !== 1024) {
    fail("asset dimensions mismatch");
  }
  if (asset.storage_bucket !== "director-final-assets") fail("bucket mismatch");

  const { count: hrCount, error: hrErr } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID);
  if (hrErr) fail(`hr: ${hrErr.message}`);
  if ((hrCount ?? 0) !== 0) fail("Human Review decision already present");

  const attempt =
    run.state?.scenes?.[0]?.steps?.[0]?.attempts?.[0] ?? null;
  const actualCost = attempt?.actualCost ?? null;

  return {
    alreadySettled,
    reservation,
    run,
    job,
    asset,
    hrCount: hrCount ?? 0,
    actualCost,
    ledgerRowCount: (ledger ?? []).length,
  };
}

function patchRunStateForSettlement(state, committedMinor) {
  const next = structuredClone(state);
  next.committedCost = { currency: "USD", amountMinor: committedMinor };
  next.releasedCost = { currency: "USD", amountMinor: 0 };
  const attempt = next.scenes?.[0]?.steps?.[0]?.attempts?.[0];
  if (attempt) {
    attempt.actualCost = { currency: "USD", amountMinor: committedMinor };
    attempt.costKind = "provisional";
  }
  return next;
}

async function settleOnce(db, reservation) {
  if (reservation.status === "committed") {
    return { alreadySettled: true, wrote: false };
  }
  const { data, error } = await db.rpc("commit_budget_reservation", {
    p_reservation_id: reservation.id,
    p_amount_minor: 1,
    p_cost_status: "provisional",
    p_ledger_idempotency_key: `commit:${reservation.id}`,
    p_expected_revision: reservation.revision,
  });
  if (error) fail(`commit_budget_reservation: ${error.message}`);
  return { alreadySettled: false, wrote: true, row: data };
}

async function patchRun(db, run) {
  if (Number(run.committed_cost_minor) === 1) {
    return { patched: false };
  }
  const nextState = patchRunStateForSettlement(run.state, 1);
  const { error } = await db
    .from("production_runs")
    .update({
      committed_cost_minor: 1,
      released_cost_minor: 0,
      state: nextState,
      revision: Number(run.revision) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("revision", run.revision);
  if (error) fail(`run patch: ${error.message}`);
  return { patched: true };
}

async function main() {
  if (process.env.CONFIRM_PHASE_11A_LEDGER_RECONCILE_ONE_CENT !== "1") {
    fail("set CONFIRM_PHASE_11A_LEDGER_RECONCILE_ONE_CENT=1");
  }
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const db = remoteDb();
  const flags = readProductionFlags();
  const before = await budgetSnapshot(db);
  if (before.hardMinor !== 274) fail(`hard ${before.hardMinor} ≠ 274`);

  const diag = await diagnose(db);
  if (!diag.alreadySettled) {
    if (before.committedMinor !== 247) fail(`committed ${before.committedMinor} ≠ 247`);
    if (before.reservedMinor !== 1) fail(`reserved ${before.reservedMinor} ≠ 1`);
  } else {
    if (before.committedMinor !== 248) fail(`replay committed ${before.committedMinor} ≠ 248`);
    if (before.reservedMinor !== 0) fail(`replay reserved ${before.reservedMinor} ≠ 0`);
  }
  const report = {
    auth: AUTH,
    flags: flags.flags,
    before,
    reservationIdPrefix: prefix(diag.reservation.id),
    runIdPrefix: prefix(diag.run.id),
    jobIdPrefix: prefix(diag.job.id),
    attemptId: diag.reservation.attempt_id,
    correlationIdPrefix: prefix(diag.run.correlation_id, 12),
    assetIdPrefix: prefix(diag.asset.id),
    checksumPrefix: prefix(diag.asset.checksum, 16),
    actualCostPresent: diag.actualCost != null,
    alreadySettledOnEntry: diag.alreadySettled === true,
    costKind: "provisional",
    writes: [],
  };

  const first = await settleOnce(db, diag.reservation);
  report.writes.push({ step: "commit_rpc", ...first, amountMinor: 1 });
  const { data: runReload } = await db
    .from("production_runs")
    .select(
      "id,status,revision,estimated_cost_minor,committed_cost_minor,released_cost_minor,state",
    )
    .eq("id", diag.run.id)
    .maybeSingle();
  const patched = await patchRun(db, runReload ?? diag.run);
  report.writes.push({ step: "run_cost_patch", ...patched });

  const replayRes = await db
    .from("budget_reservations")
    .select("id,status,revision,amount_minor,committed_at")
    .eq("id", diag.reservation.id)
    .maybeSingle();
  const second = await settleOnce(db, {
    ...diag.reservation,
    status: replayRes?.data?.status ?? "committed",
    revision: replayRes?.data?.revision ?? 2,
  });
  report.writes.push({ step: "replay_commit_rpc", ...second });
  const patchedReplay = await patchRun(db, {
    ...(runReload ?? diag.run),
    committed_cost_minor: 1,
    revision: Number((runReload ?? diag.run).revision) + (patched.patched ? 1 : 0),
  });
  report.writes.push({ step: "replay_run_patch", ...patchedReplay });

  const after = await budgetSnapshot(db);
  const { data: ledgerAfter } = await db
    .from("cost_ledger")
    .select("entry_type,amount_minor,cost_status")
    .eq("reservation_id", diag.reservation.id)
    .order("created_at");
  const { count: hrAfter } = await db
    .from("human_review_decisions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", PROJECT_ID);
  const { data: assetAfter } = await db
    .from("assets")
    .select("id,status")
    .eq("id", diag.asset.id)
    .maybeSingle();
  const { data: runAfter } = await db
    .from("production_runs")
    .select("status,committed_cost_minor,released_cost_minor,state")
    .eq("id", diag.run.id)
    .maybeSingle();

  report.after = after;
  report.ledgerEntries = (ledgerAfter ?? []).map((e) => ({
    entry_type: e.entry_type,
    amount_minor: e.amount_minor,
    cost_status: e.cost_status,
  }));
  report.activeReservationAfter = after.reservedMinor;
  report.hrCountAfter = hrAfter ?? 0;
  report.assetStatusAfter = assetAfter?.status ?? null;
  report.runWaitingAfter = runAfter?.state?.waitingReason ?? null;
  report.runCommittedAfter = runAfter?.committed_cost_minor ?? null;

  if (after.hardMinor !== 274) fail("hard limit changed");
  if (after.committedMinor !== 248) fail(`committed after ${after.committedMinor} ≠ 248`);
  if (after.reservedMinor !== 0) fail(`reserved after ${after.reservedMinor} ≠ 0`);
  if ((hrAfter ?? 0) !== 0) fail("HR decision created");
  if (assetAfter?.status !== "pending_review") fail("asset status changed");
  if (runAfter?.state?.waitingReason !== "needs_review") fail("waitingReason changed");
  const commits = (ledgerAfter ?? []).filter((e) => e.entry_type === "commit");
  if (commits.length !== 1) fail(`commit rows ${commits.length} ≠ 1`);
  if (Number(commits[0].amount_minor) !== 1) fail("commit amount ≠ 1");
  if (commits[0].cost_status !== "provisional") fail("commit not provisional");
  if (second.wrote) fail("replay wrote a second commit");

  report.verdict = "PASS_LEDGER_RECONCILED_HUMAN_REVIEW_PENDING";
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log("VERDICT", report.verdict);
  console.log("RESERVATION", report.reservationIdPrefix);
  console.log("RUN", report.runIdPrefix);
  console.log("JOB", report.jobIdPrefix);
  console.log("BEFORE", JSON.stringify(before));
  console.log("AFTER", JSON.stringify(after));
  console.log("LEDGER", JSON.stringify(report.ledgerEntries));
  console.log("REPLAY_WROTE", second.wrote);
  console.log("HR", report.hrCountAfter);
  console.log("ASSET", report.assetStatusAfter);
}

main().catch((e) => {
  console.error("STOP", e.name || "Error", e.message);
  process.exit(1);
});

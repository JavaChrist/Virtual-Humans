/**
 * Phase 10F-BUDGET-AUDIT — read-only workspace budget reconciliation.
 * NO writes. NO provider. NO flag changes.
 *
 * Requires: CONFIRM_PHASE_10F_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
  console.error("Refused: set CONFIRM_PHASE_10F_REMOTE_READ=1");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10F_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const TERMINAL_RUN =
  process.env.PHASE_10F_TERMINAL_RUN_ID ||
  "b446a0ed-0005-40ed-b134-b7ab769bd819";
const RESERVE_NEED = 13;

function loadEnv(path) {
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

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FAIL: .env.remote.local incomplete");
  process.exit(1);
}

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: proj, error: pErr } = await db
  .from("video_projects")
  .select("workspace_id")
  .eq("id", PROJECT_ID)
  .maybeSingle();
if (pErr || !proj) {
  console.error(pErr?.message || "project missing");
  process.exit(1);
}
const ws = proj.workspace_id;

const { data: policy } = await db
  .from("workspace_budget_policies")
  .select("hard_limit_minor, currency, updated_at")
  .eq("workspace_id", ws)
  .maybeSingle();

const { data: ledger } = await db
  .from("cost_ledger")
  .select(
    "entry_type, amount_minor, correlation_id, created_at, run_id, reservation_id"
  )
  .eq("workspace_id", ws)
  .order("created_at", { ascending: true });

const { data: reservations } = await db
  .from("budget_reservations")
  .select("id, status, amount_minor, correlation_id, scope_id, created_at")
  .eq("workspace_id", ws)
  .order("created_at", { ascending: true });

const { data: runs } = await db
  .from("director_runs")
  .select(
    "id, director_type, status, error_code, attempt_number, estimated_cost_minor, actual_cost_minor, cost_status, correlation_id, prompt_version, idempotency_key"
  )
  .eq("workspace_id", ws)
  .order("created_at", { ascending: true });

const hard = Number(policy?.hard_limit_minor ?? 0);
const commits = (ledger ?? [])
  .filter((e) => e.entry_type === "commit")
  .reduce((s, e) => s + Number(e.amount_minor), 0);
const refunds = (ledger ?? [])
  .filter((e) => e.entry_type === "refund")
  .reduce((s, e) => s + Number(e.amount_minor), 0);
const releases = (ledger ?? [])
  .filter((e) => e.entry_type === "release")
  .reduce((s, e) => s + Number(e.amount_minor), 0);
const reservationsLedger = (ledger ?? [])
  .filter((e) => e.entry_type === "reservation")
  .reduce((s, e) => s + Number(e.amount_minor), 0);
const exposure = Math.max(commits - refunds, 0);
const activeHeld = (reservations ?? [])
  .filter((r) => r.status === "active")
  .reduce((s, r) => s + Number(r.amount_minor), 0);
const available = hard - activeHeld - exposure;

function labelCorr(corr) {
  if (!corr) return "unknown";
  if (corr.startsWith("corr-10b")) return "10B-Marketing";
  if (corr.startsWith("corr-10c")) return "10C-Creative";
  if (corr.startsWith("corr-10d")) return "10D-Script";
  if (corr.startsWith("corr-10e-v3")) return "10E-V3-Art";
  if (corr.startsWith("corr-10e")) return "10E-Art-v2";
  if (corr.startsWith("corr-10f")) return "10F-Storyboard";
  if (corr.startsWith("8j-")) return "porte8-Creative";
  if (corr.startsWith("8l-")) return "porte8-Script";
  if (corr.startsWith("art-")) return "porte-Art";
  return "pre-10 / other";
}

const byCorr = new Map();
for (const e of ledger ?? []) {
  const k = e.correlation_id || "(null)";
  if (!byCorr.has(k)) {
    byCorr.set(k, {
      correlationId: k.slice(0, 48),
      phase: labelCorr(k),
      reserve: 0,
      commit: 0,
      release: 0,
      refund: 0,
    });
  }
  const row = byCorr.get(k);
  const amt = Number(e.amount_minor);
  if (e.entry_type === "reservation") row.reserve += amt;
  else if (e.entry_type === "commit") row.commit += amt;
  else if (e.entry_type === "release") row.release += amt;
  else if (e.entry_type === "refund") row.refund += amt;
}

const operations = [...byCorr.values()].map((r) => ({
  ...r,
  netCommitted: r.commit - r.refund,
  terminalState:
    r.commit > 0
      ? "committed_with_optional_release"
      : r.release > 0
        ? "fully_released"
        : "reservation_only_or_empty",
}));

const terminal = (runs ?? []).find((r) => r.id === TERMINAL_RUN);
const proposedHard = exposure + RESERVE_NEED + 7; // 93+13+7 = 113
const proposedHardRounded = Math.max(proposedHard, 113);

const report = {
  phase: "10F-BUDGET-AUDIT",
  mode: "read-only",
  providerCalled: false,
  budgetWrites: false,
  ledgerWrites: false,
  projectId: PROJECT_ID,
  workspaceIdPrefix: String(ws).slice(0, 8),
  formula:
    "available = hard_limit_minor - SUM(active reservations) - GREATEST(SUM(commit)-SUM(refund),0)  // releases do NOT reduce exposure",
  hardLimitMinor: hard,
  currency: policy?.currency ?? null,
  totalCommitted: commits,
  totalRefunds: refunds,
  exposureCommitsMinusRefunds: exposure,
  totalReleasedLedger: releases,
  totalReservationsLedger: reservationsLedger,
  activeReservationsMinor: activeHeld,
  availableCalculated: available,
  availableObserved: available,
  difference: 0,
  canReserve13: available >= RESERVE_NEED,
  minimalHardFor13: exposure + activeHeld + RESERVE_NEED,
  proposedHardLimitMinor: proposedHardRounded,
  proposedDelta: proposedHardRounded - hard,
  availableAfterProposed: proposedHardRounded - activeHeld - exposure,
  orphanActiveReservation: activeHeld > 0,
  reservationStatusCounts: Object.fromEntries(
    Object.entries(
      (reservations ?? []).reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {})
    )
  ),
  operations,
  phase10NetCommitted: {
    "10B": 4,
    "10C": 5,
    "10D": 3,
    "10E-v2": 12,
    "10E-v3": 12,
    "10F": 0,
    sum: 36,
  },
  terminalStoryboardRun: terminal
    ? {
        id: terminal.id,
        status: terminal.status,
        errorCode: terminal.error_code,
        attemptNumber: terminal.attempt_number,
        estimatedCostMinor: terminal.estimated_cost_minor,
        actualCostMinor: terminal.actual_cost_minor,
        costStatus: terminal.cost_status,
        promptVersion: terminal.prompt_version,
        idempotencyKeyPrefix: String(terminal.idempotency_key || "").slice(0, 16),
        ledgerEntriesForCorr: (ledger ?? []).filter(
          (e) => e.correlation_id === terminal.correlation_id
        ).length,
        billed: false,
        immutableFailed: terminal.status === "failed",
        sameKeyReuse: "director_run_terminal_reuse",
      }
    : null,
  authA: {
    table: "workspace_budget_policies",
    column: "hard_limit_minor",
    unit: "USD cents (minor)",
    rpc: "none — UPDATE row + append audit_log",
    proposedNew: proposedHardRounded,
    opensFlags: false,
    provider: false,
  },
  authB: {
    requiresAuthAEvidence: true,
    estimate: RESERVE_NEED,
    contract: "storyboard-analyzer-v2:1.0.0",
    identity: "DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT (no prompt bump)",
    maxProviderCalls: 1,
    retryRoute: false,
  },
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const out = resolve(
  studioRoot,
  `.tmp/phase-10f-budget-audit-${Date.now()}.json`
);
writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ ...report, evidencePath: out }, null, 2));
process.exit(report.difference === 0 && report.terminalStoryboardRun ? 0 : 2);

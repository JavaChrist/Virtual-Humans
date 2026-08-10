/**
 * Phase 10F — Autorisation A : raise workspace hard_limit_minor (minimal).
 * Does NOT open Director flags. Does NOT call providers. Does NOT start Storyboard.
 *
 * Usage:
 *   CONFIRM_PHASE_10F_BUDGET_AUTH=1 \
 *   PHASE_10F_NEW_HARD_LIMIT_MINOR=113 \
 *   node --import tsx scripts/phase-10f-raise-workspace-hard-limit.mjs
 *
 * Dry preview (no write):
 *   CONFIRM_PHASE_10F_REMOTE_READ=1 node --import tsx scripts/phase-10f-raise-workspace-hard-limit.mjs --dry
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10F_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const DRY = process.argv.includes("--dry");
const NEW_HARD = Number(process.env.PHASE_10F_NEW_HARD_LIMIT_MINOR || "113");

function fail(msg, code = 1) {
  console.error(`BUDGET_AUTH_A FAIL: ${msg}`);
  process.exit(code);
}

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

if (DRY) {
  if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
    fail("dry preview requires CONFIRM_PHASE_10F_REMOTE_READ=1", 2);
  }
} else if (process.env.CONFIRM_PHASE_10F_BUDGET_AUTH !== "1") {
  fail(
    "Refused: set CONFIRM_PHASE_10F_BUDGET_AUTH=1 (writes workspace_budget_policies).",
    2
  );
}

if (!DRY && process.env.CONFIRM_PHASE_10F_VERCEL_FLAGS === "1") {
  fail("Refuse Vercel flag confirm during Budget Auth A apply.", 2);
}
if (!DRY && process.env.PHASE_10F_ALLOW_EXECUTE === "1") {
  fail("Refuse Storyboard execute during Budget Auth A apply.", 2);
}

if (!Number.isInteger(NEW_HARD) || NEW_HARD < 106 || NEW_HARD > 500) {
  fail("PHASE_10F_NEW_HARD_LIMIT_MINOR must be integer in [106,500]");
}

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
  fail(".env.remote.local incomplete");
}

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: proj } = await db
  .from("video_projects")
  .select("workspace_id")
  .eq("id", PROJECT_ID)
  .maybeSingle();
if (!proj) fail("project missing");
const ws = proj.workspace_id;

const { data: policy } = await db
  .from("workspace_budget_policies")
  .select("hard_limit_minor, currency")
  .eq("workspace_id", ws)
  .maybeSingle();
if (!policy) fail("budget policy missing");

const oldHard = Number(policy.hard_limit_minor);
if (NEW_HARD <= oldHard) {
  fail(`new hard limit ${NEW_HARD} must be > current ${oldHard}`);
}

const { data: commits } = await db
  .from("cost_ledger")
  .select("amount_minor")
  .eq("workspace_id", ws)
  .eq("entry_type", "commit");
const exposure = (commits ?? []).reduce((s, e) => s + Number(e.amount_minor), 0);
const { data: heldRows } = await db
  .from("budget_reservations")
  .select("amount_minor")
  .eq("workspace_id", ws)
  .eq("status", "active");
const held = (heldRows ?? []).reduce((s, e) => s + Number(e.amount_minor), 0);
const availableBefore = oldHard - held - exposure;
const availableAfter = NEW_HARD - held - exposure;

const preview = {
  phase: "10F-BUDGET-AUTH-A",
  mode: DRY ? "dry-preview" : "apply",
  workspaceIdPrefix: String(ws).slice(0, 8),
  oldHardLimitMinor: oldHard,
  newHardLimitMinor: NEW_HARD,
  deltaMinor: NEW_HARD - oldHard,
  exposureCommitted: exposure,
  activeHeld: held,
  availableBefore,
  availableAfter,
  canReserve13After: availableAfter >= 13,
  opensFlags: false,
  providerCalls: 0,
  storyboardExecute: false,
};

if (DRY) {
  console.log(JSON.stringify({ ...preview, applied: false }, null, 2));
  process.exit(preview.canReserve13After ? 0 : 2);
}

const now = new Date().toISOString();
const { error: updErr } = await db
  .from("workspace_budget_policies")
  .update({ hard_limit_minor: NEW_HARD, updated_at: now })
  .eq("workspace_id", ws)
  .eq("hard_limit_minor", oldHard);
if (updErr) fail(updErr.message);

const { data: after } = await db
  .from("workspace_budget_policies")
  .select("hard_limit_minor, currency, updated_at")
  .eq("workspace_id", ws)
  .maybeSingle();
if (Number(after?.hard_limit_minor) !== NEW_HARD) {
  fail("post-write proof failed — hard_limit mismatch");
}

const corr = `corr-10f-budget-auth-a-${Date.now()}`;
const { error: auditErr } = await db.from("audit_log").insert({
  workspace_id: ws,
  project_id: PROJECT_ID,
  action: "workspace.budget_hard_limit.raised",
  resource_type: "workspace_budget_policies",
  resource_id: String(ws),
  actor_type: "shared_password",
  actor_id: "phase-10f-budget-auth-a",
  correlation_id: corr,
  metadata: {
    oldHardLimitMinor: oldHard,
    newHardLimitMinor: NEW_HARD,
    deltaMinor: NEW_HARD - oldHard,
    exposureCommitted: exposure,
    availableAfter: NEW_HARD - held - exposure,
    motif: "phase_10f_storyboard_budget_authorization",
    script: "phase-10f-raise-workspace-hard-limit.mjs",
    requestId: randomUUID(),
  },
  created_at: now,
});
if (auditErr) {
  await db
    .from("workspace_budget_policies")
    .update({ hard_limit_minor: oldHard, updated_at: new Date().toISOString() })
    .eq("workspace_id", ws)
    .eq("hard_limit_minor", NEW_HARD);
  fail(`audit_log insert failed — hard limit rolled back: ${auditErr.message}`);
}

const evidence = {
  ...preview,
  applied: true,
  postWriteHardLimitMinor: Number(after.hard_limit_minor),
  postWriteUpdatedAt: after.updated_at,
  auditCorrelationId: corr,
  PHASE_10F_BUDGET_AUTH_DONE: "1",
  next: "Auth B Storyboard only after verify-budget-ready",
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const out = resolve(studioRoot, ".tmp/phase-10f-budget-auth-a-done.json");
writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({ ...evidence, evidencePath: out }, null, 2));
process.exit(0);

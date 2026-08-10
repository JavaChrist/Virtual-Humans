/**
 * Phase 10F — prove Auth A succeeded: available >= 13¢ for Storyboard reserve.
 * Read-only. Gate for Auth B.
 *
 * Requires: CONFIRM_PHASE_10F_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
  console.error("Refused: CONFIRM_PHASE_10F_REMOTE_READ=1");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10F_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const NEED = 13;

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
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: proj } = await db
  .from("video_projects")
  .select("workspace_id")
  .eq("id", PROJECT_ID)
  .maybeSingle();
const ws = proj.workspace_id;
const { data: policy } = await db
  .from("workspace_budget_policies")
  .select("hard_limit_minor")
  .eq("workspace_id", ws)
  .maybeSingle();
const hard = Number(policy.hard_limit_minor);
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
const available = hard - held - exposure;

const authAPath = resolve(studioRoot, ".tmp/phase-10f-budget-auth-a-done.json");
const authAPresent = existsSync(authAPath);
let authA = null;
if (authAPresent) {
  authA = JSON.parse(readFileSync(authAPath, "utf8"));
}

const ready =
  available >= NEED &&
  hard >= 106 &&
  authAPresent &&
  authA?.applied === true &&
  Number(authA?.postWriteHardLimitMinor) === hard;

const out = {
  phase: "10F-BUDGET-READY",
  hardLimitMinor: hard,
  exposure,
  activeHeld: held,
  available,
  need: NEED,
  authAEvidencePresent: authAPresent,
  readyForStoryboardAuthB: ready,
  PHASE_10F_BUDGET_AUTH_DONE: ready ? "1" : "0",
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const path = resolve(studioRoot, ".tmp/phase-10f-budget-ready.json");
writeFileSync(path, JSON.stringify({ ...out, evidencePath: path }, null, 2));
console.log(JSON.stringify({ ...out, evidencePath: path }, null, 2));
process.exit(ready ? 0 : 2);

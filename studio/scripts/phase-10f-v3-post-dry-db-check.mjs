/**
 * Phase 10F-V3-DEPLOY-PREFLIGHT — post dry-run DB proof (read-only).
 * Requires: CONFIRM_PHASE_10F_REMOTE_READ=1
 * Env: PHASE_10F_CORR_PREFIX optional (default corr-10f-v3-)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
  console.error("Refused: CONFIRM_PHASE_10F_REMOTE_READ=1");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const RUNS = [
  "b446a0ed-0005-40ed-b134-b7ab769bd819",
  "f5b75018-5aa1-4a16-97e1-7e515f94f106",
  "4914c203-3be0-4f62-8529-a9b3db25448e",
];
const CORR = process.env.PHASE_10F_DRY_CORR || "";
const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

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
const { count: activeHeld } = await db
  .from("budget_reservations")
  .select("id", { count: "exact", head: true })
  .eq("workspace_id", ws)
  .eq("status", "active");

let recentRunsQ = db
  .from("director_runs")
  .select("id,status,correlation_id,created_at")
  .eq("project_id", PROJECT_ID)
  .gte("created_at", since);
if (CORR) recentRunsQ = recentRunsQ.eq("correlation_id", CORR);
const { data: recentRuns } = await recentRunsQ;

const { data: recentLedger } = await db
  .from("cost_ledger")
  .select("id,entry_type,amount_minor,created_at,correlation_id")
  .eq("workspace_id", ws)
  .gte("created_at", since);

const { data: activeSb } = await db
  .from("active_artifact_revisions")
  .select("artifact_id")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "storyboard_project")
  .maybeSingle();

const { data: prior } = await db
  .from("director_runs")
  .select("id,status,error_code")
  .in("id", RUNS);

const available = hard - (activeHeld ?? 0) - exposure;
const pass =
  hard === 115 &&
  exposure === 101 &&
  (activeHeld ?? 0) === 0 &&
  available === 14 &&
  !activeSb &&
  (recentRuns ?? []).length === 0 &&
  (recentLedger ?? []).length === 0 &&
  RUNS.every((id) => prior?.find((r) => r.id === id)?.status === "failed");

console.log(
  JSON.stringify(
    {
      hard,
      exposure,
      activeHeld: activeHeld ?? 0,
      available,
      activeStoryboard: activeSb ?? null,
      recentRunsCount: (recentRuns ?? []).length,
      recentLedgerCount: (recentLedger ?? []).length,
      priorImmutable: (prior ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        errorCode: r.error_code,
      })),
      pass,
    },
    null,
    2,
  ),
);
process.exit(pass ? 0 : 2);

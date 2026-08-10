/**
 * Phase 10F-V3-EXECUTE — capture redacted evidence for a Storyboard run (read-only).
 * Requires: CONFIRM_PHASE_10F_REMOTE_READ=1
 * Env: PHASE_10F_RUN_ID, PHASE_10F_CORR
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
  console.error("Refused: CONFIRM_PHASE_10F_REMOTE_READ=1");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const RUN_ID = process.env.PHASE_10F_RUN_ID;
const CORR = process.env.PHASE_10F_CORR;
const PRIOR = [
  "b446a0ed-0005-40ed-b134-b7ab769bd819",
  "f5b75018-5aa1-4a16-97e1-7e515f94f106",
  "4914c203-3be0-4f62-8529-a9b3db25448e",
];

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

const RUN_COLS =
  "id, director_type, status, error_code, attempt_number, retry_of_run_id, prompt_version, schema_version, model_id, idempotency_key, estimated_cost_minor, actual_cost_minor, cost_status, output_artifact_id, correlation_id, usage, created_at, completed_at";

const { data: run, error: runErr } = await db
  .from("director_runs")
  .select(RUN_COLS)
  .eq("id", RUN_ID)
  .maybeSingle();

const { data: byCorr } = await db
  .from("director_runs")
  .select(RUN_COLS)
  .eq("correlation_id", CORR);

const chosen = run ?? byCorr?.[0] ?? null;

const { data: ledger } = await db
  .from("cost_ledger")
  .select("entry_type,amount_minor,correlation_id,created_at")
  .eq("workspace_id", ws)
  .eq("correlation_id", CORR)
  .order("created_at", { ascending: true });

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

const { data: activeSb } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "storyboard_project")
  .maybeSingle();

const { data: prior } = await db
  .from("director_runs")
  .select("id,status,error_code")
  .in("id", PRIOR);

const { data: upstream } = await db
  .from("active_artifact_revisions")
  .select("artifact_type,artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .in("artifact_type", [
    "marketing_plan",
    "creative_concept",
    "video_script",
    "visual_direction",
  ]);

const keyFp = chosen?.idempotency_key
  ? createHash("sha256").update(chosen.idempotency_key).digest("hex").slice(0, 16)
  : null;

const byType = {};
for (const e of ledger ?? []) {
  byType[e.entry_type] = Number(e.amount_minor);
}

const out = {
  runErr: runErr?.message ?? null,
  run: chosen
    ? {
        id: chosen.id,
        status: chosen.status,
        errorCode: chosen.error_code,
        attemptNumber: chosen.attempt_number,
        retryOfRunId: chosen.retry_of_run_id,
        promptVersion: chosen.prompt_version,
        schemaVersion: chosen.schema_version,
        modelId: chosen.model_id,
        idempotencyKeyFingerprint: keyFp,
        estimatedCostMinor: chosen.estimated_cost_minor,
        actualCostMinor: chosen.actual_cost_minor,
        costStatus: chosen.cost_status,
        outputArtifactId: chosen.output_artifact_id,
        correlationId: chosen.correlation_id,
        usage: chosen.usage ?? null,
        createdAt: chosen.created_at,
        completedAt: chosen.completed_at,
      }
    : null,
  ledgerByType: byType,
  ledgerEntries: (ledger ?? []).map((e) => ({
    type: e.entry_type,
    amount: Number(e.amount_minor),
  })),
  budgetAfter: {
    hard,
    committed: exposure,
    reserved: activeHeld ?? 0,
    available: hard - (activeHeld ?? 0) - exposure,
  },
  activeStoryboard: activeSb ?? null,
  priorImmutable: prior ?? [],
  upstreamActive: upstream ?? [],
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const path = resolve(studioRoot, ".tmp/phase-10f-v3-execute-capture.json");
writeFileSync(path, JSON.stringify(out, null, 2), "utf8");
console.log(JSON.stringify({ ...out, evidencePath: path }, null, 2));
process.exit(chosen ? 0 : 2);

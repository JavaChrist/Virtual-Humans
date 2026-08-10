/**
 * Phase 10C — Zod-validate persisted CreativeConcept (read-only, redacted).
 * Requires: CONFIRM_PHASE_10C_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10C_REMOTE_READ !== "1") {
  console.error("Refused: CONFIRM_PHASE_10C_REMOTE_READ=1");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10C_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const RUN_ID =
  process.env.PHASE_10C_RUN_ID || "f398d325-9af4-476f-a126-a85fcf8fdb13";

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
const { CreativeConceptSchema } = await import("../src/domain/creative/index.ts");
const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: run } = await db
  .from("director_runs")
  .select(
    "id,director_type,status,cost_status,attempt_number,model_id,prompt_version,schema_version,output_artifact_id,correlation_id,estimated_cost_minor,actual_cost_minor"
  )
  .eq("id", RUN_ID)
  .maybeSingle();

const { data: active } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "creative_concept")
  .maybeSingle();

const { data: art } = active
  ? await db
      .from("project_artifacts")
      .select(
        "id,revision,value,created_by,correlation_id,schema_version,created_at"
      )
      .eq("id", active.artifact_id)
      .maybeSingle()
  : { data: null };

const { data: mktActive } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "marketing_plan")
  .maybeSingle();

const { count: jobs } = await db
  .from("production_jobs")
  .select("*", { count: "exact", head: true })
  .eq("project_id", PROJECT_ID);

const { data: ledger } = await db
  .from("cost_ledger")
  .select("entry_type,amount_minor,currency,idempotency_key,correlation_id")
  .eq("run_id", RUN_ID)
  .order("created_at", { ascending: true });

const zod = art ? CreativeConceptSchema.safeParse(art.value) : { success: false };

console.log(
  JSON.stringify(
    {
      run,
      marketingActive: mktActive,
      creativeActive: active
        ? { artifactId: active.artifact_id, revision: active.revision }
        : null,
      concept: art
        ? {
            artifactId: art.id,
            revision: art.revision,
            createdBy: art.created_by,
            correlationId: art.correlation_id,
            schemaVersion: art.schema_version,
            createdAt: art.created_at,
            zodOk: zod.success,
            issueCount: zod.success ? 0 : zod.error.issues.length,
            issues: zod.success
              ? []
              : zod.error.issues.slice(0, 8).map((i) => ({
                  path: i.path.join("."),
                  msg: i.message,
                })),
            emotionalArcLen: Array.isArray(art.value?.emotionalArc)
              ? art.value.emotionalArc.length
              : null,
          }
        : null,
      ledger: ledger ?? [],
      productionJobs: jobs ?? 0,
      bodyPrinted: false,
    },
    null,
    2
  )
);
process.exit(zod.success && run?.status === "completed" ? 0 : 2);

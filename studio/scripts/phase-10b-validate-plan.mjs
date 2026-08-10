/**
 * Phase 10B — Zod-validate persisted MarketingPlan from Production (read-only).
 * Loads SUPABASE_* from .env.remote.local. Never prints secrets or full plan text.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const artifactId =
  process.argv[2] || "199284d6-7126-4383-b85f-1ecd74d9528e";

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

const { MarketingPlanSchema } = await import(
  "../src/domain/marketing/index.ts"
);

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await db
  .from("project_artifacts")
  .select(
    "id,revision,value,created_by,correlation_id,schema_version,created_at"
  )
  .eq("id", artifactId)
  .maybeSingle();

if (error) {
  console.error("FAIL:", error.message);
  process.exit(1);
}
if (!data) {
  console.error("FAIL: artifact not found");
  process.exit(1);
}

const r = MarketingPlanSchema.safeParse(data.value);
console.log(
  JSON.stringify(
    {
      zodOk: r.success,
      issueCount: r.success ? 0 : r.error.issues.length,
      issues: r.success
        ? []
        : r.error.issues.slice(0, 12).map((i) => ({
            path: i.path.join("."),
            msg: i.message,
          })),
      artifactId: data.id,
      revision: data.revision,
      createdBy: data.created_by,
      correlationId: data.correlation_id,
      schemaVersion: data.schema_version,
      createdAt: data.created_at,
      hasId: Boolean(data.value?.id),
      hasProjectId: Boolean(data.value?.projectId),
      hasBriefRevisionId: Boolean(data.value?.briefRevisionId),
      marketingObjective: data.value?.marketingObjective,
      tone: data.value?.tone,
      videoStyle: data.value?.videoStyle,
      planRevision: data.value?.revision,
      keyMessagesCount: Array.isArray(data.value?.keyMessages)
        ? data.value.keyMessages.length
        : null,
    },
    null,
    2
  )
);
process.exit(r.success ? 0 : 2);

/**
 * Phase 10C-PREP — verify MarketingPlan 10B identity on Production (read-only).
 * Never prints plan body / sensitive free text. Never writes.
 *
 * Requires: CONFIRM_PHASE_10C_REMOTE_READ=1
 *
 * Usage (from studio/):
 *   $env:CONFIRM_PHASE_10C_REMOTE_READ="1"
 *   node --import tsx scripts/phase-10c-verify-marketing-plan.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10C_REMOTE_READ !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10C_REMOTE_READ=1 (reads Production via .env.remote.local)."
  );
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10C_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const MARKETING_ARTIFACT_ID =
  process.env.PHASE_10C_MARKETING_ARTIFACT_ID ||
  "199284d6-7126-4383-b85f-1ecd74d9528e";

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

function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(invalid-url)";
  }
}

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FAIL: .env.remote.local incomplete");
  process.exit(1);
}

const { MarketingPlanSchema } = await import("../src/domain/marketing/index.ts");

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: art, error: artErr } = await db
  .from("project_artifacts")
  .select(
    "id,project_id,artifact_type,revision,value,created_by,correlation_id,schema_version,created_at"
  )
  .eq("id", MARKETING_ARTIFACT_ID)
  .maybeSingle();

if (artErr) {
  console.error("FAIL:", artErr.message);
  process.exit(1);
}
if (!art) {
  console.error("FAIL: marketing artifact not found");
  process.exit(1);
}

const { data: active, error: activeErr } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision,artifact_type,updated_at")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "marketing_plan")
  .maybeSingle();

if (activeErr) {
  console.error("FAIL:", activeErr.message);
  process.exit(1);
}

const { data: creativeActive } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "creative_concept")
  .maybeSingle();

const zod = MarketingPlanSchema.safeParse(art.value);
const valueHash = createHash("sha256")
  .update(JSON.stringify(art.value ?? null))
  .digest("hex")
  .slice(0, 16);

const report = {
  phase: "10C-PREP",
  remoteHost: redactUrl(remote.SUPABASE_URL),
  projectId: PROJECT_ID,
  expectedMarketingArtifactId: MARKETING_ARTIFACT_ID,
  marketing: {
    artifactId: art.id,
    projectIdMatch: art.project_id === PROJECT_ID,
    artifactType: art.artifact_type,
    revision: art.revision,
    schemaVersion: art.schema_version,
    createdBy: art.created_by,
    correlationId: art.correlation_id,
    createdAt: art.created_at,
    zodOk: zod.success,
    valueSha256Prefix: valueHash,
    marketingObjective: art.value?.marketingObjective ?? null,
    tone: art.value?.tone ?? null,
    videoStyle: art.value?.videoStyle ?? null,
    keyMessagesCount: Array.isArray(art.value?.keyMessages)
      ? art.value.keyMessages.length
      : null,
    planRevision: art.value?.revision ?? null,
  },
  activeMarketingPlan: active
    ? {
        artifactId: active.artifact_id,
        revision: active.revision,
        matchesExpected: active.artifact_id === MARKETING_ARTIFACT_ID,
        updatedAt: active.updated_at,
      }
    : null,
  existingCreativeConcept: creativeActive
    ? {
        artifactId: creativeActive.artifact_id,
        revision: creativeActive.revision,
      }
    : null,
  reusable:
    zod.success &&
    art.project_id === PROJECT_ID &&
    art.artifact_type === "marketing_plan" &&
    Boolean(active) &&
    active.artifact_id === MARKETING_ARTIFACT_ID,
  bodyPrinted: false,
};

const evidenceDir = resolve(studioRoot, ".tmp");
mkdirSync(evidenceDir, { recursive: true });
const outPath = resolve(
  evidenceDir,
  `phase-10c-prep-marketing-plan-${Date.now()}.json`
);
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

console.log(JSON.stringify({ ...report, evidencePath: outPath }, null, 2));
process.exit(report.reusable ? 0 : 2);

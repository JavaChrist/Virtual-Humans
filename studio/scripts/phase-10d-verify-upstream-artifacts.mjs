/**
 * Phase 10D-PREP — verify MarketingPlan + CreativeConcept identities (read-only).
 * Never prints artifact bodies. Confirms no active VideoScript yet.
 *
 * Requires: CONFIRM_PHASE_10D_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM_PHASE_10D_REMOTE_READ !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10D_REMOTE_READ=1 (reads Production via .env.remote.local)."
  );
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10D_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const MARKETING_ARTIFACT_ID =
  process.env.PHASE_10D_MARKETING_ARTIFACT_ID ||
  "199284d6-7126-4383-b85f-1ecd74d9528e";
const CREATIVE_ARTIFACT_ID =
  process.env.PHASE_10D_CREATIVE_ARTIFACT_ID ||
  "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a";

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

function hashValue(value) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex")
    .slice(0, 16);
}

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FAIL: .env.remote.local incomplete");
  process.exit(1);
}

const { MarketingPlanSchema } = await import("../src/domain/marketing/index.ts");
const { CreativeConceptSchema } = await import("../src/domain/creative/index.ts");

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadArt(id) {
  const { data, error } = await db
    .from("project_artifacts")
    .select(
      "id,project_id,artifact_type,revision,value,created_by,correlation_id,schema_version,created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadActive(type) {
  const { data, error } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision,artifact_type,updated_at")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", type)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const mkt = await loadArt(MARKETING_ARTIFACT_ID);
const cre = await loadArt(CREATIVE_ARTIFACT_ID);
const activeMkt = await loadActive("marketing_plan");
const activeCre = await loadActive("creative_concept");
const activeScript = await loadActive("video_script");

if (!mkt || !cre) {
  console.error("FAIL: upstream artifact missing");
  process.exit(1);
}

const mktZod = MarketingPlanSchema.safeParse(mkt.value);
const creZod = CreativeConceptSchema.safeParse(cre.value);

const report = {
  phase: "10D-PREP",
  remoteHost: redactUrl(remote.SUPABASE_URL),
  projectId: PROJECT_ID,
  marketing: {
    artifactId: mkt.id,
    projectIdMatch: mkt.project_id === PROJECT_ID,
    revision: mkt.revision,
    zodOk: mktZod.success,
    valueSha256Prefix: hashValue(mkt.value),
    correlationId: mkt.correlation_id,
    createdBy: mkt.created_by,
    activeMatches:
      Boolean(activeMkt) && activeMkt.artifact_id === MARKETING_ARTIFACT_ID,
    activeRevision: activeMkt?.revision ?? null,
  },
  creative: {
    artifactId: cre.id,
    projectIdMatch: cre.project_id === PROJECT_ID,
    revision: cre.revision,
    zodOk: creZod.success,
    valueSha256Prefix: hashValue(cre.value),
    correlationId: cre.correlation_id,
    createdBy: cre.created_by,
    activeMatches:
      Boolean(activeCre) && activeCre.artifact_id === CREATIVE_ARTIFACT_ID,
    activeRevision: activeCre?.revision ?? null,
  },
  existingVideoScript: activeScript
    ? {
        artifactId: activeScript.artifact_id,
        revision: activeScript.revision,
      }
    : null,
  reusable:
    mktZod.success &&
    creZod.success &&
    mkt.project_id === PROJECT_ID &&
    cre.project_id === PROJECT_ID &&
    Boolean(activeMkt) &&
    activeMkt.artifact_id === MARKETING_ARTIFACT_ID &&
    Boolean(activeCre) &&
    activeCre.artifact_id === CREATIVE_ARTIFACT_ID &&
    !activeScript,
  bodyPrinted: false,
};

const evidenceDir = resolve(studioRoot, ".tmp");
mkdirSync(evidenceDir, { recursive: true });
const outPath = resolve(
  evidenceDir,
  `phase-10d-prep-upstream-${Date.now()}.json`
);
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ ...report, evidencePath: outPath }, null, 2));
process.exit(report.reusable ? 0 : 2);

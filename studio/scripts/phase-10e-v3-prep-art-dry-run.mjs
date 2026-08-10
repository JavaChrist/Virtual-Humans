/**
 * Phase 10E-RETRY-PREP — local Art dry-run under art-analyzer-v3.
 * NO provider call. NO remote writes. NO Vercel writes.
 *
 * Requires:
 *   CONFIRM_PHASE_10E_V3_PREP=1
 *   CONFIRM_PHASE_10E_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

if (process.env.CONFIRM_PHASE_10E_V3_PREP !== "1") {
  console.error("Refused: set CONFIRM_PHASE_10E_V3_PREP=1");
  process.exit(2);
}
if (process.env.CONFIRM_PHASE_10E_REMOTE_READ !== "1") {
  console.error("Refused: set CONFIRM_PHASE_10E_REMOTE_READ=1");
  process.exit(2);
}
if (process.env.PHASE_10E_V3_ALLOW_EXECUTE === "1") {
  console.error("Refused: PHASE_10E_V3_ALLOW_EXECUTE forbidden during PREP.");
  process.exit(2);
}
if (process.env.PHASE_10E_ALLOW_EXECUTE === "1") {
  console.error("Refused: legacy PHASE_10E_ALLOW_EXECUTE forbidden during V3 PREP.");
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10E_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const SCRIPT_ARTIFACT_ID =
  process.env.PHASE_10E_SCRIPT_ARTIFACT_ID ||
  "349e2792-3235-4c00-a1da-9e087b0b4d1c";
const V2_FAILED_RUN =
  process.env.PHASE_10E_V2_FAILED_RUN_ID ||
  "53fb45c3-0d36-43d9-9882-6a96fde2a814";

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
  console.error("Missing .env.remote.local Supabase credentials.");
  process.exit(2);
}

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Dynamic import TS via tsx — invoke with: node --import tsx scripts/...
const artMod = await import(
  pathToFileURL(
    resolve(studioRoot, "src/infrastructure/ai/openai/art/index.ts")
  ).href
);
const pricingMod = await import(
  pathToFileURL(
    resolve(
      studioRoot,
      "src/infrastructure/ai/openai/marketing/pricing.ts"
    )
  ).href
);
const briefMod = await import(
  pathToFileURL(resolve(studioRoot, "src/domain/brief/schemas.ts")).href
);
const planMod = await import(
  pathToFileURL(resolve(studioRoot, "src/domain/marketing/schemas.ts")).href
);
const conceptMod = await import(
  pathToFileURL(resolve(studioRoot, "src/domain/creative/schemas.ts")).href
);
const scriptMod = await import(
  pathToFileURL(resolve(studioRoot, "src/domain/script/schemas.ts")).href
);

const {
  ART_ANALYZER_PROMPT_VERSION,
  ART_CANDIDATE_SCHEMA_VERSION,
  runOpenAIArtDryRun,
} = artMod;
const configMod = await import(
  pathToFileURL(
    resolve(studioRoot, "src/infrastructure/ai/openai/config.ts")
  ).href
);
const { parseOpenAIArtConfig } = configMod;
const { createEnvAiTokenPricing } = pricingMod;

if (ART_ANALYZER_PROMPT_VERSION !== "art-analyzer-v3") {
  console.error(`Expected art-analyzer-v3, got ${ART_ANALYZER_PROMPT_VERSION}`);
  process.exit(1);
}

const { data: activeRows, error: activeErr } = await db
  .from("active_artifact_revisions")
  .select("artifact_type, artifact_id, revision")
  .eq("project_id", PROJECT_ID)
  .in("artifact_type", [
    "video_project_brief",
    "marketing_plan",
    "creative_concept",
    "video_script",
    "visual_direction",
  ]);
if (activeErr) {
  console.error(activeErr.message);
  process.exit(1);
}
const byType = Object.fromEntries(
  (activeRows ?? []).map((r) => [r.artifact_type, r])
);
if (byType.visual_direction) {
  console.error("FAIL: visual_direction already active");
  process.exit(1);
}
if (byType.video_script?.artifact_id !== SCRIPT_ARTIFACT_ID) {
  console.error("FAIL: unexpected VideoScript active artifact");
  process.exit(1);
}

async function loadArtifact(id) {
  const { data, error } = await db
    .from("project_artifacts")
    .select("id, artifact_type, revision, value, correlation_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error(`artifact ${id} missing`);
  return data;
}

const briefArt = await loadArtifact(byType.video_project_brief.artifact_id);
const planArt = await loadArtifact(byType.marketing_plan.artifact_id);
const conceptArt = await loadArtifact(byType.creative_concept.artifact_id);
const scriptArt = await loadArtifact(byType.video_script.artifact_id);

const brief = briefMod.VideoProjectBriefSchema.parse(briefArt.value);
const plan = planMod.MarketingPlanSchema.parse(planArt.value);
const concept = conceptMod.CreativeConceptSchema.parse(conceptArt.value);
const script = scriptMod.VideoScriptSchema.parse(scriptArt.value);

const { data: failedRun } = await db
  .from("director_runs")
  .select(
    "id, status, error_code, attempt_number, prompt_version, schema_version, model_id, actual_cost_minor, cost_status, retry_of_run_id, output_artifact_id"
  )
  .eq("id", V2_FAILED_RUN)
  .maybeSingle();

const { data: ledger } = await db
  .from("cost_ledger")
  .select("entry_type, amount_minor")
  .eq("correlation_id", "corr-10e-1786366222453-exec")
  .order("created_at", { ascending: true });

const pricingEnv = {
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_ART_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
  OPENAI_API_KEY: "sk-prep-not-used",
  OPENAI_ART_MODEL: "gpt-5.6",
  OPENAI_ART_REASONING_EFFORT: "medium",
  OPENAI_ART_MAX_OUTPUT_TOKENS: "4096",
  OPENAI_MARKETING_PRICE_VERSION: "manual-2026-08-porte7-sol",
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: "500",
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: "3000",
};

const config = parseOpenAIArtConfig(pricingEnv);
const pricing = createEnvAiTokenPricing(pricingEnv);
const book = pricing.getPriceBook(config.model);
const dry = runOpenAIArtDryRun(brief, plan, concept, script, undefined, {
  env: pricingEnv,
  config,
  pricing,
});

const estimatedCostMinor =
  book && dry.approximateInputTokens != null
    ? Math.max(
        1,
        Math.floor(
          (dry.approximateInputTokens * book.inputPerMillionMinor) / 1_000_000
        ) +
          Math.floor(
            (dry.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
          )
      )
    : null;

function keyFor(promptVersion) {
  const fields = [
    PROJECT_ID,
    briefArt.id,
    String(briefArt.revision),
    planArt.id,
    String(planArt.revision),
    conceptArt.id,
    String(conceptArt.revision),
    scriptArt.id,
    String(scriptArt.revision),
    dry.model,
    promptVersion,
    ART_CANDIDATE_SCHEMA_VERSION,
  ];
  const raw = ["art", ...fields].join(":");
  return {
    rawLength: raw.length,
    key: raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex"),
    fingerprint: createHash("sha256").update(fields.join("|")).digest("hex"),
    version: `${promptVersion}:${ART_CANDIDATE_SCHEMA_VERSION}`,
  };
}

const keyV2 = keyFor("art-analyzer-v2");
const keyV3 = keyFor(ART_ANALYZER_PROMPT_VERSION);

const report = {
  phase: "10E-RETRY-PREP",
  mode: "dry-run-only",
  providerCalled: dry.providerCalled,
  networkProviderCall: false,
  remoteWrites: false,
  vercelEnvWrites: false,
  mediaGeneration: false,
  artRetryRoute: false,
  projectId: PROJECT_ID,
  provider: "openai",
  model: dry.model,
  reasoningEffort: dry.reasoningEffort,
  maxOutputTokens: dry.maxOutputTokens,
  promptVersion: dry.promptVersion,
  schemaVersion: dry.schemaVersion,
  idempotencyKeyVersion: `${dry.promptVersion}:${dry.schemaVersion}`,
  pricingConfigured: dry.pricingConfigured,
  executable: dry.executable,
  estimatedCostMinor,
  reservationPlanned: estimatedCostMinor,
  proposedCeilingMinor: 100,
  previousFailedRun: failedRun
    ? {
        id: failedRun.id,
        status: failedRun.status,
        errorCode: failedRun.error_code,
        attemptNumber: failedRun.attempt_number,
        promptVersion: failedRun.prompt_version,
        schemaVersion: failedRun.schema_version,
        modelId: failedRun.model_id,
        actualCostMinor: failedRun.actual_cost_minor,
        costStatus: failedRun.cost_status,
        retryOfRunId: failedRun.retry_of_run_id,
        outputArtifactId: failedRun.output_artifact_id,
      }
    : null,
  previousFailedRunIgnoredForNewContract: Boolean(
    failedRun &&
      failedRun.prompt_version !== ART_ANALYZER_PROMPT_VERSION
  ),
  ledgerV2: ledger ?? [],
  idempotency: {
    v2: { version: keyV2.version, keyPrefix: keyV2.key.slice(0, 16), fingerprintPrefix: keyV2.fingerprint.slice(0, 16) },
    v3: { version: keyV3.version, keyPrefix: keyV3.key.slice(0, 16), fingerprintPrefix: keyV3.fingerprint.slice(0, 16) },
    keysEqual: keyV2.key === keyV3.key,
    fingerprintsEqual: keyV2.fingerprint === keyV3.fingerprint,
  },
  futureExecuteIdentity: {
    attempt_number: 1,
    retry_of_run_id: null,
    path: "/art",
    notPath: "/art/retry",
  },
  segmentCount: script.segments.length,
  characterId: brief.characterId ?? null,
  existingVisualDirection: false,
};

if (report.idempotency.keysEqual || report.idempotency.fingerprintsEqual) {
  console.error("FAIL: v2 and v3 idempotency identities must diverge");
  process.exit(1);
}
if (dry.providerCalled !== false) {
  console.error("FAIL: providerCalled must be false");
  process.exit(1);
}

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const out = resolve(
  studioRoot,
  `.tmp/phase-10e-v3-prep-dry-run-${Date.now()}.json`
);
writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ ...report, evidencePath: out }, null, 2));

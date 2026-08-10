/**
 * Phase 10F-PREP — Storyboard text dry-run against Production Brief + Marketing +
 * Creative + Script + VisualDirection.
 * Guaranteed: NO OpenAI call. NO remote writes. NO Vercel writes. NO media.
 *
 * Requires:
 *   CONFIRM_PHASE_10F_PREP=1
 *   CONFIRM_PHASE_10F_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  readFileSync,
  existsSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

if (process.env.CONFIRM_PHASE_10F_PREP !== "1") {
  console.error("Refused: set CONFIRM_PHASE_10F_PREP=1");
  process.exit(2);
}
if (process.env.CONFIRM_PHASE_10F_REMOTE_READ !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10F_REMOTE_READ=1 (Production artifact read)."
  );
  process.exit(2);
}
if (process.env.PHASE_10F_ALLOW_EXECUTE === "1") {
  console.error(
    "Refused: PHASE_10F_ALLOW_EXECUTE is forbidden during PREP (no real Storyboard call)."
  );
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10F_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const MARKETING_ARTIFACT_ID =
  process.env.PHASE_10F_MARKETING_ARTIFACT_ID ||
  "199284d6-7126-4383-b85f-1ecd74d9528e";
const CREATIVE_ARTIFACT_ID =
  process.env.PHASE_10F_CREATIVE_ARTIFACT_ID ||
  "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a";
const SCRIPT_ARTIFACT_ID =
  process.env.PHASE_10F_SCRIPT_ARTIFACT_ID ||
  "349e2792-3235-4c00-a1da-9e087b0b4d1c";
const VISUAL_ARTIFACT_ID =
  process.env.PHASE_10F_VISUAL_ARTIFACT_ID ||
  "49481462-6444-41f9-8c48-7e7d32c09f1b";

const DEFAULT_CEILING_MINOR = 100;
const EXPECTED_PROMPT = "storyboard-analyzer-v2";

/** Canonical Production price book (Porte 7H-B / 10B–10E). */
const PRODUCTION_CANONICAL_PRICE = {
  version: "manual-2026-08-porte7-sol",
  inputPerMillionMinor: "500",
  outputPerMillionMinor: "3000",
  source: "porte-7hb-canonical+10b-10e-crosscheck",
};

/**
 * Candidate Production Storyboard knobs when `vercel env pull` redacts Sensitive values.
 * NOT live-observed for Storyboard (runtime OFF / PREP forbids opening flags).
 * Pattern aligned with Production text directors 10B–10E (gpt-5.6 / medium / 4096).
 * First live dry-run after flag open MUST confirm before execute.
 */
const PRODUCTION_DOCUMENTED_STORYBOARD = {
  model: "gpt-5.6",
  reasoningEffort: "medium",
  maxOutputTokens: "4096",
  source: "production-text-director-pattern-10b-10c-10d-10e",
  confidence: "unconfirmed_pending_live_dry_run",
};

const CODE_DEFAULT_STORYBOARD = {
  model: "gpt-5.6-terra",
  reasoningEffort: "low",
  maxOutputTokens: "3200",
  source: "code-defaults-config.ts",
};

function fail(msg, code = 1) {
  console.error(`PREP_10F FAIL: ${msg}`);
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

function envOrUndef(v) {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(invalid-url)";
  }
}

function pullProductionEnv() {
  const tmp = resolve(studioRoot, ".env.vercel.10f.prep.tmp");
  try {
    const r = spawnSync(
      "npx",
      ["vercel", "env", "pull", tmp, "--environment", "production", "--yes"],
      { encoding: "utf8", shell: true, cwd: studioRoot, env: process.env }
    );
    if (r.status !== 0) fail("vercel env pull failed (read-only pricing/model).");
    return loadEnv(tmp);
  } finally {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function estimateMinor(approxIn, maxOut, book) {
  return (
    Math.floor((approxIn * book.inputPerMillionMinor) / 1_000_000) +
    Math.floor((maxOut * book.outputPerMillionMinor) / 1_000_000)
  );
}

function proposeCeiling(estimate) {
  const doubled = Math.ceil((estimate * 2) / 25) * 25;
  return Math.max(DEFAULT_CEILING_MINOR, doubled);
}

function hashPrefix(value) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")
    .slice(0, 16);
}

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
  fail(".env.remote.local incomplete");
}

const vercel = pullProductionEnv();
const { VideoProjectBriefSchema } = await import("../src/domain/brief/index.ts");
const { MarketingPlanSchema } = await import("../src/domain/marketing/index.ts");
const { CreativeConceptSchema } = await import("../src/domain/creative/index.ts");
const { VideoScriptSchema } = await import("../src/domain/script/index.ts");
const { VisualDirectionSchema } = await import("../src/domain/art/index.ts");
const { runOpenAIStoryboardDryRun } = await import(
  "../src/infrastructure/ai/openai/storyboard/dry-run.ts"
);
const { STORYBOARD_ANALYZER_PROMPT_VERSION, STORYBOARD_CANDIDATE_SCHEMA_VERSION } =
  await import("../src/infrastructure/ai/openai/storyboard/index.ts");
const { createEnvAiTokenPricing } = await import(
  "../src/infrastructure/ai/openai/marketing/pricing.ts"
);
const { parseOpenAIStoryboardConfig } = await import(
  "../src/infrastructure/ai/openai/config.ts"
);

if (STORYBOARD_ANALYZER_PROMPT_VERSION !== EXPECTED_PROMPT) {
  fail(
    `Expected prompt ${EXPECTED_PROMPT}, got ${STORYBOARD_ANALYZER_PROMPT_VERSION}`
  );
}

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadArt(id) {
  const { data, error } = await db
    .from("project_artifacts")
    .select("id,project_id,revision,value,correlation_id,schema_version")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error.message);
  return data;
}

async function loadActive(type) {
  const { data, error } = await db
    .from("active_artifact_revisions")
    .select("artifact_id,revision")
    .eq("project_id", PROJECT_ID)
    .eq("artifact_type", type)
    .maybeSingle();
  if (error) fail(error.message);
  return data;
}

const planArt = await loadArt(MARKETING_ARTIFACT_ID);
const conceptArt = await loadArt(CREATIVE_ARTIFACT_ID);
const scriptArt = await loadArt(SCRIPT_ARTIFACT_ID);
const visualArt = await loadArt(VISUAL_ARTIFACT_ID);
if (
  !planArt ||
  !conceptArt ||
  !scriptArt ||
  !visualArt ||
  planArt.project_id !== PROJECT_ID ||
  conceptArt.project_id !== PROJECT_ID ||
  scriptArt.project_id !== PROJECT_ID ||
  visualArt.project_id !== PROJECT_ID
) {
  fail("upstream artifact missing / project mismatch");
}

const activeBrief = await loadActive("video_project_brief");
if (!activeBrief) fail("Brief actif manquant");
const briefArt = await loadArt(activeBrief.artifact_id);
if (!briefArt) fail("Brief artifact introuvable");

const activeStoryboard = await loadActive("storyboard_project");
if (activeStoryboard) {
  fail("storyboard_project actif déjà présent — 10F-PREP refuse de continuer");
}

const activeMkt = await loadActive("marketing_plan");
const activeCre = await loadActive("creative_concept");
const activeScript = await loadActive("video_script");
const activeVisual = await loadActive("visual_direction");
if (
  !activeMkt ||
  activeMkt.artifact_id !== MARKETING_ARTIFACT_ID ||
  !activeCre ||
  activeCre.artifact_id !== CREATIVE_ARTIFACT_ID ||
  !activeScript ||
  activeScript.artifact_id !== SCRIPT_ARTIFACT_ID ||
  !activeVisual ||
  activeVisual.artifact_id !== VISUAL_ARTIFACT_ID
) {
  fail("active revision pointers do not match expected upstream artifacts");
}

const briefParsed = VideoProjectBriefSchema.safeParse(briefArt.value);
const planParsed = MarketingPlanSchema.safeParse(planArt.value);
const conceptParsed = CreativeConceptSchema.safeParse(conceptArt.value);
const scriptParsed = VideoScriptSchema.safeParse(scriptArt.value);
const visualParsed = VisualDirectionSchema.safeParse(visualArt.value);
if (
  !briefParsed.success ||
  !planParsed.success ||
  !conceptParsed.success ||
  !scriptParsed.success ||
  !visualParsed.success
) {
  fail("Zod brief/plan/concept/script/visual invalide — dry-run aborté");
}

const scriptSegCount = scriptParsed.data.segments.length;
const visualSegCount = visualParsed.data.segments.length;
if (scriptSegCount !== 5 || visualSegCount !== 5) {
  fail(
    `segment count mismatch — script=${scriptSegCount} visual=${visualSegCount} expected 5/5`
  );
}

const priceFromPull = {
  version: envOrUndef(vercel.OPENAI_MARKETING_PRICE_VERSION),
  input: envOrUndef(vercel.OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(vercel.OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceFromOverride = {
  version: envOrUndef(process.env.PHASE_10F_PRICE_VERSION),
  input: envOrUndef(process.env.PHASE_10F_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(process.env.PHASE_10F_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceSource =
  priceFromPull.version && priceFromPull.input && priceFromPull.output
    ? "vercel-env-pull"
    : priceFromOverride.version &&
        priceFromOverride.input &&
        priceFromOverride.output
      ? "phase-10f-env-override"
      : "production-canonical-documented";
const resolvedPrice =
  priceSource === "vercel-env-pull"
    ? priceFromPull
    : priceSource === "phase-10f-env-override"
      ? priceFromOverride
      : {
          version: PRODUCTION_CANONICAL_PRICE.version,
          input: PRODUCTION_CANONICAL_PRICE.inputPerMillionMinor,
          output: PRODUCTION_CANONICAL_PRICE.outputPerMillionMinor,
        };

const stbFromPull = {
  model: envOrUndef(vercel.OPENAI_STORYBOARD_MODEL),
  effort: envOrUndef(vercel.OPENAI_STORYBOARD_REASONING_EFFORT),
  maxOut: envOrUndef(vercel.OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS),
};
const storyboardKnobSource =
  stbFromPull.model || stbFromPull.effort || stbFromPull.maxOut
    ? "vercel-env-pull-partial-or-full"
    : "production-documented-10f-pattern";

const pricingEnv = {
  OPENAI_API_KEY:
    envOrUndef(vercel.OPENAI_API_KEY) ||
    envOrUndef(process.env.OPENAI_API_KEY) ||
    "sk-present-production-encrypted",
  OPENAI_STORYBOARD_MODEL:
    stbFromPull.model || PRODUCTION_DOCUMENTED_STORYBOARD.model,
  OPENAI_STORYBOARD_REASONING_EFFORT:
    stbFromPull.effort || PRODUCTION_DOCUMENTED_STORYBOARD.reasoningEffort,
  OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS:
    stbFromPull.maxOut || PRODUCTION_DOCUMENTED_STORYBOARD.maxOutputTokens,
  OPENAI_STORYBOARD_REQUIRE_PRICING:
    envOrUndef(vercel.OPENAI_STORYBOARD_REQUIRE_PRICING) || "1",
  OPENAI_MARKETING_PRICE_VERSION: resolvedPrice.version,
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: resolvedPrice.input,
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: resolvedPrice.output,
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
};

const codeDefaultEnv = {
  ...pricingEnv,
  OPENAI_STORYBOARD_MODEL: CODE_DEFAULT_STORYBOARD.model,
  OPENAI_STORYBOARD_REASONING_EFFORT: CODE_DEFAULT_STORYBOARD.reasoningEffort,
  OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS: CODE_DEFAULT_STORYBOARD.maxOutputTokens,
};

const config = parseOpenAIStoryboardConfig(pricingEnv);
const pricing = createEnvAiTokenPricing(pricingEnv);
const book = pricing.getPriceBook(config.model);

const dry = runOpenAIStoryboardDryRun(
  briefParsed.data,
  planParsed.data,
  conceptParsed.data,
  scriptParsed.data,
  visualParsed.data,
  { env: pricingEnv, config, pricing }
);

const codeCfg = parseOpenAIStoryboardConfig(codeDefaultEnv);
const codeDry = runOpenAIStoryboardDryRun(
  briefParsed.data,
  planParsed.data,
  conceptParsed.data,
  scriptParsed.data,
  visualParsed.data,
  {
    env: codeDefaultEnv,
    config: codeCfg,
    pricing: createEnvAiTokenPricing(codeDefaultEnv),
  }
);
const codeBook = createEnvAiTokenPricing(codeDefaultEnv).getPriceBook(
  codeDry.model
);
const codeDefaultEstimate =
  codeBook && codeDry.approximateInputTokens != null
    ? Math.max(
        1,
        estimateMinor(
          codeDry.approximateInputTokens,
          codeDry.maxOutputTokens,
          codeBook
        )
      )
    : null;

const estimatedCostMinor =
  book && dry.approximateInputTokens != null
    ? Math.max(
        1,
        estimateMinor(dry.approximateInputTokens, dry.maxOutputTokens, book)
      )
    : null;

const proposedCeilingMinor =
  estimatedCostMinor != null
    ? proposeCeiling(estimatedCostMinor)
    : DEFAULT_CEILING_MINOR;

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
  visualArt.id,
  String(visualArt.revision),
  dry.model,
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_CANDIDATE_SCHEMA_VERSION,
];
const idemRaw = ["stb", ...fields].join(":");
const idemKey =
  idemRaw.length <= 200
    ? idemRaw
    : createHash("sha256").update(idemRaw).digest("hex");
const fingerprint = createHash("sha256").update(fields.join("|")).digest("hex");

const report = {
  phase: "10F-PREP",
  mode: "dry-run-only",
  providerCalled: dry.providerCalled,
  networkProviderCall: false,
  remoteWrites: false,
  vercelEnvWrites: false,
  mediaGeneration: false,
  mediaJobs: false,
  worker: false,
  remoteHost: redactUrl(remote.SUPABASE_URL),
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
  brief: {
    artifactId: briefArt.id,
    revision: briefArt.revision,
    valueSha256Prefix: hashPrefix(briefArt.value),
    durationSeconds: briefParsed.data.durationSeconds,
    characterId: briefParsed.data.characterId ?? null,
  },
  marketingPlan: {
    artifactId: planArt.id,
    revision: planArt.revision,
    valueSha256Prefix: hashPrefix(planArt.value),
    correlationId: planArt.correlation_id,
  },
  creativeConcept: {
    artifactId: conceptArt.id,
    revision: conceptArt.revision,
    valueSha256Prefix: hashPrefix(conceptArt.value),
    correlationId: conceptArt.correlation_id,
  },
  videoScript: {
    artifactId: scriptArt.id,
    revision: scriptArt.revision,
    valueSha256Prefix: hashPrefix(scriptArt.value),
    correlationId: scriptArt.correlation_id,
    segmentCount: scriptSegCount,
    targetDurationSeconds: scriptParsed.data.targetDurationSeconds,
  },
  visualDirection: {
    artifactId: visualArt.id,
    revision: visualArt.revision,
    valueSha256Prefix: hashPrefix(visualArt.value),
    correlationId: visualArt.correlation_id,
    segmentCount: visualSegCount,
  },
  existingStoryboard: null,
  storyboardConfig: {
    model: dry.model,
    reasoningEffort: dry.reasoningEffort,
    maxOutputTokens: dry.maxOutputTokens,
    promptVersion: dry.promptVersion,
    schemaVersion: dry.schemaVersion,
    pricingConfigured: dry.pricingConfigured,
    priceSource,
    storyboardKnobSource,
    productionDocumentedSource: PRODUCTION_DOCUMENTED_STORYBOARD.source,
    storyboardKnobConfidence: PRODUCTION_DOCUMENTED_STORYBOARD.confidence,
    priceVersion: resolvedPrice.version,
    inputPerMillionMinor: book?.inputPerMillionMinor ?? null,
    outputPerMillionMinor: book?.outputPerMillionMinor ?? null,
    codeDefaultEstimateMinor: codeDefaultEstimate,
    codeDefaultModel: CODE_DEFAULT_STORYBOARD.model,
    codeDefaultMaxOutputTokens: Number(CODE_DEFAULT_STORYBOARD.maxOutputTokens),
  },
  dryRun: {
    executable: dry.executable,
    approximateInputTokens: dry.approximateInputTokens ?? null,
    validationsFailed: dry.validations
      .filter((v) => !v.passed)
      .map((v) => v.code),
    warningCodes: dry.warnings.map((w) => w.code),
  },
  budget: {
    estimatedCostMinor,
    reservationPlannedMinor: estimatedCostMinor,
    proposedCeilingMinor,
    currency: "USD",
    rule: "estimate <= plafond && reservation == estimate && maxCalls == 1 && mediaCalls == 0",
  },
  idempotency: {
    keyPreview: idemKey.length <= 64 ? idemKey : `${idemKey.slice(0, 16)}…`,
    keyLength: idemKey.length,
    fingerprintPrefix: fingerprint.slice(0, 16),
    components:
      "stb+projectId+brief+plan+concept+script+visual+model+prompt+schema",
  },
  guards: {
    marketingAiFlagSimulated: "0",
    creativeAiFlagSimulated: "0",
    scriptAiFlagSimulated: "0",
    artAiFlagSimulated: "0",
    storyboardAiFlagSimulated: "1",
    workerFlagSimulated: "0",
    paidGenerationFlagSimulated: "0",
    maxStoryboardProviderCalls: 1,
    maxMediaProviderCalls: 0,
    upstreamReplay: "forbidden",
    providerRetry: "forbidden",
    fallback: "forbidden",
    storyboardRetryRoute: false,
  },
  humanAuthRequired:
    estimatedCostMinor != null
      ? `PHASE_10F_SMOKE_CONFIRM=ONE_STORYBOARD_CALL_MAX_${proposedCeilingMinor}_CENTS`
      : "PHASE_10F_SMOKE_CONFIRM=BLOCKED_UNTIL_PRICING_CONFIGURED",
  bodyPrinted: false,
};

if (dry.providerCalled !== false) {
  fail("Invariant broken: providerCalled must be false");
}
if (dry.promptVersion !== EXPECTED_PROMPT) {
  fail(`promptVersion must be ${EXPECTED_PROMPT}`);
}
if (estimatedCostMinor == null || estimatedCostMinor !== report.budget.reservationPlannedMinor) {
  fail("reservation must equal estimate");
}

const evidenceDir = resolve(studioRoot, ".tmp");
mkdirSync(evidenceDir, { recursive: true });
const outPath = resolve(
  evidenceDir,
  `phase-10f-prep-storyboard-dry-run-${Date.now()}.json`
);
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ ...report, evidencePath: outPath }, null, 2));
process.exit(
  dry.providerCalled === false &&
    estimatedCostMinor != null &&
    dry.pricingConfigured &&
    dry.executable
    ? 0
    : 2
);

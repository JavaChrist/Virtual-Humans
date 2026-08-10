/**
 * Phase 10D-PREP — Script dry-run against Production Brief + MarketingPlan + CreativeConcept.
 * Guaranteed: NO OpenAI call. NO remote writes. NO Vercel writes.
 *
 * Requires:
 *   CONFIRM_PHASE_10D_PREP=1
 *   CONFIRM_PHASE_10D_REMOTE_READ=1
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

if (process.env.CONFIRM_PHASE_10D_PREP !== "1") {
  console.error("Refused: set CONFIRM_PHASE_10D_PREP=1");
  process.exit(2);
}
if (process.env.CONFIRM_PHASE_10D_REMOTE_READ !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10D_REMOTE_READ=1 (Production artifact read)."
  );
  process.exit(2);
}
if (process.env.PHASE_10D_ALLOW_EXECUTE === "1") {
  console.error(
    "Refused: PHASE_10D_ALLOW_EXECUTE is forbidden during PREP (no real Script call)."
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

const DEFAULT_CEILING_MINOR = 100;

/** Canonical Production price book (Porte 7H-B / 10B / 10C). */
const PRODUCTION_CANONICAL_PRICE = {
  version: "manual-2026-08-porte7-sol",
  inputPerMillionMinor: "500",
  outputPerMillionMinor: "3000",
  source: "porte-7hb-canonical+10b-10c-crosscheck",
};

function fail(msg, code = 1) {
  console.error(`PREP_10D FAIL: ${msg}`);
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
  const tmp = resolve(studioRoot, ".env.vercel.10d.prep.tmp");
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
const { SPEECH_TIMING_ENGINE_VERSION } = await import(
  "../src/domain/script/index.ts"
);
const { runOpenAIScriptDryRun } = await import(
  "../src/infrastructure/ai/openai/script/dry-run.ts"
);
const { createEnvAiTokenPricing } = await import(
  "../src/infrastructure/ai/openai/marketing/pricing.ts"
);
const { parseOpenAIScriptConfig } = await import(
  "../src/infrastructure/ai/openai/config.ts"
);
const { SCRIPT_ANALYZER_PROMPT_VERSION, SCRIPT_CANDIDATE_SCHEMA_VERSION } =
  await import("../src/infrastructure/ai/openai/script/index.ts");

const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: planArt, error: planErr } = await db
  .from("project_artifacts")
  .select("id,project_id,revision,value,correlation_id,schema_version")
  .eq("id", MARKETING_ARTIFACT_ID)
  .maybeSingle();
if (planErr) fail(planErr.message);
if (!planArt || planArt.project_id !== PROJECT_ID) {
  fail("MarketingPlan introuvable / project mismatch");
}

const { data: conceptArt, error: conceptErr } = await db
  .from("project_artifacts")
  .select("id,project_id,revision,value,correlation_id,schema_version")
  .eq("id", CREATIVE_ARTIFACT_ID)
  .maybeSingle();
if (conceptErr) fail(conceptErr.message);
if (!conceptArt || conceptArt.project_id !== PROJECT_ID) {
  fail("CreativeConcept introuvable / project mismatch");
}

const { data: activeBrief, error: briefPtrErr } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "video_project_brief")
  .maybeSingle();
if (briefPtrErr) fail(briefPtrErr.message);
if (!activeBrief) fail("Brief actif manquant");

const { data: briefArt, error: briefErr } = await db
  .from("project_artifacts")
  .select("id,project_id,revision,value,correlation_id,schema_version")
  .eq("id", activeBrief.artifact_id)
  .maybeSingle();
if (briefErr) fail(briefErr.message);
if (!briefArt) fail("Brief artifact introuvable");

const { data: activeScript } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "video_script")
  .maybeSingle();
if (activeScript) fail("VideoScript actif déjà présent — 10D-PREP refuse de continuer");

const briefParsed = VideoProjectBriefSchema.safeParse(briefArt.value);
const planParsed = MarketingPlanSchema.safeParse(planArt.value);
const conceptParsed = CreativeConceptSchema.safeParse(conceptArt.value);
if (!briefParsed.success || !planParsed.success || !conceptParsed.success) {
  fail("Zod brief/plan/concept invalide — dry-run aborté");
}

const priceFromPull = {
  version: envOrUndef(vercel.OPENAI_MARKETING_PRICE_VERSION),
  input: envOrUndef(vercel.OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(vercel.OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceFromOverride = {
  version: envOrUndef(process.env.PHASE_10D_PRICE_VERSION),
  input: envOrUndef(process.env.PHASE_10D_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(process.env.PHASE_10D_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceSource =
  priceFromPull.version && priceFromPull.input && priceFromPull.output
    ? "vercel-env-pull"
    : priceFromOverride.version &&
        priceFromOverride.input &&
        priceFromOverride.output
      ? "phase-10d-env-override"
      : "production-canonical-documented";
const resolvedPrice =
  priceSource === "vercel-env-pull"
    ? priceFromPull
    : priceSource === "phase-10d-env-override"
      ? priceFromOverride
      : {
          version: PRODUCTION_CANONICAL_PRICE.version,
          input: PRODUCTION_CANONICAL_PRICE.inputPerMillionMinor,
          output: PRODUCTION_CANONICAL_PRICE.outputPerMillionMinor,
        };

const scriptFromPull = {
  model: envOrUndef(vercel.OPENAI_SCRIPT_MODEL),
  effort: envOrUndef(vercel.OPENAI_SCRIPT_REASONING_EFFORT),
  maxOut: envOrUndef(vercel.OPENAI_SCRIPT_MAX_OUTPUT_TOKENS),
};
const scriptKnobSource =
  scriptFromPull.model || scriptFromPull.effort || scriptFromPull.maxOut
    ? "vercel-env-pull-partial-or-full"
    : "code-defaults";

const pricingEnv = {
  OPENAI_API_KEY:
    envOrUndef(vercel.OPENAI_API_KEY) ||
    envOrUndef(process.env.OPENAI_API_KEY) ||
    "sk-present-production-encrypted",
  OPENAI_SCRIPT_MODEL: scriptFromPull.model,
  OPENAI_SCRIPT_REASONING_EFFORT: scriptFromPull.effort,
  OPENAI_SCRIPT_MAX_OUTPUT_TOKENS: scriptFromPull.maxOut,
  OPENAI_SCRIPT_REQUIRE_PRICING:
    envOrUndef(vercel.OPENAI_SCRIPT_REQUIRE_PRICING) || "1",
  OPENAI_MARKETING_PRICE_VERSION: resolvedPrice.version,
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: resolvedPrice.input,
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: resolvedPrice.output,
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
};

const config = parseOpenAIScriptConfig(pricingEnv);
const pricing = createEnvAiTokenPricing(pricingEnv);
const book = pricing.getPriceBook(config.model);

const dry = runOpenAIScriptDryRun(
  briefParsed.data,
  planParsed.data,
  conceptParsed.data,
  { env: pricingEnv, config, pricing }
);

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

const idemRaw = [
  PROJECT_ID,
  briefArt.id,
  String(briefArt.revision),
  planArt.id,
  String(planArt.revision),
  conceptArt.id,
  String(conceptArt.revision),
  dry.model,
  SCRIPT_ANALYZER_PROMPT_VERSION,
  SCRIPT_CANDIDATE_SCHEMA_VERSION,
  SPEECH_TIMING_ENGINE_VERSION,
].join(":");

const report = {
  phase: "10D-PREP",
  mode: "dry-run-only",
  providerCalled: dry.providerCalled,
  networkProviderCall: false,
  remoteWrites: false,
  vercelEnvWrites: false,
  remoteHost: redactUrl(remote.SUPABASE_URL),
  projectId: PROJECT_ID,
  brief: {
    artifactId: briefArt.id,
    revision: briefArt.revision,
    valueSha256Prefix: hashPrefix(briefArt.value),
    durationSeconds: briefParsed.data.durationSeconds,
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
  existingVideoScript: null,
  scriptConfig: {
    model: dry.model,
    maxOutputTokens: dry.maxOutputTokens,
    promptVersion: dry.promptVersion,
    schemaVersion: dry.schemaVersion,
    timingEngineVersion: SPEECH_TIMING_ENGINE_VERSION,
    pricingConfigured: dry.pricingConfigured,
    priceSource,
    scriptKnobSource,
    priceVersion: resolvedPrice.version,
    inputPerMillionMinor: book?.inputPerMillionMinor ?? null,
    outputPerMillionMinor: book?.outputPerMillionMinor ?? null,
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
    keyPreview: idemRaw.length <= 200 ? idemRaw : "(sha256)",
    keyLength: idemRaw.length,
    components:
      "projectId+brief+plan+concept+model+prompt+schema+timingEngine",
  },
  guards: {
    marketingAiFlagSimulated: "0",
    creativeAiFlagSimulated: "0",
    scriptAiFlagSimulated: "1",
    artStoryboardFlagsSimulated: "0",
    workerFlagSimulated: "0",
    paidGenerationFlagSimulated: "0",
    maxScriptProviderCalls: 1,
    maxMediaProviderCalls: 0,
    marketingReplay: "forbidden",
    creativeReplay: "forbidden",
    providerRetry: "forbidden",
  },
  humanAuthRequired:
    estimatedCostMinor != null
      ? `PHASE_10D_SMOKE_CONFIRM=ONE_SCRIPT_CALL_MAX_${proposedCeilingMinor}_CENTS`
      : "PHASE_10D_SMOKE_CONFIRM=BLOCKED_UNTIL_PRICING_CONFIGURED",
  bodyPrinted: false,
};

if (dry.providerCalled !== false) {
  fail("Invariant broken: providerCalled must be false");
}

const evidenceDir = resolve(studioRoot, ".tmp");
mkdirSync(evidenceDir, { recursive: true });
const outPath = resolve(
  evidenceDir,
  `phase-10d-prep-script-dry-run-${Date.now()}.json`
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

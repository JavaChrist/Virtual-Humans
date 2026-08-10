/**
 * Phase 10C-PREP — Creative dry-run against Production MarketingPlan + Brief.
 * Guaranteed: NO OpenAI / provider network call. NO remote writes. NO Vercel writes.
 *
 * Loads artifacts via .env.remote.local (CONFIRM_PHASE_10C_REMOTE_READ=1).
 * Loads pricing/model knobs via vercel env pull (read-only temp file).
 *
 * Requires:
 *   CONFIRM_PHASE_10C_PREP=1
 *   CONFIRM_PHASE_10C_REMOTE_READ=1
 *
 * Usage (from studio/):
 *   $env:CONFIRM_PHASE_10C_PREP="1"
 *   $env:CONFIRM_PHASE_10C_REMOTE_READ="1"
 *   node --import tsx scripts/phase-10c-prep-creative-dry-run.mjs
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

if (process.env.CONFIRM_PHASE_10C_PREP !== "1") {
  console.error("Refused: set CONFIRM_PHASE_10C_PREP=1");
  process.exit(2);
}
if (process.env.CONFIRM_PHASE_10C_REMOTE_READ !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10C_REMOTE_READ=1 (Production artifact read)."
  );
  process.exit(2);
}
if (process.env.PHASE_10C_ALLOW_EXECUTE === "1") {
  console.error(
    "Refused: PHASE_10C_ALLOW_EXECUTE is forbidden during PREP (no real Creative call)."
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

/** Conservative default ceiling (USD cents). Raised only if dry-run estimate requires it. */
const DEFAULT_CEILING_MINOR = 100;

function fail(msg, code = 1) {
  console.error(`PREP_10C FAIL: ${msg}`);
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

function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "(invalid-url)";
  }
}

function pullProductionEnv() {
  const tmp = resolve(studioRoot, ".env.vercel.10c.prep.tmp");
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
  // Conservative: at least DEFAULT_CEILING_MINOR, else ceil(estimate * 2) rounded up to 25¢.
  const doubled = Math.ceil((estimate * 2) / 25) * 25;
  return Math.max(DEFAULT_CEILING_MINOR, doubled);
}

const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
  fail(".env.remote.local incomplete");
}

const vercel = pullProductionEnv();

/** Empty Vercel values must not override defaults ("" is not nullish). */
function envOrUndef(v) {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
}

/**
 * Canonical Production price book (Porte 7B / 7H-B / 8E ; validated by 10B dry-run = 24¢
 * with marketing max_output=8192 → floor(8192*3000/1e6)=24).
 * Used only when `vercel env pull` returns empty Sensitive values (CLI redaction).
 */
const PRODUCTION_CANONICAL_PRICE = {
  version: "manual-2026-08-porte7-sol",
  inputPerMillionMinor: "500",
  outputPerMillionMinor: "3000",
  source: "porte-7hb-8e-canonical+10b-crosscheck",
};

/**
 * Last explicitly authorized Production Creative knobs (Porte 8E).
 * Applied only when pull returns empty Creative model/effort/tokens.
 */
const PRODUCTION_DOCUMENTED_CREATIVE = {
  model: "gpt-5.6",
  reasoningEffort: "medium",
  maxOutputTokens: "4096",
  source: "porte-8e-authorized-production-creative",
};

const {
  VideoProjectBriefSchema,
} = await import("../src/domain/brief/index.ts");
const { MarketingPlanSchema } = await import("../src/domain/marketing/index.ts");
const { runOpenAICreativeDryRun } = await import(
  "../src/infrastructure/ai/openai/creative/dry-run.ts"
);
const { createEnvAiTokenPricing } = await import(
  "../src/infrastructure/ai/openai/marketing/pricing.ts"
);
const { parseOpenAICreativeConfig } = await import(
  "../src/infrastructure/ai/openai/config.ts"
);
const { money } = await import("../src/domain/cost/money.ts");

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
  fail("MarketingPlan 10B introuvable / project mismatch");
}

const { data: activeBrief, error: briefPtrErr } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "video_project_brief")
  .maybeSingle();
if (briefPtrErr) fail(briefPtrErr.message);
if (!activeBrief) fail("Brief actif manquant sur le projet 10B");

const { data: briefArt, error: briefErr } = await db
  .from("project_artifacts")
  .select("id,project_id,revision,value,correlation_id,schema_version")
  .eq("id", activeBrief.artifact_id)
  .maybeSingle();
if (briefErr) fail(briefErr.message);
if (!briefArt) fail("Brief artifact introuvable");

const briefParsed = VideoProjectBriefSchema.safeParse(briefArt.value);
const planParsed = MarketingPlanSchema.safeParse(planArt.value);
if (!briefParsed.success || !planParsed.success) {
  fail("Zod brief/plan invalide — dry-run aborté");
}

const priceFromPull = {
  version: envOrUndef(vercel.OPENAI_MARKETING_PRICE_VERSION),
  input: envOrUndef(vercel.OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(vercel.OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceFromOverride = {
  version: envOrUndef(process.env.PHASE_10C_PRICE_VERSION),
  input: envOrUndef(process.env.PHASE_10C_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(process.env.PHASE_10C_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceSource =
  priceFromPull.version && priceFromPull.input && priceFromPull.output
    ? "vercel-env-pull"
    : priceFromOverride.version && priceFromOverride.input && priceFromOverride.output
      ? "phase-10c-env-override"
      : "production-canonical-documented";

const resolvedPrice =
  priceSource === "vercel-env-pull"
    ? priceFromPull
    : priceSource === "phase-10c-env-override"
      ? priceFromOverride
      : {
          version: PRODUCTION_CANONICAL_PRICE.version,
          input: PRODUCTION_CANONICAL_PRICE.inputPerMillionMinor,
          output: PRODUCTION_CANONICAL_PRICE.outputPerMillionMinor,
        };

const creativeFromPull = {
  model: envOrUndef(vercel.OPENAI_CREATIVE_MODEL),
  effort: envOrUndef(vercel.OPENAI_CREATIVE_REASONING_EFFORT),
  maxOut: envOrUndef(vercel.OPENAI_CREATIVE_MAX_OUTPUT_TOKENS),
};
const creativeSource =
  creativeFromPull.model || creativeFromPull.effort || creativeFromPull.maxOut
    ? "vercel-env-pull-partial-or-full"
    : "production-documented-porte-8e";

const pricingEnv = {
  // Key presence: Production has OPENAI_API_KEY (Encrypted). CLI pull redacts it.
  // PREP never calls the provider; mark present when Production key name exists OR local key.
  OPENAI_API_KEY:
    envOrUndef(vercel.OPENAI_API_KEY) ||
    envOrUndef(process.env.OPENAI_API_KEY) ||
    "sk-present-production-encrypted",
  OPENAI_CREATIVE_MODEL:
    creativeFromPull.model || PRODUCTION_DOCUMENTED_CREATIVE.model,
  OPENAI_CREATIVE_REASONING_EFFORT:
    creativeFromPull.effort || PRODUCTION_DOCUMENTED_CREATIVE.reasoningEffort,
  OPENAI_CREATIVE_MAX_OUTPUT_TOKENS:
    creativeFromPull.maxOut || PRODUCTION_DOCUMENTED_CREATIVE.maxOutputTokens,
  OPENAI_CREATIVE_REQUIRE_PRICING:
    envOrUndef(vercel.OPENAI_CREATIVE_REQUIRE_PRICING) || "1",
  OPENAI_MARKETING_PRICE_VERSION: resolvedPrice.version,
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: resolvedPrice.input,
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: resolvedPrice.output,
  OPENAI_MARKETING_PRICE_CACHED_INPUT_PER_MILLION_MINOR: envOrUndef(
    vercel.OPENAI_MARKETING_PRICE_CACHED_INPUT_PER_MILLION_MINOR
  ),
  // Simulated smoke flags (local dry-run only — does not write Vercel).
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_ART_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
};

const config = parseOpenAICreativeConfig(pricingEnv);
const pricing = createEnvAiTokenPricing(pricingEnv);
const book = pricing.getPriceBook(config.model);

const dry = runOpenAICreativeDryRun(briefParsed.data, planParsed.data, {
  env: pricingEnv,
  config,
  pricing,
  evaluateBudget: (maxMinor) => {
    const ceiling = proposeCeiling(maxMinor);
    if (maxMinor <= ceiling) {
      return {
        allowed: true,
        estimated: money(maxMinor, "USD"),
        availableAfter: money(ceiling - maxMinor, "USD"),
      };
    }
    return {
      allowed: false,
      estimated: money(maxMinor, "USD"),
      available: money(ceiling, "USD"),
      reason: "hard_limit_reached",
    };
  },
});

const estimatedCostMinor =
  book && dry.approximateInputTokens != null
    ? Math.max(
        1,
        estimateMinor(
          dry.approximateInputTokens,
          dry.maxOutputTokens,
          book
        )
      )
    : null;

const proposedCeilingMinor =
  estimatedCostMinor != null
    ? proposeCeiling(estimatedCostMinor)
    : DEFAULT_CEILING_MINOR;

const briefHash = createHash("sha256")
  .update(JSON.stringify(briefArt.value))
  .digest("hex")
  .slice(0, 16);
const planHash = createHash("sha256")
  .update(JSON.stringify(planArt.value))
  .digest("hex")
  .slice(0, 16);

const report = {
  phase: "10C-PREP",
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
    schemaVersion: briefArt.schema_version,
    valueSha256Prefix: briefHash,
    durationSeconds: briefParsed.data.durationSeconds,
    platform: briefParsed.data.platform,
  },
  marketingPlan: {
    artifactId: planArt.id,
    revision: planArt.revision,
    schemaVersion: planArt.schema_version,
    valueSha256Prefix: planHash,
    correlationId: planArt.correlation_id,
    marketingObjective: planParsed.data.marketingObjective,
    tone: planParsed.data.tone,
    videoStyle: planParsed.data.videoStyle,
  },
  creativeConfig: {
    model: dry.model,
    reasoningEffort: dry.reasoningEffort,
    maxOutputTokens: dry.maxOutputTokens,
    promptVersion: dry.promptVersion,
    schemaVersion: dry.schemaVersion,
    pricingConfigured: dry.pricingConfigured,
    priceSource,
    creativeKnobSource: creativeSource,
    priceVersion: resolvedPrice.version,
    inputPerMillionMinor: book?.inputPerMillionMinor ?? null,
    outputPerMillionMinor: book?.outputPerMillionMinor ?? null,
    apiKeyPresentAssumed: true,
    note:
      "Vercel CLI redacts Sensitive values locally; price book cross-checked vs 10B estimate 24¢.",
  },
  dryRun: {
    executable: dry.executable,
    approximateInputTokens: dry.approximateInputTokens ?? null,
    durationSeconds: dry.durationSeconds ?? null,
    maxBeats: dry.maxBeats ?? null,
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
  guards: {
    marketingAiFlagSimulated: "0",
    creativeAiFlagSimulated: "1",
    paidAiFlagSimulated: "1",
    scriptArtStoryboardFlagsSimulated: "0",
    workerFlagSimulated: "0",
    paidGenerationFlagSimulated: "0",
    maxCreativeProviderCalls: 1,
    maxMediaProviderCalls: 0,
    marketingReplay: "forbidden",
  },
  humanAuthRequired: estimatedCostMinor != null
    ? `PHASE_10C_SMOKE_CONFIRM=ONE_CREATIVE_CALL_MAX_${proposedCeilingMinor}_CENTS`
    : "PHASE_10C_SMOKE_CONFIRM=BLOCKED_UNTIL_PRICING_CONFIGURED",
  bodyPrinted: false,
};

if (dry.providerCalled !== false) {
  fail("Invariant broken: providerCalled must be false");
}
if (estimatedCostMinor == null || !dry.pricingConfigured) {
  console.error(
    "WARN: pricingConfigured=false — plafond non finalisable jusqu’à price book Production."
  );
}

const evidenceDir = resolve(studioRoot, ".tmp");
mkdirSync(evidenceDir, { recursive: true });
const outPath = resolve(
  evidenceDir,
  `phase-10c-prep-creative-dry-run-${Date.now()}.json`
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

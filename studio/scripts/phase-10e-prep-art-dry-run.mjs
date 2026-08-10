/**
 * Phase 10E-PREP — Art text dry-run against Production Brief + Marketing + Creative + Script.
 * Guaranteed: NO OpenAI call. NO remote writes. NO Vercel writes. NO media.
 *
 * Requires:
 *   CONFIRM_PHASE_10E_PREP=1
 *   CONFIRM_PHASE_10E_REMOTE_READ=1
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

if (process.env.CONFIRM_PHASE_10E_PREP !== "1") {
  console.error("Refused: set CONFIRM_PHASE_10E_PREP=1");
  process.exit(2);
}
if (process.env.CONFIRM_PHASE_10E_REMOTE_READ !== "1") {
  console.error(
    "Refused: set CONFIRM_PHASE_10E_REMOTE_READ=1 (Production artifact read)."
  );
  process.exit(2);
}
if (process.env.PHASE_10E_ALLOW_EXECUTE === "1") {
  console.error(
    "Refused: PHASE_10E_ALLOW_EXECUTE is forbidden during PREP (no real Art call)."
  );
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");
const PROJECT_ID =
  process.env.PHASE_10E_PROJECT_ID || "984507af-a89e-4644-8ea3-344797baa974";
const MARKETING_ARTIFACT_ID =
  process.env.PHASE_10E_MARKETING_ARTIFACT_ID ||
  "199284d6-7126-4383-b85f-1ecd74d9528e";
const CREATIVE_ARTIFACT_ID =
  process.env.PHASE_10E_CREATIVE_ARTIFACT_ID ||
  "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a";
const SCRIPT_ARTIFACT_ID =
  process.env.PHASE_10E_SCRIPT_ARTIFACT_ID ||
  "349e2792-3235-4c00-a1da-9e087b0b4d1c";

const DEFAULT_CEILING_MINOR = 100;

/** Canonical Production price book (Porte 7H-B / 10B–10D). */
const PRODUCTION_CANONICAL_PRICE = {
  version: "manual-2026-08-porte7-sol",
  inputPerMillionMinor: "500",
  outputPerMillionMinor: "3000",
  source: "porte-7hb-canonical+10b-10c-10d-crosscheck",
};

/**
 * Candidate Production Art knobs when `vercel env pull` redacts Sensitive values.
 * NOT live-observed for Art (runtime OFF / PREP forbids opening flags).
 * Pattern aligned with Production text directors 10B–10D (gpt-5.6 / medium / 4096).
 * First live dry-run after flag open MUST confirm before execute.
 */
const PRODUCTION_DOCUMENTED_ART = {
  model: "gpt-5.6",
  reasoningEffort: "medium",
  maxOutputTokens: "4096",
  source: "production-text-director-pattern-10b-10c-10d",
  confidence: "unconfirmed_pending_live_dry_run",
};

const CODE_DEFAULT_ART = {
  model: "gpt-5.6-terra",
  reasoningEffort: "low",
  maxOutputTokens: "2800",
  source: "code-defaults-config.ts",
};

function fail(msg, code = 1) {
  console.error(`PREP_10E FAIL: ${msg}`);
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
  const tmp = resolve(studioRoot, ".env.vercel.10e.prep.tmp");
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
const { runOpenAIArtDryRun } = await import(
  "../src/infrastructure/ai/openai/art/dry-run.ts"
);
const { createEnvAiTokenPricing } = await import(
  "../src/infrastructure/ai/openai/marketing/pricing.ts"
);
const { parseOpenAIArtConfig } = await import(
  "../src/infrastructure/ai/openai/config.ts"
);
const { ART_ANALYZER_PROMPT_VERSION, ART_CANDIDATE_SCHEMA_VERSION } =
  await import("../src/infrastructure/ai/openai/art/index.ts");
const { resolveCharacterCapabilitiesForBrief } = await import(
  "../src/application/runtime/resolve-character-capabilities.ts"
);
const {
  canExecuteMarketingAi,
  canExecuteCreativeAi,
  canExecuteScriptAi,
  canExecuteStoryboardAi,
  canExecutePaidGeneration,
  isDirectorV2WorkerEnabled,
  isDirectorV2PaidGenerationEnabled,
} = await import("../src/infrastructure/config/feature-flags.ts");

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

const { data: scriptArt, error: scriptErr } = await db
  .from("project_artifacts")
  .select("id,project_id,revision,value,correlation_id,schema_version")
  .eq("id", SCRIPT_ARTIFACT_ID)
  .maybeSingle();
if (scriptErr) fail(scriptErr.message);
if (!scriptArt || scriptArt.project_id !== PROJECT_ID) {
  fail("VideoScript introuvable / project mismatch");
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

const { data: activeArt } = await db
  .from("active_artifact_revisions")
  .select("artifact_id,revision")
  .eq("project_id", PROJECT_ID)
  .eq("artifact_type", "visual_direction")
  .maybeSingle();
if (activeArt) fail("visual_direction actif déjà présent — 10E-PREP refuse de continuer");

const briefParsed = VideoProjectBriefSchema.safeParse(briefArt.value);
const planParsed = MarketingPlanSchema.safeParse(planArt.value);
const conceptParsed = CreativeConceptSchema.safeParse(conceptArt.value);
const scriptParsed = VideoScriptSchema.safeParse(scriptArt.value);
if (
  !briefParsed.success ||
  !planParsed.success ||
  !conceptParsed.success ||
  !scriptParsed.success
) {
  fail("Zod brief/plan/concept/script invalide — dry-run aborté");
}

const characterResolved = resolveCharacterCapabilitiesForBrief(briefParsed.data);
let characterSnapshot = undefined;
let characterReport = {
  briefCharacterId: briefParsed.data.characterId ?? null,
  status: characterResolved.status,
  snapshotCharacterId: null,
  snapshotVersion: null,
  outfitCount: 0,
  expressionCount: 0,
  poseCount: 0,
  referenceCount: 0,
  identityFingerprintPrefix: null,
  criticalAssetsOk: true,
};
if (characterResolved.status === "resolved") {
  characterSnapshot = characterResolved.value.snapshot;
  characterReport = {
    briefCharacterId: briefParsed.data.characterId ?? null,
    status: "resolved",
    snapshotCharacterId: characterSnapshot.characterId,
    snapshotVersion: characterSnapshot.snapshotVersion,
    outfitCount: characterSnapshot.availableOutfits.length,
    expressionCount: characterSnapshot.availableExpressions.length,
    poseCount: characterSnapshot.availablePoses.length,
    referenceCount: characterSnapshot.availableReferences.length,
    identityFingerprintPrefix:
      characterResolved.value.identityFingerprint.slice(0, 12),
    criticalAssetsOk: characterSnapshot.availableOutfits.length > 0,
  };
} else if (characterResolved.status === "none") {
  characterReport.criticalAssetsOk = true;
} else {
  characterReport.criticalAssetsOk = false;
}

const priceFromPull = {
  version: envOrUndef(vercel.OPENAI_MARKETING_PRICE_VERSION),
  input: envOrUndef(vercel.OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(vercel.OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceFromOverride = {
  version: envOrUndef(process.env.PHASE_10E_PRICE_VERSION),
  input: envOrUndef(process.env.PHASE_10E_PRICE_INPUT_PER_MILLION_MINOR),
  output: envOrUndef(process.env.PHASE_10E_PRICE_OUTPUT_PER_MILLION_MINOR),
};
const priceSource =
  priceFromPull.version && priceFromPull.input && priceFromPull.output
    ? "vercel-env-pull"
    : priceFromOverride.version &&
        priceFromOverride.input &&
        priceFromOverride.output
      ? "phase-10e-env-override"
      : "production-canonical-documented";
const resolvedPrice =
  priceSource === "vercel-env-pull"
    ? priceFromPull
    : priceSource === "phase-10e-env-override"
      ? priceFromOverride
      : {
          version: PRODUCTION_CANONICAL_PRICE.version,
          input: PRODUCTION_CANONICAL_PRICE.inputPerMillionMinor,
          output: PRODUCTION_CANONICAL_PRICE.outputPerMillionMinor,
        };

const artFromPull = {
  model: envOrUndef(vercel.OPENAI_ART_MODEL),
  effort: envOrUndef(vercel.OPENAI_ART_REASONING_EFFORT),
  maxOut: envOrUndef(vercel.OPENAI_ART_MAX_OUTPUT_TOKENS),
};
const artFromOverride = {
  model: envOrUndef(process.env.PHASE_10E_ART_MODEL),
  effort: envOrUndef(process.env.PHASE_10E_ART_REASONING_EFFORT),
  maxOut: envOrUndef(process.env.PHASE_10E_ART_MAX_OUTPUT_TOKENS),
};

let artKnobSource;
let artConfidence;
let resolvedArt;
if (artFromPull.model || artFromPull.effort || artFromPull.maxOut) {
  artKnobSource = "vercel-env-pull-partial-or-full";
  artConfidence = "pull-partial-or-full";
  resolvedArt = {
    model: artFromPull.model || PRODUCTION_DOCUMENTED_ART.model,
    effort: artFromPull.effort || PRODUCTION_DOCUMENTED_ART.reasoningEffort,
    maxOut: artFromPull.maxOut || PRODUCTION_DOCUMENTED_ART.maxOutputTokens,
  };
} else if (artFromOverride.model || artFromOverride.effort || artFromOverride.maxOut) {
  artKnobSource = "phase-10e-env-override";
  artConfidence = "explicit-override";
  resolvedArt = {
    model: artFromOverride.model || PRODUCTION_DOCUMENTED_ART.model,
    effort: artFromOverride.effort || PRODUCTION_DOCUMENTED_ART.reasoningEffort,
    maxOut: artFromOverride.maxOut || PRODUCTION_DOCUMENTED_ART.maxOutputTokens,
  };
} else {
  artKnobSource = "production-documented-pattern-unconfirmed";
  artConfidence = PRODUCTION_DOCUMENTED_ART.confidence;
  resolvedArt = {
    model: PRODUCTION_DOCUMENTED_ART.model,
    effort: PRODUCTION_DOCUMENTED_ART.reasoningEffort,
    maxOut: PRODUCTION_DOCUMENTED_ART.maxOutputTokens,
  };
}

const pricingEnv = {
  OPENAI_API_KEY:
    envOrUndef(vercel.OPENAI_API_KEY) ||
    envOrUndef(process.env.OPENAI_API_KEY) ||
    "sk-present-production-encrypted",
  OPENAI_ART_MODEL: resolvedArt.model,
  OPENAI_ART_REASONING_EFFORT: resolvedArt.effort,
  OPENAI_ART_MAX_OUTPUT_TOKENS: resolvedArt.maxOut,
  OPENAI_ART_REQUIRE_PRICING:
    envOrUndef(vercel.OPENAI_ART_REQUIRE_PRICING) || "1",
  OPENAI_MARKETING_PRICE_VERSION: resolvedPrice.version,
  OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR: resolvedPrice.input,
  OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR: resolvedPrice.output,
  DIRECTOR_V2_ART_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  DIRECTOR_V2_MARKETING_AI_ENABLED: "0",
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "0",
  DIRECTOR_V2_SCRIPT_AI_ENABLED: "0",
  DIRECTOR_V2_STORYBOARD_AI_ENABLED: "0",
  DIRECTOR_V2_WORKER_ENABLED: "0",
  DIRECTOR_V2_PAID_GENERATION_ENABLED: "0",
};

if (
  canExecuteMarketingAi(pricingEnv) ||
  canExecuteCreativeAi(pricingEnv) ||
  canExecuteScriptAi(pricingEnv) ||
  canExecuteStoryboardAi(pricingEnv) ||
  canExecutePaidGeneration(pricingEnv) ||
  isDirectorV2WorkerEnabled(pricingEnv) ||
  isDirectorV2PaidGenerationEnabled(pricingEnv)
) {
  fail("Smoke matrix invariant broken: non-Art path must stay OFF");
}

const config = parseOpenAIArtConfig(pricingEnv);
const pricing = createEnvAiTokenPricing(pricingEnv);
const book = pricing.getPriceBook(config.model);

const dryBrief =
  characterResolved.status === "resolved"
    ? characterResolved.value.brief
    : briefParsed.data;

const dry = runOpenAIArtDryRun(
  dryBrief,
  planParsed.data,
  conceptParsed.data,
  scriptParsed.data,
  characterSnapshot,
  { env: pricingEnv, config, pricing }
);

const estimatedCostMinor =
  book && dry.approximateInputTokens != null
    ? Math.max(
        1,
        estimateMinor(dry.approximateInputTokens, dry.maxOutputTokens, book)
      )
    : null;

/** Transparency: what code defaults would have estimated (not the canon). */
const codeDefaultEnv = {
  ...pricingEnv,
  OPENAI_ART_MODEL: CODE_DEFAULT_ART.model,
  OPENAI_ART_REASONING_EFFORT: CODE_DEFAULT_ART.reasoningEffort,
  OPENAI_ART_MAX_OUTPUT_TOKENS: CODE_DEFAULT_ART.maxOutputTokens,
};
const codeDefaultConfig = parseOpenAIArtConfig(codeDefaultEnv);
const codeDefaultDry = runOpenAIArtDryRun(
  dryBrief,
  planParsed.data,
  conceptParsed.data,
  scriptParsed.data,
  characterSnapshot,
  {
    env: codeDefaultEnv,
    config: codeDefaultConfig,
    pricing: createEnvAiTokenPricing(codeDefaultEnv),
  }
);
const codeDefaultEstimate =
  book && codeDefaultDry.approximateInputTokens != null
    ? Math.max(
        1,
        estimateMinor(
          codeDefaultDry.approximateInputTokens,
          codeDefaultDry.maxOutputTokens,
          book
        )
      )
    : null;

const proposedCeilingMinor =
  estimatedCostMinor != null
    ? proposeCeiling(estimatedCostMinor)
    : DEFAULT_CEILING_MINOR;

const fingerprintFields = [
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
  ART_ANALYZER_PROMPT_VERSION,
  ART_CANDIDATE_SCHEMA_VERSION,
];
if (
  characterResolved.status === "resolved" &&
  characterResolved.value.identityFingerprint
) {
  fingerprintFields.push(
    characterResolved.value.snapshot.characterId,
    characterResolved.value.snapshot.snapshotVersion,
    characterResolved.value.identityFingerprint
  );
}
const idemRaw = ["art", ...fingerprintFields].join(":");

const report = {
  phase: "10E-PREP",
  mode: "dry-run-only",
  providerCalled: dry.providerCalled,
  networkProviderCall: false,
  remoteWrites: false,
  vercelEnvWrites: false,
  mediaGeneration: false,
  remoteHost: redactUrl(remote.SUPABASE_URL),
  projectId: PROJECT_ID,
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
  },
  existingVisualDirection: null,
  character: characterReport,
  artConfig: {
    provider: "openai",
    model: dry.model,
    reasoningEffort: dry.reasoningEffort,
    maxOutputTokens: dry.maxOutputTokens,
    promptVersion: dry.promptVersion,
    schemaVersion: dry.schemaVersion,
    pricingConfigured: dry.pricingConfigured,
    priceSource,
    artKnobSource,
    artKnobConfidence: artConfidence,
    productionDocumentedSource: PRODUCTION_DOCUMENTED_ART.source,
    priceVersion: resolvedPrice.version,
    inputPerMillionMinor: book?.inputPerMillionMinor ?? null,
    outputPerMillionMinor: book?.outputPerMillionMinor ?? null,
    codeDefaults: CODE_DEFAULT_ART,
    codeDefaultEstimateMinor: codeDefaultEstimate,
    note:
      artConfidence === "unconfirmed_pending_live_dry_run"
        ? "Production OPENAI_ART_* Encrypted present but pull-redacted; pattern candidate used — confirm on first live dry-run before execute."
        : null,
  },
  dryRun: {
    executable: dry.executable,
    approximateInputTokens: dry.approximateInputTokens ?? null,
    validationsFailed: dry.validations
      .filter((v) => !v.passed)
      .map((v) => v.code),
    warningCodes: dry.warnings.map((w) => w.code),
    readinessMissing: dry.readinessMissing.map((m) => m.code),
  },
  budget: {
    estimatedCostMinor,
    reservationPlannedMinor: estimatedCostMinor,
    proposedCeilingMinor,
    currency: "USD",
    rule: "estimate <= plafond && reservation == estimate && maxArtTextCalls == 1 && mediaCalls == 0",
  },
  idempotency: {
    keyPreview: idemRaw.length <= 200 ? idemRaw : "(sha256)",
    keyLength: idemRaw.length,
    components:
      "art+projectId+brief+plan+concept+script+model+prompt+schema[+characterFingerprint]",
  },
  guards: {
    marketingAiFlagSimulated: "0",
    creativeAiFlagSimulated: "0",
    scriptAiFlagSimulated: "0",
    artAiFlagSimulated: "1",
    storyboardFlagSimulated: "0",
    workerFlagSimulated: "0",
    paidGenerationFlagSimulated: "0",
    maxArtTextProviderCalls: 1,
    maxMediaProviderCalls: 0,
    marketingReplay: "forbidden",
    creativeReplay: "forbidden",
    scriptReplay: "forbidden",
    storyboard: "forbidden",
    mediaGeneration: "forbidden",
    providerRetry: "forbidden",
    artHumanRetryRoute: "forbidden-during-10e-smoke",
  },
  humanAuthRequired:
    estimatedCostMinor != null &&
    dry.executable &&
    characterReport.criticalAssetsOk &&
    (characterResolved.status === "none" ||
      characterResolved.status === "resolved")
      ? `PHASE_10E_SMOKE_CONFIRM=ONE_ART_TEXT_CALL_MAX_${proposedCeilingMinor}_CENTS`
      : "PHASE_10E_SMOKE_CONFIRM=BLOCKED_UNTIL_READY",
  bodyPrinted: false,
};

if (dry.providerCalled !== false) {
  fail("Invariant broken: providerCalled must be false");
}
if (codeDefaultDry.providerCalled !== false) {
  fail("Invariant broken: code-default dry-run providerCalled must be false");
}

const evidenceDir = resolve(studioRoot, ".tmp");
mkdirSync(evidenceDir, { recursive: true });
const outPath = resolve(
  evidenceDir,
  `phase-10e-prep-art-dry-run-${Date.now()}.json`
);
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ ...report, evidencePath: outPath }, null, 2));

const ready =
  dry.executable === true &&
  dry.providerCalled === false &&
  dry.pricingConfigured === true &&
  estimatedCostMinor != null &&
  estimatedCostMinor <= proposedCeilingMinor &&
  characterReport.criticalAssetsOk &&
  (characterResolved.status === "none" ||
    characterResolved.status === "resolved");
process.exit(ready ? 0 : 2);

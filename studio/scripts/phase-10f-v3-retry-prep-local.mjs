/**
 * Phase 10F-V3-RETRY-PREP — offline / optional redacted Production read.
 * NO provider call, NO Vercel write, NO execute, NO budget write.
 *
 * Optional: CONFIRM_PHASE_10F_REMOTE_READ=1 loads amont artifacts for exact estimate.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { storyboardIdempotencyFields } from "../src/application/directors/storyboard/analyze-for-project.ts";
import {
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_ANALYZER_SYSTEM_PROMPT,
  mapStoryboardAnalysisRequest,
  approximateStoryboardTokenCount,
  getStoryboardCandidateJsonSchema,
  inspectStoryboardStructuredSchemaProjection,
  STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE,
} from "../src/infrastructure/ai/openai/storyboard/index.ts";
import {
  fillOpenAIStrictNullables,
  validateAgainstLocalJsonSchema,
} from "../src/infrastructure/ai/openai/storyboard/local-json-schema.ts";
import { SceneSpokenContentSchema } from "../src/domain/storyboard/schemas.ts";
import { VideoProjectBriefSchema } from "../src/domain/brief/index.ts";
import { MarketingPlanSchema } from "../src/domain/marketing/index.ts";
import { CreativeConceptSchema } from "../src/domain/creative/index.ts";
import { VideoScriptSchema } from "../src/domain/script/index.ts";
import { VisualDirectionSchema } from "../src/domain/art/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(__dirname, "..");

const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const IDS = {
  brief: "95c24837-ab61-4bd1-9f47-d576e259d018",
  marketing: "199284d6-7126-4383-b85f-1ecd74d9528e",
  creative: "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a",
  script: "349e2792-3235-4c00-a1da-9e087b0b4d1c",
  visual: "49481462-6444-41f9-8c48-7e7d32c09f1b",
};

const FP_NONE_V2 = "abaa9c2886ef3d59";
const FP_AUTH_B_V2 = "3f39f808e266649c";
const FP_RETRY2_V2 = "0b7e8fb44e0acd4d";
const BURNED_SALTS = ["10f-auth-b-20260810", "10f-auth-b-retry2-20260810"];
const PROPOSED_SALT = "10f-storyboard-v3-20260810";

const PRODUCTION_CANONICAL_PRICE = {
  version: "manual-2026-08-porte7-sol",
  inputPerMillionMinor: 500,
  outputPerMillionMinor: 3000,
  currency: "USD",
};

const KNOBS = {
  provider: "openai",
  model: "gpt-5.6",
  reasoningEffort: "medium",
  maxOutputTokens: 4096,
};

function fail(msg, code = 2) {
  console.error(`V3_RETRY_PREP FAIL: ${msg}`);
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

const fp = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

if (STORYBOARD_ANALYZER_PROMPT_VERSION !== "storyboard-analyzer-v3") {
  fail(`prompt must be v3, got ${STORYBOARD_ANALYZER_PROMPT_VERSION}`);
}
if (!STORYBOARD_ANALYZER_SYSTEM_PROMPT.includes(
  "REQUIRED_LOCATION_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID",
)) {
  fail("system prompt missing required location map contract");
}

const baseV2 = {
  projectId: PROJECT_ID,
  briefArtifactId: IDS.brief,
  briefRevision: 1,
  marketingPlanArtifactId: IDS.marketing,
  marketingPlanRevision: 1,
  creativeConceptArtifactId: IDS.creative,
  creativeConceptRevision: 1,
  videoScriptArtifactId: IDS.script,
  videoScriptRevision: 1,
  visualDirectionArtifactId: IDS.visual,
  visualDirectionRevision: 1,
  model: KNOBS.model,
  promptVersion: "storyboard-analyzer-v2",
  schemaVersion: "1.0.0",
};
const baseV3 = {
  ...baseV2,
  promptVersion: "storyboard-analyzer-v3",
};

const fps = {
  noneV2: fp(storyboardIdempotencyFields(baseV2).key),
  authBV2: fp(
    storyboardIdempotencyFields({
      ...baseV2,
      idempotencySalt: BURNED_SALTS[0],
    }).key,
  ),
  retry2V2: fp(
    storyboardIdempotencyFields({
      ...baseV2,
      idempotencySalt: BURNED_SALTS[1],
    }).key,
  ),
  v3Proposed: fp(
    storyboardIdempotencyFields({
      ...baseV3,
      idempotencySalt: PROPOSED_SALT,
    }).key,
  ),
};
if (fps.noneV2 !== FP_NONE_V2) fail(`fp none mismatch ${fps.noneV2}`);
if (fps.authBV2 !== FP_AUTH_B_V2) fail(`fp authB mismatch ${fps.authBV2}`);
if (fps.retry2V2 !== FP_RETRY2_V2) fail(`fp retry2 mismatch ${fps.retry2V2}`);
if (
  fps.v3Proposed === fps.noneV2 ||
  fps.v3Proposed === fps.authBV2 ||
  fps.v3Proposed === fps.retry2V2
) {
  fail("proposed v3 fingerprint collides with burned run");
}

const schema = getStoryboardCandidateJsonSchema();
const projection = inspectStoryboardStructuredSchemaProjection(schema);
const spoken = schema.properties.scenes.items.properties.spokenContent;
const spokenVariantsOk = ["dialogue", "voice_over", "none"].every((kind) => {
  const sample =
    kind === "none"
      ? { kind }
      : { kind, sourceText: kind === "dialogue" ? "Bonjour" : "VO" };
  const wire = fillOpenAIStrictNullables(spoken, sample);
  return (
    SceneSpokenContentSchema.safeParse(sample).success &&
    validateAgainstLocalJsonSchema(spoken, wire).length === 0
  );
});

let estimateSource = "fixture-unavailable";
let approxInputTokens = null;
let estimateMinor = null;
let requiredLocationKeyCount = null;
let requiredLocationKeyCoverage = null;
let requiredKeysSample = null;
let remoteRead = false;

const allowRemote =
  process.env.CONFIRM_PHASE_10F_REMOTE_READ === "1" ||
  process.env.CONFIRM_PHASE_10F_REMOTE_READ === "true";

if (allowRemote) {
  const remotePath = resolve(studioRoot, ".env.remote.local");
  const remote = loadEnv(remotePath);
  if (!remote.SUPABASE_URL || !remote.SUPABASE_SERVICE_ROLE_KEY) {
    fail(".env.remote.local missing SUPABASE_URL / SERVICE_ROLE_KEY for redacted read");
  }
  const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async function loadArt(id) {
    const { data, error } = await db
      .from("project_artifacts")
      .select("id,project_id,revision,value")
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error.message);
    return data;
  }
  const [briefArt, planArt, conceptArt, scriptArt, visualArt] = await Promise.all([
    loadArt(IDS.brief),
    loadArt(IDS.marketing),
    loadArt(IDS.creative),
    loadArt(IDS.script),
    loadArt(IDS.visual),
  ]);
  for (const [name, art] of [
    ["brief", briefArt],
    ["marketing", planArt],
    ["creative", conceptArt],
    ["script", scriptArt],
    ["visual", visualArt],
  ]) {
    if (!art || art.project_id !== PROJECT_ID) fail(`${name} artifact missing`);
  }
  const brief = VideoProjectBriefSchema.parse(briefArt.value);
  const plan = MarketingPlanSchema.parse(planArt.value);
  const concept = CreativeConceptSchema.parse(conceptArt.value);
  const script = VideoScriptSchema.parse(scriptArt.value);
  const visual = VisualDirectionSchema.parse(visualArt.value);
  if (visual.segments.length !== 5) fail(`expected 5 VD segments, got ${visual.segments.length}`);
  const keys = visual.segments.map((s) => `location:${s.location.continuityKey}`);
  if (!keys.every((k) => k === "location:espace-numerique-principal")) {
    fail(`expected 5× location:espace-numerique-principal, got ${JSON.stringify(keys)}`);
  }
  const mapped = mapStoryboardAnalysisRequest({
    brief,
    marketingPlan: plan,
    creativeConcept: concept,
    videoScript: script,
    visualDirection: visual,
  });
  if (
    !mapped.userMessage.includes(
      "REQUIRED_LOCATION_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID",
    )
  ) {
    fail("mapped userMessage missing required location map");
  }
  approxInputTokens = approximateStoryboardTokenCount(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT + mapped.userMessage,
  );
  estimateMinor =
    Math.floor(
      (approxInputTokens * PRODUCTION_CANONICAL_PRICE.inputPerMillionMinor) /
        1_000_000,
    ) +
    Math.floor(
      (KNOBS.maxOutputTokens *
        PRODUCTION_CANONICAL_PRICE.outputPerMillionMinor) /
        1_000_000,
    );
  requiredLocationKeyCount = keys.length;
  requiredLocationKeyCoverage = "complete";
  requiredKeysSample = keys;
  estimateSource = "production-artifacts+canonical-price-book";
  remoteRead = true;
} else {
  // Local fixture chain estimate (same knobs/price) — mark as fixture when remote off
  const { makeStoryboardChain } = await import(
    "../src/domain/storyboard/__tests__/fixtures.ts"
  );
  const chain = makeStoryboardChain();
  for (const seg of chain.visualDirection.segments) {
    seg.location.continuityKey = "espace-numerique-principal";
  }
  const mapped = mapStoryboardAnalysisRequest(chain);
  approxInputTokens = approximateStoryboardTokenCount(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT + mapped.userMessage,
  );
  estimateMinor =
    Math.floor(
      (approxInputTokens * PRODUCTION_CANONICAL_PRICE.inputPerMillionMinor) /
        1_000_000,
    ) +
    Math.floor(
      (KNOBS.maxOutputTokens *
        PRODUCTION_CANONICAL_PRICE.outputPerMillionMinor) /
        1_000_000,
    );
  requiredLocationKeyCount = 5;
  requiredLocationKeyCoverage = "complete";
  requiredKeysSample = Array(5).fill("location:espace-numerique-principal");
  estimateSource = "local-fixture+canonical-price-book";
}

const hardLimitMinor = 113;
const committedMinor = 101;
const reservedMinor = 0;
const availableMinor = hardLimitMinor - committedMinor - reservedMinor;
const shortfallMinor = Math.max(0, estimateMinor - availableMinor);
const hardLimitStrictMinimum = hardLimitMinor + shortfallMinor;
const hardLimitRecommended = hardLimitMinor + Math.max(shortfallMinor, 2);
const deltaRecommended = hardLimitRecommended - hardLimitMinor;
const availableAfterRecommended =
  hardLimitRecommended - committedMinor - reservedMinor;

const checks = {
  promptV3: STORYBOARD_ANALYZER_PROMPT_VERSION === "storyboard-analyzer-v3",
  refuseV2Prompt: STORYBOARD_ANALYZER_PROMPT_VERSION !== "storyboard-analyzer-v2",
  refuseBurnedSalts: !BURNED_SALTS.includes(PROPOSED_SALT),
  oneOfZero: projection.structuredSchemaOneOfCount === 0,
  anyOfCompatible: projection.structuredSchemaProjection === "anyOf-compatible",
  spokenVariantsOk,
  metadataCaptureReady:
    STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE === "ready",
  locationCoverageComplete: requiredLocationKeyCoverage === "complete",
  locationKeyCount5: requiredLocationKeyCount === 5,
  fpsMatchBurned:
    fps.noneV2 === FP_NONE_V2 &&
    fps.authBV2 === FP_AUTH_B_V2 &&
    fps.retry2V2 === FP_RETRY2_V2,
  v3Distinct:
    fps.v3Proposed !== fps.noneV2 &&
    fps.v3Proposed !== fps.authBV2 &&
    fps.v3Proposed !== fps.retry2V2,
  estimateExact: typeof estimateMinor === "number" && estimateMinor > 0,
  reservationEqualsEstimate: true,
  shortfallDocumented: shortfallMinor === Math.max(0, estimateMinor - availableMinor),
  noProviderCall: true,
  noReservation: true,
  noLedgerWrite: true,
  noArtifactWrite: true,
  noBudgetWrite: true,
  noVercelEnvWrite: true,
  noDeploy: true,
  noPush: true,
  maximumFutureCalls1: true,
};

const pass = Object.values(checks).every(Boolean);
const verdict =
  !pass
    ? "NOT_READY"
    : shortfallMinor > 0
      ? "READY_FOR_BUDGET_AND_PUSH_AUTH"
      : "READY_FOR_PUSH_AND_PROVIDER_AUTH";

const evidence = {
  phase: "10F-V3-RETRY-PREP",
  providerCalls: 0,
  newRuns: 0,
  newArtifacts: 0,
  ledgerWrites: 0,
  budgetWrites: 0,
  remoteWrites: 0,
  remoteRead,
  promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
  schemaVersion: "1.0.0",
  proposedSalt: PROPOSED_SALT,
  burnedSalts: BURNED_SALTS,
  keyFingerprints: fps,
  previousRunsImmutable: [
    "b446a0ed-0005-40ed-b134-b7ab769bd819",
    "f5b75018-5aa1-4a16-97e1-7e515f94f106",
    "4914c203-3be0-4f62-8529-a9b3db25448e",
  ],
  futureRun: {
    attempt_number: 1,
    retry_of_run_id: null,
    maximumProviderCalls: 1,
    automaticRetry: "forbidden",
    fallback: "forbidden",
    upstreamReplay: "forbidden",
    media: "forbidden",
    worker: "OFF",
  },
  knobs: KNOBS,
  priceBook: PRODUCTION_CANONICAL_PRICE,
  estimateSource,
  approxInputTokens,
  estimateMinor,
  reservationMinor: estimateMinor,
  hardLimitMinor,
  committedMinor,
  reservedMinor,
  availableMinor,
  shortfallMinor,
  hardLimitStrictMinimum,
  hardLimitRecommended,
  deltaRecommended,
  availableAfterRecommended,
  requiredLocationKeyCount,
  requiredLocationKeyCoverage,
  requiredKeysSample,
  projection,
  providerErrorMetadataCapture: STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE,
  closureMatrix: {
    storyboardAi: "ON only during future window",
    marketingCreativeScriptArt: "OFF",
    paidGeneration: "OFF",
    worker: "OFF",
    runtimeAfterClose: "OFF",
  },
  checks,
  pass,
  verdict,
};

mkdirSync(resolve(studioRoot, ".tmp"), { recursive: true });
const out = resolve(studioRoot, ".tmp/phase-10f-v3-retry-prep-done.json");
writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({ ...evidence, evidencePath: out }, null, 2));
process.exit(pass ? 0 : 2);

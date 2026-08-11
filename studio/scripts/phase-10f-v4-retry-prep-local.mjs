/**
 * Phase 10F-V4-RETRY-PREP — local proofs (no provider call, no budget write).
 * Optional Production redacted read: CONFIRM_PHASE_10F_REMOTE_READ=1
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { storyboardIdempotencyFields } from "../src/application/directors/storyboard/analyze-for-project.ts";
import {
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_ANALYZER_SYSTEM_PROMPT,
  MANDATORY_CONTINUITY_KEYS_BLOCK,
  mapStoryboardAnalysisRequest,
  approximateStoryboardTokenCount,
  inspectStoryboardStructuredSchemaProjection,
} from "../src/infrastructure/ai/openai/storyboard/index.ts";
import { VideoProjectBriefSchema } from "../src/domain/brief/index.ts";
import { MarketingPlanSchema } from "../src/domain/marketing/index.ts";
import { CreativeConceptSchema } from "../src/domain/creative/index.ts";
import { VideoScriptSchema } from "../src/domain/script/index.ts";
import { VisualDirectionSchema } from "../src/domain/art/index.ts";
import { inventoryRequiredContinuity } from "../src/domain/storyboard/continuity.ts";

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
const PROPOSED_SALT = "10f-storyboard-v4-20260811";
const EXPECT_TOKENS_FP = "9d34b42ddc3bb85c";
const BURNED_FPS = [
  "abaa9c2886ef3d59",
  "3f39f808e266649c",
  "0b7e8fb44e0acd4d",
  "1bf9daeb68eb6432",
];

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

function keyFp(key) {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

const idem = storyboardIdempotencyFields({
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
  model: "gpt-5.6",
  promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
  schemaVersion: "1.0.0",
  idempotencySalt: PROPOSED_SALT,
});
const idemFp = keyFp(idem.key);
if (BURNED_FPS.includes(idemFp)) {
  console.error("BLOCKED: v4 fingerprint collides with burned run");
  process.exit(2);
}

const projection = inspectStoryboardStructuredSchemaProjection();
const out = {
  promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
  mappingBlock: MANDATORY_CONTINUITY_KEYS_BLOCK,
  proposedSalt: PROPOSED_SALT,
  idempotencyKeyFingerprint: idemFp,
  distinctFromBurned: true,
  attempt_number: 1,
  retry_of_run_id: null,
  schema: {
    oneOf: projection.structuredSchemaOneOfCount,
    projection: projection.structuredSchemaProjection,
    additionalPropertiesFalse: projection.rootAdditionalPropertiesFalse,
  },
  budgetProposal: {
    hardLimitMinor: 115,
    committedMinor: 107,
    availableMinor: 8,
    estimateMinor: null,
    reservationMinor: null,
    approxInputTokens: null,
    shortfallMinor: null,
    hardLimitStrictMinimum: null,
    hardLimitRecommended: 122,
    deltaRecommended: 7,
    availableAfterRecommended: 15,
    budgetWrite: false,
  },
  production: null,
};

const allowRemote =
  process.env.CONFIRM_PHASE_10F_REMOTE_READ === "1" ||
  process.env.CONFIRM_PHASE_10F_REMOTE_READ === "true";

if (allowRemote) {
  const remote = loadEnv(resolve(studioRoot, ".env.remote.local"));
  const db = createClient(remote.SUPABASE_URL, remote.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async function loadArt(id) {
    const { data, error } = await db
      .from("project_artifacts")
      .select("id,project_id,revision,value")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const [briefArt, planArt, conceptArt, scriptArt, visualArt] = await Promise.all([
    loadArt(IDS.brief),
    loadArt(IDS.marketing),
    loadArt(IDS.creative),
    loadArt(IDS.script),
    loadArt(IDS.visual),
  ]);
  const brief = VideoProjectBriefSchema.parse(briefArt.value);
  const plan = MarketingPlanSchema.parse(planArt.value);
  const concept = CreativeConceptSchema.parse(conceptArt.value);
  const script = VideoScriptSchema.parse(scriptArt.value);
  const visual = VisualDirectionSchema.parse(visualArt.value);
  const inv = inventoryRequiredContinuity(visual);
  if (inv.mandatoryContinuityTokensFingerprint !== EXPECT_TOKENS_FP) {
    console.error(
      `BLOCKED: fingerprint ${inv.mandatoryContinuityTokensFingerprint} !== ${EXPECT_TOKENS_FP}`,
    );
    process.exit(2);
  }
  if (inv.mandatoryContinuityTokenCount !== 24) {
    console.error(`BLOCKED: slots ${inv.mandatoryContinuityTokenCount} !== 24`);
    process.exit(2);
  }
  if (inv.mandatoryContinuityUniqueTokenCount !== 9) {
    console.error(
      `BLOCKED: unique ${inv.mandatoryContinuityUniqueTokenCount} !== 9`,
    );
    process.exit(2);
  }
  const mapped = mapStoryboardAnalysisRequest({
    brief,
    marketingPlan: plan,
    creativeConcept: concept,
    videoScript: script,
    visualDirection: visual,
  });
  if (!mapped.userMessage.includes(MANDATORY_CONTINUITY_KEYS_BLOCK)) {
    console.error("BLOCKED: mandatory map missing from payload");
    process.exit(2);
  }
  const approx = approximateStoryboardTokenCount(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT + mapped.userMessage,
  );
  const maxOut = 4096;
  const estimate =
    Math.floor((approx * 500) / 1_000_000) +
    Math.floor((maxOut * 3000) / 1_000_000);
  out.budgetProposal.approxInputTokens = approx;
  out.budgetProposal.estimateMinor = estimate;
  out.budgetProposal.reservationMinor = estimate;
  out.budgetProposal.shortfallMinor = estimate - 8;
  out.budgetProposal.hardLimitStrictMinimum = 115 + (estimate - 8);
  out.budgetProposal.availableAfterRecommended =
    8 + out.budgetProposal.deltaRecommended;
  out.production = {
    mandatorySlots: inv.mandatoryContinuityTokenCount,
    uniqueTokens: inv.mandatoryContinuityUniqueTokenCount,
    scopes: inv.scopes,
    fingerprint: inv.mandatoryContinuityTokensFingerprint,
    requiredRules: inv.requiredContinuityRuleCount,
    preferredRules: inv.preferredContinuityRuleCount,
    advisoryTokenSlots: inv.advisoryContinuityTokenCount,
    mapPresent: true,
    blockingFindings: mapped.blockingFindings.length,
  };
}

console.log(JSON.stringify(out, null, 2));

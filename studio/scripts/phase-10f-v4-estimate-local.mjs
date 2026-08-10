/**
 * Local-only Phase 10F v4 prompt size / estimate (no provider).
 */
import { createHash } from "node:crypto";
import { makeStoryboardChain } from "../src/domain/storyboard/__tests__/fixtures.ts";
import { inventoryRequiredContinuity } from "../src/domain/storyboard/continuity.ts";
import {
  mapStoryboardAnalysisRequest,
  runOpenAIStoryboardDryRun,
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  inspectStoryboardStructuredSchemaProjection,
} from "../src/infrastructure/ai/openai/storyboard/index.ts";

const chain = makeStoryboardChain();
const visual = structuredClone(chain.visualDirection);
const scriptOrder = new Map(
  chain.videoScript.segments.map((s) => [s.id, s.order]),
);
const ordered = [...visual.segments].sort(
  (a, b) =>
    (scriptOrder.get(a.scriptSegmentId) ?? 0) -
    (scriptOrder.get(b.scriptSegmentId) ?? 0),
);
const first = scriptOrder.get(ordered[0].scriptSegmentId) ?? 1;
for (const seg of ordered) {
  const order = scriptOrder.get(seg.scriptSegmentId) ?? 0;
  seg.location.continuityKey = "espace-numerique-principal";
  seg.lighting.source = "studio";
  seg.lighting.temperature = order === first ? "cool" : "neutral";
  seg.environment.productVisibility = order === first ? "none" : "secondary";
  seg.composition.lookDirection = "camera";
}
const mapped = mapStoryboardAnalysisRequest({
  brief: chain.brief,
  marketingPlan: chain.marketingPlan,
  creativeConcept: chain.creativeConcept,
  videoScript: chain.videoScript,
  visualDirection: visual,
});
const dry = runOpenAIStoryboardDryRun(
  chain.brief,
  chain.marketingPlan,
  chain.creativeConcept,
  chain.videoScript,
  visual,
  {
    env: {
      DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1",
      DIRECTOR_V2_PAID_AI_ENABLED: "1",
      OPENAI_API_KEY: "sk-test-local-no-call",
      OPENAI_STORYBOARD_REQUIRE_FIRM_PRICING: "0",
    },
  },
);
const inv = inventoryRequiredContinuity(visual);
const chars =
  (mapped.systemPrompt?.length ?? 0) + mapped.userMessage.length;
const schema = inspectStoryboardStructuredSchemaProjection();
const out = {
  promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
  chars,
  approximateInputTokens: dry.approximateInputTokens,
  maxOutputTokens: dry.maxOutputTokens,
  inventory: {
    requiredContinuityRuleCount: inv.requiredContinuityRuleCount,
    preferredContinuityRuleCount: inv.preferredContinuityRuleCount,
    requiredContinuityTokenCount: inv.requiredContinuityTokenCount,
    requiredContinuityScopeCount: inv.requiredContinuityScopeCount,
    requiredContinuityCoverage: inv.requiredContinuityCoverage,
    requiredContinuityTokensFingerprint: inv.requiredContinuityTokensFingerprint,
    scopes: inv.scopes,
  },
  dryContinuity: {
    requiredContinuityRuleCount: dry.requiredContinuityRuleCount,
    requiredContinuityTokenCount: dry.requiredContinuityTokenCount,
    requiredContinuityScopeCount: dry.requiredContinuityScopeCount,
    requiredContinuityCoverage: dry.requiredContinuityCoverage,
    requiredContinuityTokensFingerprint: dry.requiredContinuityTokensFingerprint,
  },
  schema: {
    oneOfCount: schema.structuredSchemaOneOfCount,
    anyOfCount: schema.structuredSchemaAnyOfCount,
    projection: schema.structuredSchemaProjection,
    metadataCapture: schema.providerErrorMetadataCapture ?? "n/a",
  },
  validations: dry.validations,
  userMessageSha16: createHash("sha256")
    .update(mapped.userMessage)
    .digest("hex")
    .slice(0, 16),
};
console.log(JSON.stringify(out, null, 2));

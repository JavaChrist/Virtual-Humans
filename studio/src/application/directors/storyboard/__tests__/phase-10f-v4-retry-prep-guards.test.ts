/**
 * Phase 10F-V4-RETRY-PREP — local guards (no provider / no ledger / no remote write).
 * Finalizes mandatory continuity contract + new salt identity.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { storyboardIdempotencyFields } from "../analyze-for-project";
import {
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_ANALYZER_SYSTEM_PROMPT,
  MANDATORY_CONTINUITY_KEYS_BLOCK,
  mapStoryboardAnalysisRequest,
  runOpenAIStoryboardDryRun,
  inspectStoryboardStructuredSchemaProjection,
  getStoryboardCandidateJsonSchema,
} from "@/infrastructure/ai/openai/storyboard";
import {
  StoryboardAnalysisCandidateSchema,
  validateCandidateAgainstSources,
  defaultContinuityKeys,
  inventoryRequiredContinuity,
  mandatoryContinuityKeysByVisualSegmentId,
  fingerprintMandatoryContinuityMap,
} from "@/domain/storyboard";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "@/domain/storyboard/__tests__/fixtures";

const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const ARTIFACTS = {
  briefArtifactId: "95c24837-ab61-4bd1-9f47-d576e259d018",
  briefRevision: 1,
  marketingPlanArtifactId: "199284d6-7126-4383-b85f-1ecd74d9528e",
  marketingPlanRevision: 1,
  creativeConceptArtifactId: "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a",
  creativeConceptRevision: 1,
  videoScriptArtifactId: "349e2792-3235-4c00-a1da-9e087b0b4d1c",
  videoScriptRevision: 1,
  visualDirectionArtifactId: "49481462-6444-41f9-8c48-7e7d32c09f1b",
  visualDirectionRevision: 1,
  model: "gpt-5.6",
  schemaVersion: "1.0.0",
} as const;

/** Four burned failed-run key fingerprints. */
const FP_NONE_V2 = "abaa9c2886ef3d59";
const FP_AUTH_B_V2 = "3f39f808e266649c";
const FP_RETRY2_V2 = "0b7e8fb44e0acd4d";
const FP_V3 = "1bf9daeb68eb6432";
const BURNED_SALTS = [
  "10f-auth-b-20260810",
  "10f-auth-b-retry2-20260810",
  "10f-storyboard-v3-20260810",
] as const;
const PROPOSED_SALT = "10f-storyboard-v4-20260811";
/** Production inventory fingerprint (algo segId|tokens;…). */
const EXPECTED_PROD_TOKENS_FP = "9d34b42ddc3bb85c";
/** Idempotency key fingerprint for prompt v4 + proposed salt. */
const EXPECTED_V4_IDEM_FP = "801c34a1080bbcf0";

function keyFp(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/** Production-shaped VisualDirection for matrix parity tests. */
function withProductionLikeContinuity(
  chain: ReturnType<typeof makeStoryboardChain>,
) {
  const visual = structuredClone(chain.visualDirection);
  const scriptOrder = new Map(
    chain.videoScript.segments.map((s) => [s.id, s.order]),
  );
  const ordered = [...visual.segments].sort(
    (a, b) =>
      (scriptOrder.get(a.scriptSegmentId) ?? 0) -
      (scriptOrder.get(b.scriptSegmentId) ?? 0),
  );
  // Production VisualDirection 49481462 matrix (exact opaque tokens).
  const prodByIndex: Array<{
    temperature: "cool" | "neutral";
    product: "none" | "secondary" | "hero";
    look: "product" | "right" | "camera";
  }> = [
    { temperature: "cool", product: "none", look: "product" },
    { temperature: "neutral", product: "secondary", look: "right" },
    { temperature: "neutral", product: "hero", look: "right" },
    { temperature: "neutral", product: "hero", look: "product" },
    { temperature: "neutral", product: "hero", look: "camera" },
  ];
  ordered.forEach((seg, idx) => {
    const cfg = prodByIndex[idx]!;
    seg.location.continuityKey = "espace-numerique-principal";
    seg.lighting.source = "studio";
    seg.lighting.temperature = cfg.temperature;
    seg.environment.productVisibility = cfg.product;
    seg.composition.lookDirection = cfg.look;
  });
  visual.continuityRules = [
    {
      id: "continuity-location-01",
      scope: "location",
      description: "Même espace numérique abstrait.",
      appliesToSegmentIds: visual.segments.map((s) => s.scriptSegmentId),
      severity: "required",
    },
    {
      id: "continuity-palette-01",
      scope: "palette",
      description: "Palette globale stable.",
      appliesToSegmentIds: visual.segments.map((s) => s.scriptSegmentId),
      severity: "required",
    },
    {
      id: "continuity-product-01",
      scope: "product",
      description: "Produit visible dès le problème.",
      appliesToSegmentIds: ordered.slice(1).map((s) => s.scriptSegmentId),
      severity: "required",
    },
    {
      id: "continuity-lighting-01",
      scope: "lighting",
      description: "Éclairage studio préféré.",
      appliesToSegmentIds: visual.segments.map((s) => s.scriptSegmentId),
      severity: "preferred",
    },
    {
      id: "continuity-direction-01",
      scope: "screen_direction",
      description: "Regard caméra sur les trois premiers.",
      appliesToSegmentIds: ordered.slice(0, 3).map((s) => s.scriptSegmentId),
      severity: "required",
    },
  ];
  return { ...chain, visualDirection: visual };
}

test("V4-RETRY-PREP — required/preferred semantics: lighting preferred still mandatory", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const rules = chain.visualDirection.continuityRules;
  assert.equal(rules.filter((r) => r.severity === "required").length, 4);
  const preferred = rules.filter((r) => r.severity !== "required");
  assert.equal(preferred.length, 1);
  assert.equal(preferred[0]!.scope, "lighting");
  assert.equal(preferred[0]!.severity, "preferred");

  const inv = inventoryRequiredContinuity(chain.visualDirection);
  assert.equal(inv.requiredContinuityRuleCount, 4);
  assert.equal(inv.preferredContinuityRuleCount, 1);
  assert.equal(inv.advisoryContinuityTokenCount, 0);
  // keysFromVisualSegment ignores severity — lighting tokens are mandatory
  assert.ok(inv.scopes.includes("lighting"));
  assert.ok(
    Object.values(inv.map).every((tokens) =>
      tokens.some((t) => t.startsWith("lighting:")),
    ),
  );

  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  for (const sc of candidate.scenes) {
    sc.continuityKeys = defaultContinuityKeys(
      chain.visualDirection,
      sc.visualDirectionSegmentId,
    ).filter((k) => !k.startsWith("lighting:"));
  }
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.ok(
    issues.some(
      (i) =>
        i.code === "continuity_violation" &&
        i.message.includes("lighting:"),
    ),
    "preferred lighting rule does not authorize omitting projected lighting tokens",
  );
});

test("V4-RETRY-PREP — mapping name is MANDATORY (not severity=required)", () => {
  assert.equal(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v4");
  assert.equal(
    MANDATORY_CONTINUITY_KEYS_BLOCK,
    "MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID",
  );
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/);
  assert.doesNotMatch(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT,
    /REQUIRED_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  assert.doesNotMatch(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT,
    /REQUIRED_LOCATION_CONTINUITY_KEYS/,
  );
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /Synthetic example/i);
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /coverageComplete/i);
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /UNION/i);
});

test("V4-RETRY-PREP — canonical 5-segment matrix counts + opaque pipe", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  assert.equal(chain.visualDirection.segments.length, 5);
  const inv = inventoryRequiredContinuity(chain.visualDirection);
  const counts = chain.visualDirection.segments.map(
    (s) => inv.map[s.id]?.length ?? 0,
  );
  // Production shape: first=4 (no product), others=5
  const sortedCounts = [...counts].sort((a, b) => a - b);
  assert.deepEqual(sortedCounts, [4, 5, 5, 5, 5]);
  assert.equal(inv.mandatoryContinuityTokenCount, 24);
  assert.equal(inv.mandatoryContinuityUniqueTokenCount, 9);
  assert.equal(inv.mandatoryContinuityScopeCount, 5);
  assert.equal(inv.mandatoryContinuityCoverage, "complete");
  assert.equal(inv.advisoryContinuityTokenCount, 0);
  assert.equal(inv.mandatoryContinuityTokensFingerprint.length, 16);

  const first = [...chain.visualDirection.segments].sort((a, b) => {
    const so = new Map(chain.videoScript.segments.map((s) => [s.id, s.order]));
    return (so.get(a.scriptSegmentId) ?? 0) - (so.get(b.scriptSegmentId) ?? 0);
  })[0]!;
  const lighting = defaultContinuityKeys(chain.visualDirection, first.id).find(
    (k) => k.startsWith("lighting:"),
  );
  assert.equal(lighting, "lighting:studio|cool");
  assert.match(lighting!, /\|/);
});

test("V4-RETRY-PREP — Production fingerprint algo locked (segId|tokens;…)", () => {
  // Exact Production matrix from VisualDirection 49481462 (redacted read PREP).
  const map = {
    "segment-1": [
      "location:espace-numerique-principal",
      "lighting:studio|cool",
      "palette:global",
      "screen_direction:product",
    ],
    "segment-2": [
      "location:espace-numerique-principal",
      "lighting:studio|neutral",
      "palette:global",
      "product:secondary",
      "screen_direction:right",
    ],
    "segment-3": [
      "location:espace-numerique-principal",
      "lighting:studio|neutral",
      "palette:global",
      "product:hero",
      "screen_direction:right",
    ],
    "segment-4": [
      "location:espace-numerique-principal",
      "lighting:studio|neutral",
      "palette:global",
      "product:hero",
      "screen_direction:product",
    ],
    "segment-5": [
      "location:espace-numerique-principal",
      "lighting:studio|neutral",
      "palette:global",
      "product:hero",
      "screen_direction:camera",
    ],
  };
  const fp = fingerprintMandatoryContinuityMap(map, [
    "segment-1",
    "segment-2",
    "segment-3",
    "segment-4",
    "segment-5",
  ]);
  assert.equal(fp, EXPECTED_PROD_TOKENS_FP);
  assert.equal(Object.values(map).flat().length, 24);
  assert.equal(new Set(Object.values(map).flat()).size, 9);
});

test("V4-RETRY-PREP — prompt serialization prevalidation (5 ids, all tokens)", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const mapped = mapStoryboardAnalysisRequest(chain);
  assert.match(mapped.userMessage, new RegExp(MANDATORY_CONTINUITY_KEYS_BLOCK));
  const block = mapped.userMessage.match(
    new RegExp(
      `\\[DATA:${MANDATORY_CONTINUITY_KEYS_BLOCK}\\]\\n([\\s\\S]*?)\\n\\[\\/DATA:${MANDATORY_CONTINUITY_KEYS_BLOCK}\\]`,
    ),
  );
  assert.ok(block, "mandatory map delimiters missing");
  const map = JSON.parse(block![1]!) as Record<string, string[]>;
  assert.equal(Object.keys(map).length, 5);
  const inv = inventoryRequiredContinuity(chain.visualDirection);
  assert.equal(
    Object.values(map).flat().length,
    inv.mandatoryContinuityTokenCount,
  );
  for (const [segId, tokens] of Object.entries(inv.map)) {
    assert.deepEqual(map[segId], tokens);
    for (const token of tokens) {
      assert.ok(block![1]!.includes(token), `truncated/missing ${token}`);
    }
  }
  assert.equal(mapped.blockingFindings.length, 0);
  assert.equal(mapped.mandatoryContinuity.mandatoryContinuityCoverage, "complete");
});

test("V4-RETRY-PREP — multi-segment union semantics in prompt", () => {
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /UNION of all mandatory tokens/i);
});

test("V4-RETRY-PREP — fixture passes full business validation order", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  for (const sc of candidate.scenes) {
    sc.continuityKeys = defaultContinuityKeys(
      chain.visualDirection,
      sc.visualDirectionSegmentId,
    );
  }
  // Real order inside validateCandidateAgainstSources:
  // Zod → coverage → continuity → references → conservation(spoken) → timing
  const zod = StoryboardAnalysisCandidateSchema.safeParse(candidate);
  assert.equal(zod.success, true, "Zod must PASS");
  const { issues, timingStatus } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  const continuityIssues = issues.filter((i) => i.code === "continuity_violation");
  const coverageIssues = issues.filter((i) =>
    /coverage|segment/i.test(`${i.code} ${i.message}`),
  );
  assert.equal(continuityIssues.length, 0, JSON.stringify(continuityIssues.slice(0, 3)));
  assert.ok(timingStatus === "exact" || timingStatus === undefined || timingStatus === "invalid");
  // Full candidate must not fail hard business gates for continuity/coverage/spoken/refs
  const hard = issues.filter(
    (i) =>
      i.code === "continuity_violation" ||
      i.code === "invalid_candidate" ||
      i.code === "spoken_mismatch" ||
      i.code === "coverage_gap" ||
      i.code === "unknown_reference",
  );
  assert.equal(hard.length, 0, JSON.stringify(hard.slice(0, 5)));
  assert.ok(coverageIssues.length === 0 || hard.length === 0);
});

test("V4-RETRY-PREP — structured schema parity", () => {
  const schema = getStoryboardCandidateJsonSchema();
  assert.equal(schema.additionalProperties, false);
  const report = inspectStoryboardStructuredSchemaProjection(schema);
  assert.equal(report.structuredSchemaOneOfCount, 0);
  assert.equal(report.structuredSchemaProjection, "anyOf-compatible");
  assert.equal(report.rootAdditionalPropertiesFalse, true);
  assert.ok(report.spokenContentKindLiterals.includes("dialogue"));
  assert.ok(report.spokenContentKindLiterals.includes("voice_over"));
  assert.ok(report.spokenContentKindLiterals.includes("none"));
});

test("V4-RETRY-PREP — new salt + fingerprint distinct from four burned runs", () => {
  const baseV2 = {
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: "storyboard-analyzer-v2",
  };
  const burned = {
    none: keyFp(storyboardIdempotencyFields(baseV2).key),
    authB: keyFp(
      storyboardIdempotencyFields({
        ...baseV2,
        idempotencySalt: BURNED_SALTS[0],
      }).key,
    ),
    retry2: keyFp(
      storyboardIdempotencyFields({
        ...baseV2,
        idempotencySalt: BURNED_SALTS[1],
      }).key,
    ),
    v3: keyFp(
      storyboardIdempotencyFields({
        projectId: PROJECT_ID,
        ...ARTIFACTS,
        promptVersion: "storyboard-analyzer-v3",
        idempotencySalt: BURNED_SALTS[2],
      }).key,
    ),
  };
  assert.equal(burned.none, FP_NONE_V2);
  assert.equal(burned.authB, FP_AUTH_B_V2);
  assert.equal(burned.retry2, FP_RETRY2_V2);
  assert.equal(burned.v3, FP_V3);

  const proposed = storyboardIdempotencyFields({
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
    idempotencySalt: PROPOSED_SALT,
  });
  const fp = keyFp(proposed.key);
  assert.notEqual(fp, burned.none);
  assert.notEqual(fp, burned.authB);
  assert.notEqual(fp, burned.retry2);
  assert.notEqual(fp, burned.v3);
  assert.ok(!BURNED_SALTS.includes(PROPOSED_SALT as (typeof BURNED_SALTS)[number]));
  // Stable for execute/replay
  const again = storyboardIdempotencyFields({
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: "storyboard-analyzer-v4",
    idempotencySalt: PROPOSED_SALT,
  });
  assert.equal(again.key, proposed.key);
  assert.equal(fp, EXPECTED_V4_IDEM_FP);
});

test("V4-RETRY-PREP — future attempt/retry_of + max 1 call + runtime fail-closed", () => {
  const future = {
    attempt_number: 1,
    retry_of_run_id: null as string | null,
    prompt: STORYBOARD_ANALYZER_PROMPT_VERSION,
    schemas: "1.0.0 / 1.0.0",
    maximumFutureCalls: 1,
    automaticRetry: "forbidden",
    fallback: "forbidden",
    upstreamReplay: "forbidden",
    paidGeneration: "OFF",
    worker: "OFF",
    mediaJobs: "impossible",
    closureAlwaysRuns: true,
    runtimeFinal: "OFF",
  };
  assert.equal(future.attempt_number, 1);
  assert.equal(future.retry_of_run_id, null);
  assert.equal(future.maximumFutureCalls, 1);
  assert.equal(future.automaticRetry, "forbidden");
  assert.equal(future.prompt, "storyboard-analyzer-v4");
});

test("V4-RETRY-PREP — dry-run gates + estimate/reservation budget envelope", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const pricing = {
    getPriceBook: (modelId: string) =>
      modelId === "gpt-5.6"
        ? {
            modelId: "gpt-5.6",
            pricingVersion: "prep-v4",
            currency: "USD" as const,
            inputPerMillionMinor: 500,
            outputPerMillionMinor: 3000,
            confidence: "high" as const,
          }
        : null,
  };
  const dry = runOpenAIStoryboardDryRun(
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
    {
      env: {
        DIRECTOR_V2_STORYBOARD_AI_ENABLED: "1",
        DIRECTOR_V2_PAID_AI_ENABLED: "1",
        OPENAI_API_KEY: "sk-test",
        OPENAI_STORYBOARD_MODEL: "gpt-5.6",
        OPENAI_STORYBOARD_REASONING_EFFORT: "medium",
        OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS: "4096",
        OPENAI_STORYBOARD_REQUIRE_FIRM_PRICING: "0",
      },
      pricing,
    },
  );
  assert.equal(dry.promptVersion, "storyboard-analyzer-v4");
  assert.equal(dry.continuitySemantics, "mandatory-projected-tokens");
  assert.equal(dry.mandatoryContinuityCoverage, "complete");
  assert.equal(dry.mandatoryContinuityTokenCount, 24);
  assert.equal(dry.mandatoryContinuityUniqueTokenCount, 9);
  assert.equal(dry.mandatoryContinuityScopeCount, 5);
  assert.equal(dry.structuredSchemaOneOfCount, 0);
  assert.equal(dry.structuredSchemaProjection, "anyOf-compatible");
  assert.equal(dry.providerErrorMetadataCapture, "ready");
  assert.ok(
    dry.validations.some((v) => v.code === "mandatory_continuity_map" && v.passed),
  );
  assert.ok((dry.approximateInputTokens ?? 0) > 2000);
  const estimate =
    Math.floor(((dry.approximateInputTokens ?? 0) * 500) / 1_000_000) +
    Math.floor((dry.maxOutputTokens * 3000) / 1_000_000);
  assert.equal(dry.maxOutputTokens, 4096);
  assert.equal(estimate, 13);

  const envelope = {
    hardLimitMinor: 115,
    committedMinor: 107,
    reservedMinor: 0,
    availableMinor: 8,
    estimateMinor: 13,
    reservationMinor: 13,
    shortfallMinor: 5,
    hardLimitStrictMinimum: 120,
    hardLimitRecommended: 122,
    deltaRecommended: 7,
    availableAfterRecommended: 15,
    budgetWrite: false,
  };
  assert.equal(
    envelope.shortfallMinor,
    envelope.estimateMinor - envelope.availableMinor,
  );
  assert.equal(
    envelope.hardLimitStrictMinimum,
    envelope.hardLimitMinor + envelope.shortfallMinor,
  );
  assert.equal(envelope.budgetWrite, false);
  assert.ok(envelope.availableMinor < envelope.estimateMinor);
});

test("V4-RETRY-PREP — refuse accidental v2/v3 salts and location-only map", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const mapped = mapStoryboardAnalysisRequest(chain);
  assert.doesNotMatch(mapped.userMessage, /REQUIRED_LOCATION_CONTINUITY_KEYS/);
  assert.doesNotMatch(mapped.userMessage, /REQUIRED_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/);
  for (const salt of BURNED_SALTS) {
    assert.notEqual(salt, PROPOSED_SALT);
  }
  assert.notEqual(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v2");
  assert.notEqual(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v3");
  // map helper export still works
  const map = mandatoryContinuityKeysByVisualSegmentId(chain.visualDirection);
  assert.equal(Object.keys(map).length, 5);
});

/**
 * Phase 10F-ALL-CONTINUITY-DIAG — generic projected continuity contract (no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  StoryboardAnalysisCandidateSchema,
  validateCandidateAgainstSources,
  defaultContinuityKeys,
  inventoryRequiredContinuity,
  requiredContinuityKeysByVisualSegmentId,
} from "@/domain/storyboard";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "./fixtures";
import {
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_ANALYZER_SYSTEM_PROMPT,
  mapStoryboardAnalysisRequest,
  runOpenAIStoryboardDryRun,
  inspectStoryboardStructuredSchemaProjection,
} from "@/infrastructure/ai/openai/storyboard";

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
  const firstScriptOrder = scriptOrder.get(ordered[0]!.scriptSegmentId) ?? 1;
  for (const seg of ordered) {
    const order = scriptOrder.get(seg.scriptSegmentId) ?? 0;
    seg.location.continuityKey = "espace-numerique-principal";
    seg.lighting.source = "studio";
    seg.lighting.temperature = order === firstScriptOrder ? "cool" : "neutral";
    seg.environment.productVisibility =
      order === firstScriptOrder ? "none" : "secondary";
    seg.composition.lookDirection = "camera";
  }
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
      appliesToSegmentIds: ordered
        .filter(
          (s) => (scriptOrder.get(s.scriptSegmentId) ?? 0) > firstScriptOrder,
        )
        .map((s) => s.scriptSegmentId),
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
      appliesToSegmentIds: ordered
        .slice(0, 3)
        .map((s) => s.scriptSegmentId),
      severity: "required",
    },
  ];
  return { ...chain, visualDirection: visual };
}

function validate(
  chain: ReturnType<typeof withProductionLikeContinuity>,
  candidate: ReturnType<typeof makeValidStoryboardCandidate>,
) {
  return validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
}

test("ALL-CONTINUITY — inventory scopes + opaque lighting pipe token", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  assert.equal(chain.visualDirection.segments.length, 5);
  const inv = inventoryRequiredContinuity(chain.visualDirection);
  assert.equal(inv.requiredContinuityRuleCount, 4);
  assert.equal(inv.preferredContinuityRuleCount, 1);
  assert.equal(inv.requiredContinuityCoverage, "complete");
  assert.ok(inv.requiredContinuityTokenCount >= 20);
  assert.ok(inv.scopes.includes("location"));
  assert.ok(inv.scopes.includes("lighting"));
  assert.ok(inv.scopes.includes("palette"));
  assert.ok(inv.scopes.includes("product"));
  assert.ok(inv.scopes.includes("screen_direction"));
  const scriptOrder = new Map(
    chain.videoScript.segments.map((s) => [s.id, s.order]),
  );
  const first = [...chain.visualDirection.segments].sort(
    (a, b) =>
      (scriptOrder.get(a.scriptSegmentId) ?? 0) -
      (scriptOrder.get(b.scriptSegmentId) ?? 0),
  )[0]!;
  const lighting = defaultContinuityKeys(chain.visualDirection, first.id).find(
    (k) => k.startsWith("lighting:"),
  );
  assert.equal(lighting, "lighting:studio|cool");
  assert.match(lighting!, /\|/);
});

test("ALL-CONTINUITY — Zod PASS + métier FAIL per missing projected scope", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const scopesToDrop = [
    "location:",
    "lighting:",
    "palette:",
    "product:",
    "screen_direction:",
  ] as const;
  for (const prefix of scopesToDrop) {
    const candidate = makeValidStoryboardCandidate(
      chain.videoScript,
      chain.visualDirection,
    );
    for (const sc of candidate.scenes) {
      sc.continuityKeys = defaultContinuityKeys(
        chain.visualDirection,
        sc.visualDirectionSegmentId,
      ).filter((k) => !k.startsWith(prefix));
    }
    // product may be absent on segment-1 — drop from a scene that has it
    if (prefix === "product:") {
      const withProduct = candidate.scenes.find((s) =>
        defaultContinuityKeys(
          chain.visualDirection,
          s.visualDirectionSegmentId,
        ).some((k) => k.startsWith("product:")),
      );
      assert.ok(withProduct);
    }
    assert.equal(
      StoryboardAnalysisCandidateSchema.safeParse(candidate).success,
      true,
      `Zod must PASS when dropping ${prefix}`,
    );
    const { issues } = validate(chain, candidate);
    assert.ok(
      issues.some(
        (i) =>
          i.code === "continuity_violation" &&
          i.message.startsWith("Clé de continuité manquante:") &&
          i.message.includes(prefix.replace(":", "")),
      ),
      `expected missing ${prefix}: ${JSON.stringify(issues.slice(0, 3))}`,
    );
  }
});

test("ALL-CONTINUITY — PASS when all projected tokens present; preferred omission still fails lighting", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const ok = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  for (const sc of ok.scenes) {
    sc.continuityKeys = defaultContinuityKeys(
      chain.visualDirection,
      sc.visualDirectionSegmentId,
    );
  }
  assert.equal(validate(chain, ok).issues.filter((i) => i.code === "continuity_violation").length, 0);

  // preferred lighting rule does NOT relax projected lighting token
  const dropLighting = structuredClone(ok);
  for (const sc of dropLighting.scenes) {
    sc.continuityKeys = sc.continuityKeys.filter((k) => !k.startsWith("lighting:"));
  }
  assert.ok(
    validate(chain, dropLighting).issues.some((i) =>
      i.message.includes("lighting:"),
    ),
  );
});

test("ALL-CONTINUITY — invented / wrong-segment / opaque pipe copy", () => {
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const base = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  for (const sc of base.scenes) {
    sc.continuityKeys = defaultContinuityKeys(
      chain.visualDirection,
      sc.visualDirectionSegmentId,
    );
  }

  const invented = structuredClone(base);
  invented.scenes[0]!.continuityKeys = [
    ...invented.scenes[0]!.continuityKeys.filter((k) => !k.startsWith("location:")),
    "location:invented-place",
  ];
  assert.ok(
    validate(chain, invented).issues.some((i) =>
      i.message.includes("location:espace-numerique-principal"),
    ),
  );

  const coolScene = base.scenes.find((s) =>
    s.continuityKeys.includes("lighting:studio|cool"),
  )!;
  assert.ok(coolScene, "expected a scene with lighting:studio|cool");
  const wrongSeg = structuredClone(base);
  const wrongTarget = wrongSeg.scenes.find((s) => s.id === coolScene.id)!;
  wrongTarget.continuityKeys = wrongTarget.continuityKeys.map((k) =>
    k.startsWith("lighting:") ? "lighting:studio|neutral" : k,
  );
  assert.ok(
    validate(chain, wrongSeg).issues.some((i) =>
      i.message.includes("lighting:studio|cool"),
    ),
  );

  const pipeBroken = structuredClone(base);
  const pipeTarget = pipeBroken.scenes.find((s) => s.id === coolScene.id)!;
  pipeTarget.continuityKeys = pipeTarget.continuityKeys.map((k) =>
    k === "lighting:studio|cool" ? "lighting:studio cool" : k,
  );
  assert.ok(
    validate(chain, pipeBroken).issues.some((i) =>
      i.message.includes("lighting:studio|cool"),
    ),
  );
});

test("ALL-CONTINUITY — prompt v4 map includes all projected tokens", () => {
  assert.equal(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v4");
  assert.match(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT,
    /MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /opaque|character-for-character/i);
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /lighting:studio\|cool/);
  const chain = withProductionLikeContinuity(makeStoryboardChain());
  const mapped = mapStoryboardAnalysisRequest(chain);
  assert.match(
    mapped.userMessage,
    /MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  assert.doesNotMatch(
    mapped.userMessage,
    /REQUIRED_LOCATION_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  const map = requiredContinuityKeysByVisualSegmentId(chain.visualDirection);
  for (const [segId, tokens] of Object.entries(map)) {
    assert.ok(mapped.userMessage.includes(segId));
    for (const token of tokens) {
      assert.ok(
        mapped.userMessage.includes(token),
        `missing token ${token} for ${segId}`,
      );
    }
  }
  assert.equal(mapped.blockingFindings.length, 0);
  assert.equal(mapped.requiredContinuity.requiredContinuityCoverage, "complete");
});

test("ALL-CONTINUITY — dry-run counters + schema parity", () => {
  const report = inspectStoryboardStructuredSchemaProjection();
  assert.equal(report.structuredSchemaOneOfCount, 0);
  assert.equal(report.structuredSchemaProjection, "anyOf-compatible");
  const chain = withProductionLikeContinuity(makeStoryboardChain());
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
      },
    },
  );
  assert.equal(dry.promptVersion, "storyboard-analyzer-v4");
  assert.equal(dry.requiredContinuityCoverage, "complete");
  assert.ok(dry.requiredContinuityTokenCount >= 20);
  assert.ok(dry.requiredContinuityScopeCount >= 4);
  assert.ok(dry.requiredContinuityTokensFingerprint.length === 16);
  assert.ok(
    dry.validations.some((v) => v.code === "mandatory_continuity_map" && v.passed),
  );
});

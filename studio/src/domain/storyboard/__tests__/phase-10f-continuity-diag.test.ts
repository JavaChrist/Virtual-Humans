/**
 * Phase 10F-CONTINUITY-DIAG — Zod OK + métier FAIL on missing location: key.
 * Reproduces Production message for run 4914c203 without provider.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  StoryboardAnalysisCandidateSchema,
  validateCandidateAgainstSources,
  finalizeStoryboardProject,
  defaultContinuityKeys,
  projectContinuity,
} from "@/domain/storyboard";
import { makeStoryboardChain, makeValidStoryboardCandidate } from "./fixtures";
import {
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_ANALYZER_SYSTEM_PROMPT,
  mapStoryboardAnalysisRequest,
} from "@/infrastructure/ai/openai/storyboard";

const MISSING =
  "Clé de continuité manquante: location:espace-numerique-principal";

function withProductionLocationKey(
  chain: ReturnType<typeof makeStoryboardChain>,
) {
  const visual = structuredClone(chain.visualDirection);
  for (const seg of visual.segments) {
    seg.location.continuityKey = "espace-numerique-principal";
  }
  visual.continuityRules = [
    {
      id: "continuity-location-01",
      scope: "location",
      description:
        "Conserver le même espace de travail numérique abstrait dans les cinq segments.",
      appliesToSegmentIds: visual.segments.map((s) => s.scriptSegmentId),
      severity: "required",
    },
    ...visual.continuityRules.filter((r) => r.scope !== "location"),
  ];
  return { ...chain, visualDirection: visual };
}

test("10F-CONTINUITY-DIAG — structured/Zod PASS + métier FAIL missing location key", () => {
  const chain = withProductionLocationKey(makeStoryboardChain());
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  // Reproduce incomplete keys: model kept other keys but omitted location: token
  for (const sc of candidate.scenes) {
    sc.continuityKeys = sc.continuityKeys.filter((k) => !k.startsWith("location:"));
    sc.continuityKeys.push("location:digital-workspace"); // invented / renamed
  }

  assert.equal(
    StoryboardAnalysisCandidateSchema.safeParse(candidate).success,
    true,
    "Zod structural must PASS",
  );

  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  const hit = issues.find(
    (i) =>
      i.code === "continuity_violation" &&
      i.message === MISSING,
  );
  assert.ok(hit, JSON.stringify(issues.slice(0, 5)));
  assert.match(hit!.field ?? "", /^scenes\..+\.continuityKeys$/);
});

test("10F-CONTINUITY-DIAG — corrected candidate PASS with exact location key", () => {
  const chain = withProductionLocationKey(makeStoryboardChain());
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  for (const sc of candidate.scenes) {
    const defaults = defaultContinuityKeys(
      chain.visualDirection,
      sc.visualDirectionSegmentId,
    );
    assert.ok(defaults.includes("location:espace-numerique-principal"));
    sc.continuityKeys = defaults;
  }
  assert.equal(StoryboardAnalysisCandidateSchema.safeParse(candidate).success, true);
  const { issues } = validateCandidateAgainstSources(
    candidate,
    chain.brief,
    chain.marketingPlan,
    chain.creativeConcept,
    chain.videoScript,
    chain.visualDirection,
  );
  assert.equal(
    issues.filter((i) => i.code === "continuity_violation").length,
    0,
    JSON.stringify(issues),
  );
  const sb = finalizeStoryboardProject({
    ...chain,
    candidate,
    metadata: { id: "sb-diag", createdBy: "tester", correlationId: "corr-diag" },
  });
  assert.ok(
    sb.scenes.every((s) =>
      s.continuityKeys.includes("location:espace-numerique-principal"),
    ),
  );
});

test("10F-CONTINUITY-DIAG — five segments share stable location; framing change OK", () => {
  const chain = withProductionLocationKey(makeStoryboardChain());
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  assert.equal(candidate.scenes.length, 5);
  for (const sc of candidate.scenes) {
    sc.continuityKeys = defaultContinuityKeys(
      chain.visualDirection,
      sc.visualDirectionSegmentId,
    );
  }
  // Simulate framing-only variation: extra key allowed, location unchanged
  candidate.scenes[2]!.continuityKeys = [
    ...candidate.scenes[2]!.continuityKeys,
    "framing:close-up",
  ];
  const { issues } = projectContinuity(
    chain.visualDirection,
    candidate.scenes.map((s) => ({ ...s, durationSeconds: 1 })),
    [],
  );
  assert.equal(issues.filter((i) => i.message.includes("lieu")).length, 0);
});

test("10F-CONTINUITY-DIAG — intentional place break justified", () => {
  const chain = withProductionLocationKey(makeStoryboardChain());
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  const scenes = candidate.scenes.map((s) => ({
    ...s,
    durationSeconds: 1,
    continuityKeys: defaultContinuityKeys(
      chain.visualDirection,
      s.visualDirectionSegmentId,
    ),
  }));
  scenes[4]!.continuityKeys = scenes[4]!.continuityKeys.map((k) =>
    k.startsWith("location:") ? "location:other-place" : k,
  );
  const breaks = [
    {
      sceneId: scenes[4]!.id,
      scope: "location",
      justification: "CTA volontairement dans un second lieu.",
    },
  ];
  // With intentional break, missing projected location key for that scope is skipped
  scenes[4]!.continuityKeys = scenes[4]!.continuityKeys.filter(
    (k) => !k.startsWith("location:"),
  );
  scenes[4]!.continuityKeys.push("location:other-place");
  const { issues } = projectContinuity(chain.visualDirection, scenes, breaks);
  assert.equal(
    issues.filter((i) => i.message.includes("silencieuse")).length,
    0,
    JSON.stringify(issues),
  );
});

test("10F-CONTINUITY-DIAG — invented location key alone fails (missing required)", () => {
  const chain = withProductionLocationKey(makeStoryboardChain());
  const scenes = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  ).scenes.map((s) => ({
    ...s,
    durationSeconds: 1,
    continuityKeys: ["location:invented-place"],
  }));
  const { issues } = projectContinuity(chain.visualDirection, scenes, []);
  assert.ok(issues.some((i) => i.message === MISSING));
});

test("10F-CONTINUITY-DIAG — prompt v4 still requires exact location token among all keys", () => {
  assert.equal(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v4");
  assert.match(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT,
    /MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /character-for-character|opaque/i);
  const chain = withProductionLocationKey(makeStoryboardChain());
  const mapped = mapStoryboardAnalysisRequest(chain);
  assert.match(
    mapped.userMessage,
    /MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  assert.match(mapped.userMessage, /location:espace-numerique-principal/);
});

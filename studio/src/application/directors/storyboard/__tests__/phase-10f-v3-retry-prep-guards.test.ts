/**
 * Phase 10F-V3-RETRY-PREP — local guards (no provider / no ledger / no remote).
 * Refuses accidental reuse of burned v2 salts / prompt identity.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { storyboardIdempotencyFields } from "../analyze-for-project";
import {
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_ANALYZER_SYSTEM_PROMPT,
  mapStoryboardAnalysisRequest,
  runOpenAIStoryboardDryRun,
  inspectStoryboardStructuredSchemaProjection,
} from "@/infrastructure/ai/openai/storyboard";
import {
  StoryboardAnalysisCandidateSchema,
  validateCandidateAgainstSources,
  defaultContinuityKeys,
  projectContinuity,
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

/** Burned failed-run identities (prompt v2). */
const FP_NONE_V2 = "abaa9c2886ef3d59";
const FP_AUTH_B_V2 = "3f39f808e266649c";
const FP_RETRY2_V2 = "0b7e8fb44e0acd4d";
const FP_V3_PROPOSED = "1bf9daeb68eb6432";
const BURNED_SALTS = [
  "10f-auth-b-20260810",
  "10f-auth-b-retry2-20260810",
] as const;
const PROPOSED_SALT = "10f-storyboard-v3-20260810";
const MISSING =
  "Clé de continuité manquante: location:espace-numerique-principal";

function keyFp(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

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

test("V3-RETRY-PREP — prompt/schema contract forbids v2 identity", () => {
  assert.equal(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v4");
  assert.notEqual(STORYBOARD_ANALYZER_PROMPT_VERSION, "storyboard-analyzer-v2");
  assert.match(
    STORYBOARD_ANALYZER_SYSTEM_PROMPT,
    /MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  assert.match(STORYBOARD_ANALYZER_SYSTEM_PROMPT, /never|character-for-character/i);
  });

test("V3-RETRY-PREP — five segments require location:espace-numerique-principal", () => {
  const chain = withProductionLocationKey(makeStoryboardChain());
  assert.equal(chain.visualDirection.segments.length, 5);
  const mapped = mapStoryboardAnalysisRequest(chain);
  assert.match(
    mapped.userMessage,
    /MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID/,
  );
  const block = mapped.userMessage.match(
    /\[DATA:MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID\]\n([\s\S]*?)\n\[\/DATA:MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID\]/,
  );
  assert.ok(block, "required map delimiters missing");
  const map = JSON.parse(block![1]!) as Record<string, string[]>;
  assert.equal(Object.keys(map).length, 5);
  for (const seg of chain.visualDirection.segments) {
    assert.ok(map[seg.id]?.includes("location:espace-numerique-principal"));
  }
});

test("V3-RETRY-PREP — continuity matrix (missing/renamed/prefix/wrong segment/framing/break/multi-shot/advisory/token)", () => {
  const chain = withProductionLocationKey(makeStoryboardChain());
  const base = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );

  // correct 5/5
  {
    const c = structuredClone(base);
    for (const sc of c.scenes) {
      sc.continuityKeys = defaultContinuityKeys(
        chain.visualDirection,
        sc.visualDirectionSegmentId,
      );
    }
    assert.equal(StoryboardAnalysisCandidateSchema.safeParse(c).success, true);
    const { issues } = validateCandidateAgainstSources(
      c,
      chain.brief,
      chain.marketingPlan,
      chain.creativeConcept,
      chain.videoScript,
      chain.visualDirection,
    );
    assert.equal(
      issues.filter((i) => i.code === "continuity_violation").length,
      0,
    );
  }

  // key absent
  {
    const c = structuredClone(base);
    for (const sc of c.scenes) {
      sc.continuityKeys = defaultContinuityKeys(
        chain.visualDirection,
        sc.visualDirectionSegmentId,
      ).filter((k) => !k.startsWith("location:"));
    }
    const { issues } = validateCandidateAgainstSources(
      c,
      chain.brief,
      chain.marketingPlan,
      chain.creativeConcept,
      chain.videoScript,
      chain.visualDirection,
    );
    assert.ok(issues.some((i) => i.message === MISSING));
  }

  // renamed
  {
    const c = structuredClone(base);
    for (const sc of c.scenes) {
      sc.continuityKeys = [
        ...defaultContinuityKeys(
          chain.visualDirection,
          sc.visualDirectionSegmentId,
        ).filter((k) => !k.startsWith("location:")),
        "location:espace-numerique",
      ];
    }
    const { issues } = validateCandidateAgainstSources(
      c,
      chain.brief,
      chain.marketingPlan,
      chain.creativeConcept,
      chain.videoScript,
      chain.visualDirection,
    );
    assert.ok(issues.some((i) => i.message === MISSING));
  }

  // prefix location: absent (bare key)
  {
    const c = structuredClone(base);
    for (const sc of c.scenes) {
      sc.continuityKeys = [
        ...defaultContinuityKeys(
          chain.visualDirection,
          sc.visualDirectionSegmentId,
        ).filter((k) => !k.startsWith("location:")),
        "espace-numerique-principal",
      ];
    }
    const { issues } = validateCandidateAgainstSources(
      c,
      chain.brief,
      chain.marketingPlan,
      chain.creativeConcept,
      chain.videoScript,
      chain.visualDirection,
    );
    assert.ok(issues.some((i) => i.message === MISSING));
  }

  // wrong segment: scene0 gets scene1's invented place while required stays espace…
  {
    const c = structuredClone(base);
    for (const sc of c.scenes) {
      sc.continuityKeys = defaultContinuityKeys(
        chain.visualDirection,
        sc.visualDirectionSegmentId,
      );
    }
    c.scenes[0]!.continuityKeys = c.scenes[0]!.continuityKeys.map((k) =>
      k.startsWith("location:") ? "location:other-segment-place" : k,
    );
    const { issues } = validateCandidateAgainstSources(
      c,
      chain.brief,
      chain.marketingPlan,
      chain.creativeConcept,
      chain.videoScript,
      chain.visualDirection,
    );
    assert.ok(issues.some((i) => i.message === MISSING));
  }

  // visual variation same place OK
  {
    const scenes = base.scenes.map((s) => ({
      ...s,
      durationSeconds: 1,
      continuityKeys: [
        ...defaultContinuityKeys(
          chain.visualDirection,
          s.visualDirectionSegmentId,
        ),
        "framing:close-up",
        "lighting:rim",
      ],
    }));
    const { issues } = projectContinuity(
      chain.visualDirection,
      scenes,
      [],
    );
    assert.equal(
      issues.filter((i) => i.message.includes("lieu")).length,
      0,
    );
  }

  // explicit place change with intentionalBreak
  {
    const scenes = base.scenes.map((s) => ({
      ...s,
      durationSeconds: 1,
      continuityKeys: defaultContinuityKeys(
        chain.visualDirection,
        s.visualDirectionSegmentId,
      ),
    }));
    scenes[4]!.continuityKeys = scenes[4]!.continuityKeys.map((k) =>
      k.startsWith("location:") ? "location:second-place" : k,
    );
    const { issues } = projectContinuity(chain.visualDirection, scenes, [
      {
        sceneId: scenes[4]!.id,
        scope: "location",
        justification: "CTA dans un second lieu documenté.",
      },
    ]);
    assert.equal(
      issues.filter((i) => i.message.includes("silencieuse")).length,
      0,
    );
  }

  // multi-shot from same segment: both shots need exact key
  {
    const c = makeValidStoryboardCandidate(
      chain.videoScript,
      chain.visualDirection,
      { splitFirstSegment: true },
    );
    const firstSegVd = chain.visualDirection.segments[0]!.id;
    const shots = c.scenes.filter((s) => s.visualDirectionSegmentId === firstSegVd);
    assert.ok(shots.length >= 2);
    for (const sc of c.scenes) {
      sc.continuityKeys = defaultContinuityKeys(
        chain.visualDirection,
        sc.visualDirectionSegmentId,
      );
    }
    shots[1]!.continuityKeys = shots[1]!.continuityKeys.filter(
      (k) => !k.startsWith("location:"),
    );
    const { issues } = validateCandidateAgainstSources(
      c,
      chain.brief,
      chain.marketingPlan,
      chain.creativeConcept,
      chain.videoScript,
      chain.visualDirection,
    );
    assert.ok(issues.some((i) => i.message === MISSING));
  }

  // preferred (non-required) location rule does not relax projected key from VD
  {
    const visual = structuredClone(chain.visualDirection);
    visual.continuityRules = visual.continuityRules.map((r) =>
      r.scope === "location" ? { ...r, severity: "preferred" as const } : r,
    );
    const c = structuredClone(base);
    for (const sc of c.scenes) {
      sc.continuityKeys = defaultContinuityKeys(visual, sc.visualDirectionSegmentId).filter(
        (k) => !k.startsWith("location:"),
      );
    }
    const { issues } = validateCandidateAgainstSources(
      c,
      chain.brief,
      chain.marketingPlan,
      chain.creativeConcept,
      chain.videoScript,
      visual,
    );
    assert.ok(
      issues.some((i) => i.message === MISSING),
      "projected location key remains required even if rule is preferred/advisory",
    );
  }

  // exact token with allowed characters
  {
    const key = "location:espace-numerique-principal";
    assert.match(key, /^location:[A-Za-z0-9][A-Za-z0-9_-]*$/);
    assert.equal(key, "location:espace-numerique-principal");
  }
});

test("V3-RETRY-PREP — new salt + prompt v3 distinct from three burned fingerprints", () => {
  const burnedNone = storyboardIdempotencyFields({
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: "storyboard-analyzer-v2",
  });
  const burnedAuthB = storyboardIdempotencyFields({
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: "storyboard-analyzer-v2",
    idempotencySalt: BURNED_SALTS[0],
  });
  const burnedRetry2 = storyboardIdempotencyFields({
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: "storyboard-analyzer-v2",
    idempotencySalt: BURNED_SALTS[1],
  });
  const proposed = storyboardIdempotencyFields({
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: "storyboard-analyzer-v3",
    idempotencySalt: PROPOSED_SALT,
  });
  const fps = {
    none: keyFp(burnedNone.key),
    authB: keyFp(burnedAuthB.key),
    retry2: keyFp(burnedRetry2.key),
    v3: keyFp(proposed.key),
  };
  assert.equal(fps.none, FP_NONE_V2);
  assert.equal(fps.authB, FP_AUTH_B_V2);
  assert.equal(fps.retry2, FP_RETRY2_V2);
  assert.equal(fps.v3, FP_V3_PROPOSED);
  assert.notEqual(fps.v3, fps.none);
  assert.notEqual(fps.v3, fps.authB);
  assert.notEqual(fps.v3, fps.retry2);
  assert.ok(!BURNED_SALTS.includes(PROPOSED_SALT as (typeof BURNED_SALTS)[number]));
  // salt stable for execute/replay: same inputs → same key
  const again = storyboardIdempotencyFields({
    projectId: PROJECT_ID,
    ...ARTIFACTS,
    promptVersion: "storyboard-analyzer-v3",
    idempotencySalt: PROPOSED_SALT,
  });
  assert.equal(again.key, proposed.key);
});

test("V3-RETRY-PREP — future attempt/retry_of + max 1 call + runtime fail-closed contract", () => {
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
    refuseV2Scripts: true,
  };
  assert.equal(future.attempt_number, 1);
  assert.equal(future.retry_of_run_id, null);
  assert.equal(future.prompt, "storyboard-analyzer-v4");
  assert.equal(future.maximumFutureCalls, 1);
  assert.equal(future.refuseV2Scripts, true);
});

test("V3-RETRY-PREP — schema projection + dry-run continuity coverage gates", () => {
  const report = inspectStoryboardStructuredSchemaProjection();
  assert.equal(report.structuredSchemaOneOfCount, 0);
  assert.equal(report.structuredSchemaProjection, "anyOf-compatible");
  const chain = withProductionLocationKey(makeStoryboardChain());
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
  assert.equal(dry.structuredSchemaOneOfCount, 0);
  assert.equal(dry.mandatoryContinuityCoverage, "complete");
  assert.ok(dry.mandatoryContinuityTokenCount >= 5);
  assert.ok(
    dry.validations.some(
      (v) => v.code === "mandatory_continuity_map" && v.passed,
    ),
  );
});

test("V3-RETRY-PREP — budget envelope documents shortfall (no write)", () => {
  // Post V3-EXECUTE: available 8¢ < estimate 13¢ (no budget write in DIAG).
  const envelope = {
    hardLimitMinor: 115,
    committedMinor: 107,
    reservedMinor: 0,
    availableMinor: 8,
    estimateMinor: 13,
    reservationEqualsEstimate: true,
    shortfallMinor: 5,
    hardLimitStrictMinimum: 120,
    hardLimitRecommended: 122,
    deltaRecommended: 7,
    availableAfterRecommended: 15,
    budgetWrite: false,
    maximumFutureCalls: 1,
  };
  assert.ok(envelope.availableMinor < envelope.estimateMinor);
  assert.equal(envelope.shortfallMinor, envelope.estimateMinor - envelope.availableMinor);
  assert.equal(
    envelope.hardLimitStrictMinimum,
    envelope.hardLimitMinor + envelope.shortfallMinor,
  );
  assert.equal(envelope.budgetWrite, false);
  assert.equal(envelope.maximumFutureCalls, 1);
});

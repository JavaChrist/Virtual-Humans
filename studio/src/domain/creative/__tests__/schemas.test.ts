import assert from "node:assert/strict";
import { test } from "node:test";
import { finalizeCreativeConcept } from "../finalize";
import { CREATIVE_CONCEPT_SCHEMA_VERSION, CREATIVE_FIELD_LIMITS } from "../creative-concept";
import {
  CreativeAnalysisCandidateSchema,
  CreativeConceptSchema,
} from "../schemas";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "./fixtures";

test("concept minimal valide via finalize", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const concept = finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate: makeValidCreativeCandidate(),
    metadata: { id: "cre-1", createdBy: "tester", correlationId: "corr-1" },
  });
  assert.equal(CreativeConceptSchema.safeParse(concept).success, true);
  assert.equal(concept.schemaVersion, CREATIVE_CONCEPT_SCHEMA_VERSION);
  assert.equal(concept.marketingPlanRevisionId, plan.id);
});

test("approche narrative inconnue", () => {
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      narrativeApproach: "montage_parallel",
    }).success,
    false,
  );
});

test("rythme invalide", () => {
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      rhythm: "chaotic",
    }).success,
    false,
  );
});

test("arc vide", () => {
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      emotionalArc: [],
    }).success,
    false,
  );
});

test("ordres dupliqués ou non contigus", () => {
  const dup = makeValidCreativeCandidate({
    emotionalArc: [
      { order: 1, purpose: "attention", emotion: "a", description: "one" },
      { order: 1, purpose: "action", emotion: "b", description: "two" },
    ],
  });
  assert.equal(CreativeAnalysisCandidateSchema.safeParse(dup).success, false);

  const gap = makeValidCreativeCandidate({
    emotionalArc: [
      { order: 1, purpose: "attention", emotion: "a", description: "one" },
      { order: 3, purpose: "action", emotion: "b", description: "three" },
    ],
  });
  assert.equal(CreativeAnalysisCandidateSchema.safeParse(gap).success, false);
});

test("trop de beats", () => {
  const beats = Array.from({ length: CREATIVE_FIELD_LIMITS.beatsMax + 1 }, (_, i) => ({
    order: i + 1,
    purpose: i === CREATIVE_FIELD_LIMITS.beatsMax ? ("action" as const) : ("attention" as const),
    emotion: "x",
    description: `beat ${i + 1}`,
  }));
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      emotionalArc: beats,
    }).success,
    false,
  );
});

test("dispositifs incomplets", () => {
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      openingDevice: { kind: "question", description: "" },
    }).success,
    false,
  );
});

test("références en doublon", async () => {
  const { validateReferenceKeywords } = await import("../validation");
  assert.ok(
    validateReferenceKeywords(["warm", "warm"]).some((i) => i.code === "invariant_violation"),
  );
});

test("textes trop longs", () => {
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      bigIdea: "x".repeat(CREATIVE_FIELD_LIMITS.bigIdea + 1),
    }).success,
    false,
  );
});

test("sérialisation complète JSON", () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const concept = finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate: makeValidCreativeCandidate(),
    metadata: { id: "cre-ser", createdBy: "t", correlationId: "c-ser" },
  });
  assert.equal(CreativeConceptSchema.safeParse(JSON.parse(JSON.stringify(concept))).success, true);
});

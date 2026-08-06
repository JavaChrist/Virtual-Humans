/**
 * 8H-A — emotionalArc order normalization + duration hard gate (no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CreativeAnalyzerCandidateSchema,
  CreativeAnalysisCandidateSchema,
  finalizeCreativeConcept,
  maxBeatsForDurationSeconds,
  normalizeCreativeCandidate,
  normalizeEmotionalArc,
  validateEmotionalArcOrders,
} from "@/domain/creative";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "./fixtures";

function beat(
  purpose:
    | "attention"
    | "recognition"
    | "discovery"
    | "desire"
    | "action",
  order?: number,
) {
  const base = {
    purpose,
    emotion: "x",
    description: `beat ${purpose}`,
  };
  return order == null ? base : { ...base, order };
}

test("maxBeatsForDurationSeconds — paliers 15/20/30/plus", () => {
  assert.equal(maxBeatsForDurationSeconds(15), 3);
  assert.equal(maxBeatsForDurationSeconds(20), 4);
  assert.equal(maxBeatsForDurationSeconds(30), 5);
  assert.equal(maxBeatsForDurationSeconds(31), 6);
  assert.equal(maxBeatsForDurationSeconds(60), 6);
});

test("normalizeEmotionalArc — order = index+1, jamais de réordonnancement", () => {
  const input = [
    beat("action", 9),
    beat("attention", 0),
    beat("discovery", 2),
  ];
  const out = normalizeEmotionalArc(input);
  assert.deepEqual(
    out.map((b) => b.purpose),
    ["action", "attention", "discovery"],
  );
  assert.deepEqual(
    out.map((b) => b.order),
    [1, 2, 3],
  );
});

test("normalize — 0-based / trous / doublons / décroissant → 1..n", () => {
  const cases = [
    [0, 1, 2],
    [1, 3, 5],
    [1, 1, 2],
    [3, 2, 1],
  ];
  for (const orders of cases) {
    const beats = orders.map((order, i) =>
      beat(
        i === orders.length - 1 ? "action" : "attention",
        order,
      ),
    );
    const out = normalizeEmotionalArc(beats);
    assert.deepEqual(
      out.map((b) => b.order),
      orders.map((_, i) => i + 1),
    );
  }
});

test("normalize — beats sans order (schema analyzer)", () => {
  const out = normalizeEmotionalArc([
    beat("attention"),
    beat("action"),
  ]);
  assert.deepEqual(
    out.map((b) => b.order),
    [1, 2],
  );
});

test("analyzer schema — refuse order sur beat ; domain schema l’exige après normalize", () => {
  const analyzerRaw = {
    ...makeValidCreativeCandidate(),
    emotionalArc: [
      { purpose: "attention", emotion: "a", description: "one" },
      { purpose: "action", emotion: "b", description: "two" },
    ],
  };
  // Strip order if present from spread
  delete (analyzerRaw as { emotionalArc: unknown }).emotionalArc;
  const withoutOrder = {
    title: analyzerRaw.title,
    logline: analyzerRaw.logline,
    bigIdea: analyzerRaw.bigIdea,
    narrativeApproach: analyzerRaw.narrativeApproach,
    emotionalArc: [
      { purpose: "attention" as const, emotion: "a", description: "one" },
      { purpose: "action" as const, emotion: "b", description: "two" },
    ],
    openingDevice: analyzerRaw.openingDevice,
    endingDevice: analyzerRaw.endingDevice,
    rhythm: analyzerRaw.rhythm,
    referenceKeywords: analyzerRaw.referenceKeywords,
  };
  assert.equal(
    CreativeAnalyzerCandidateSchema.safeParse(withoutOrder).success,
    true,
  );
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse(withoutOrder).success,
    false,
  );
  const normalized = normalizeCreativeCandidate(withoutOrder);
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse(normalized).success,
    true,
  );
});

test("hard gate — 6 beats sur 30s rejeté après normalize", () => {
  const beats = Array.from({ length: 6 }, (_, i) => ({
    order: 99 - i,
    purpose: (i === 5 ? "action" : "attention") as "action" | "attention",
    emotion: "x",
    description: `b${i}`,
  }));
  const normalized = normalizeEmotionalArc(beats);
  assert.deepEqual(
    normalized.map((b) => b.order),
    [1, 2, 3, 4, 5, 6],
  );
  const issues = validateEmotionalArcOrders(
    { ...makeValidCreativeCandidate(), emotionalArc: normalized },
    30,
  );
  assert.ok(
    issues.some((i) =>
      i.message.includes("Trop de beats pour une durée de 30s"),
    ),
  );
});

test("hard gate — 2 et 5 beats ok pour 30s ; <2 et >6 refusés au schema", () => {
  const two = normalizeEmotionalArc([
    beat("attention"),
    beat("action"),
  ]);
  assert.equal(
    validateEmotionalArcOrders(
      { ...makeValidCreativeCandidate(), emotionalArc: two },
      30,
    ).length,
    0,
  );

  const five = normalizeEmotionalArc([
    beat("attention"),
    beat("recognition"),
    beat("discovery"),
    beat("desire"),
    beat("action"),
  ]);
  assert.equal(
    validateEmotionalArcOrders(
      { ...makeValidCreativeCandidate(), emotionalArc: five },
      30,
    ).length,
    0,
  );

  assert.equal(
    CreativeAnalyzerCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      emotionalArc: [beat("action")],
    }).success,
    false,
  );
  const seven = Array.from({ length: 7 }, (_, i) =>
    beat(i === 6 ? "action" : "attention"),
  );
  assert.equal(
    CreativeAnalyzerCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      emotionalArc: seven,
    }).success,
    false,
  );
});

test("finalize — assumption technique array-order + séquence préservée", () => {
  const brief = makeCreativeBrief({ durationSeconds: 30 });
  const plan = makeMarketingPlan(brief);
  const candidate = makeValidCreativeCandidate({
    emotionalArc: [
      { order: 0, purpose: "attention", emotion: "a", description: "first" },
      { order: 9, purpose: "discovery", emotion: "b", description: "second" },
      { order: 1, purpose: "desire", emotion: "c", description: "third" },
      { order: 1, purpose: "action", emotion: "d", description: "fourth" },
    ],
  });
  const concept = finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate,
    metadata: { id: "cre-8ha", createdBy: "tester", correlationId: "corr-8ha" },
  });
  assert.deepEqual(
    concept.emotionalArc.map((b) => b.order),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    concept.emotionalArc.map((b) => b.description),
    ["first", "second", "third", "fourth"],
  );
  assert.ok(
    concept.assumptions.some(
      (a) => a.id === "assumption-emotional-arc-array-order",
    ),
  );
});

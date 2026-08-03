import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import {
  compareScoredPicks,
  createDefaultRoutingPolicy,
  normalizeCostScores,
  scoreCandidate,
  validateRoutingPolicy,
  RoutingDomainError,
} from "../index";
import { makeRoutableRegistry } from "./fixtures";

test("poids valides / invalides", () => {
  assert.doesNotThrow(() => validateRoutingPolicy(createDefaultRoutingPolicy()));
  assert.throws(
    () =>
      createDefaultRoutingPolicy({
        priorities: { quality: 10, identity: 10, speed: 10, reliability: 10, cost: 10 },
      }),
    RoutingDomainError,
  );
});

test("score composite + contributions + coût normalisé", () => {
  const registry = makeRoutableRegistry();
  const model = registry.models.find((m) => m.modelId === "i2v")!;
  const costs = normalizeCostScores([
    { key: "a", amountMinor: 100 },
    { key: "b", amountMinor: 200 },
  ]);
  assert.equal(costs.get("a"), 100);
  assert.equal(costs.get("b"), 0);

  const policy = createDefaultRoutingPolicy();
  const score = scoreCandidate({
    model,
    costScore: costs.get("a"),
    policy,
    identityPriorityHigh: false,
  });
  assert.ok(score);
  assert.ok(score!.total >= 0 && score!.total <= 100);
  assert.ok(score!.contributions.some((c) => c.dimension === "cost" && c.status === "known"));
});

test("score inconnu obligatoire bloque ; optionnel exclu", () => {
  const registry = makeRoutableRegistry();
  const voice = registry.models.find((m) => m.modelId === "voice-1")!;
  const policy = createDefaultRoutingPolicy({
    unknownScorePolicy: {
      quality: "exclude_from_denominator",
      identity: "block",
      speed: "exclude_from_denominator",
      reliability: "exclude_from_denominator",
      cost: "block",
      penaltyPoints: 10,
    },
    hardRequirements: {
      identityScoreRequiredWhenHighPriority: true,
      requireFirmPricing: true,
      rejectUnknownPricingConfidence: false,
    },
  });
  assert.equal(
    scoreCandidate({
      model: voice,
      costScore: 50,
      policy,
      identityPriorityHigh: true,
    }),
    null,
  );
  const ok = scoreCandidate({
    model: voice,
    costScore: 50,
    policy: createDefaultRoutingPolicy(),
    identityPriorityHigh: false,
  });
  assert.ok(ok);
  assert.ok(ok!.missingDimensions.includes("quality"));
});

test("tie-break lexical déterministe", () => {
  const registry = makeRoutableRegistry();
  const m = registry.models.find((m) => m.modelId === "t2v")!;
  const policy = createDefaultRoutingPolicy();
  const score = scoreCandidate({
    model: m,
    costScore: 50,
    policy,
    identityPriorityHigh: false,
  })!;
  const a = {
    providerId: "aaa",
    modelId: "m1",
    cost: money(10, "USD"),
    estimatedDurationSeconds: 5,
    strategyId: "direct_video",
    model: m,
    score,
  };
  const b = {
    ...a,
    providerId: "bbb",
  };
  assert.ok(compareScoredPicks(a, b, policy.tieBreakers) < 0);
  assert.equal(
    compareScoredPicks(a, b, policy.tieBreakers),
    compareScoredPicks(a, b, policy.tieBreakers),
  );
});

test("aucun score inventé si registry vide", () => {
  const registry = makeRoutableRegistry();
  const voice = registry.models.find((m) => m.modelId === "voice-1")!;
  const score = scoreCandidate({
    model: voice,
    costScore: 80,
    policy: createDefaultRoutingPolicy(),
    identityPriorityHigh: false,
  })!;
  assert.equal(score.quality, undefined);
  assert.equal(score.identity, undefined);
});

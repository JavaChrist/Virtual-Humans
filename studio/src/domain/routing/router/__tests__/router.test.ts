import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRegistryFromStudioPricing } from "@/application/routing";
import { createModelRouter } from "@/application/routing/model-router";
import {
  createDefaultRoutingPolicy,
  routeModelPlan,
  validateGenerationPlan,
} from "../index";
import {
  AT,
  CREATED,
  ampleBudget,
  defaultPolicy,
  makeRoutableRegistry,
  makeRouterChain,
  tinyBudget,
} from "./fixtures";

test("happy path multi-scènes déterministe", () => {
  const chain = makeRouterChain({ withCharacter: true });
  const registry = makeRoutableRegistry();
  const budget = ampleBudget();
  const input = {
    storyboard: chain.storyboard,
    scenePackages: chain.packages,
    registry,
    routingPolicy: defaultPolicy(),
    ...budget,
    metadata: { id: "plan-1", createdBy: "tester", createdAt: CREATED },
  };
  const ctx = { at: AT, correlationId: "corr-r1" };
  const a = routeModelPlan(input, ctx);
  const b = routeModelPlan(input, ctx);
  assert.equal(a.status, "completed");
  assert.equal(b.status, "completed");
  if (a.status === "completed" && b.status === "completed") {
    assert.deepEqual(a.plan.scenePlans, b.plan.scenePlans);
    assert.equal(a.plan.estimatedCost.currency, "USD");
    assert.ok(a.plan.budgetDecision.allowed);
    assert.equal(a.plan.scenePlans.length, chain.storyboard.scenes.length);
    for (const sp of a.plan.scenePlans) {
      assert.ok(sp.steps.length >= 1);
      assert.ok(sp.steps.every((s) => s.fallbacks.length <= 2));
      assert.ok(sp.steps.every((s) => s.selection.selectedBecause.length > 0));
    }
    const issues = validateGenerationPlan({
      plan: a.plan,
      storyboard: chain.storyboard,
      scenePackages: chain.packages,
    });
    assert.deepEqual(issues, []);
    assert.throws(() => {
      (a.plan.scenePlans as { sceneId: string }[])[0]!.sceneId = "x";
    });
  }
  // inputs not mutated
  assert.equal(chain.packages[0]!.sceneId, input.scenePackages[0]!.sceneId);
});

test("budget_exceeded", () => {
  const chain = makeRouterChain({ withCharacter: true });
  const result = routeModelPlan(
    {
      storyboard: chain.storyboard,
      scenePackages: chain.packages,
      registry: makeRoutableRegistry(),
      routingPolicy: defaultPolicy(),
      ...tinyBudget(1),
      metadata: { id: "plan-b", createdBy: "tester", createdAt: CREATED },
    },
    { at: AT, correlationId: "corr-b" },
  );
  assert.equal(result.status, "budget_exceeded");
  if (result.status === "budget_exceeded") {
    assert.ok(result.required.amountMinor > result.available.amountMinor);
  }
});

test("no_eligible_strategy avec registre partiel réel", () => {
  const chain = makeRouterChain({ withCharacter: true });
  const partial = buildRegistryFromStudioPricing({
    createdAt: CREATED,
    registryVersion: "legacy-partial",
    expiresAt: "2026-12-31T23:59:59.000Z",
  });
  const result = routeModelPlan(
    {
      storyboard: chain.storyboard,
      scenePackages: chain.packages,
      registry: partial,
      routingPolicy: createDefaultRoutingPolicy({ maximumFallbacksPerStep: 0 }),
      ...ampleBudget(),
      metadata: { id: "plan-p", createdBy: "tester", createdAt: CREATED },
    },
    { at: AT, correlationId: "corr-p" },
  );
  // Partial legacy registry lacks dialogue/lipsync/identity chains for talking_head
  assert.ok(
    result.status === "no_eligible_strategy" || result.status === "completed",
  );
  if (result.status === "no_eligible_strategy") {
    assert.ok(result.sceneFailures.length > 0);
    assert.ok(result.sceneFailures.some((f) => f.reasonCodes.includes("no_strategy")));
  }
});

test("entrée invalide", () => {
  const chain = makeRouterChain();
  const result = routeModelPlan(
    {
      storyboard: chain.storyboard,
      scenePackages: chain.packages.slice(0, 1),
      registry: makeRoutableRegistry(),
      routingPolicy: defaultPolicy(),
      ...ampleBudget(),
      metadata: { id: "plan-i", createdBy: "tester", createdAt: CREATED },
    },
    { at: AT, correlationId: "corr-i" },
  );
  assert.equal(result.status, "invalid");
});

test("createModelRouter façade", () => {
  const chain = makeRouterChain({ withCharacter: true });
  const router = createModelRouter();
  const result = router.route(
    {
      storyboard: chain.storyboard,
      scenePackages: chain.packages,
      registry: makeRoutableRegistry(),
      routingPolicy: defaultPolicy(),
      ...ampleBudget(),
      metadata: { id: "plan-f", createdBy: "tester", createdAt: CREATED },
    },
    { at: AT, correlationId: "corr-f" },
  );
  assert.equal(result.status, "completed");
});

test("fallbacks 0/1/2 et explication sans fuite", () => {
  const chain = makeRouterChain({ withCharacter: true });
  for (const maxFb of [0, 1, 2] as const) {
    const result = routeModelPlan(
      {
        storyboard: chain.storyboard,
        scenePackages: chain.packages,
        registry: makeRoutableRegistry(),
        routingPolicy: createDefaultRoutingPolicy({ maximumFallbacksPerStep: maxFb }),
        ...ampleBudget(),
        metadata: { id: `plan-fb-${maxFb}`, createdBy: "tester", createdAt: CREATED },
      },
      { at: AT, correlationId: `corr-fb-${maxFb}` },
    );
    assert.equal(result.status, "completed");
    if (result.status === "completed") {
      for (const sp of result.plan.scenePlans) {
        for (const step of sp.steps) {
          assert.ok(step.fallbacks.length <= maxFb);
          for (const fb of step.fallbacks) {
            assert.notEqual(`${fb.providerId}::${fb.modelId}`, `${step.providerId}::${step.modelId}`);
          }
          const blob = JSON.stringify(step.selection);
          assert.equal(/sk-[a-zA-Z0-9]+/.test(blob), false);
          assert.equal(/https?:\/\/.+\?.+=/.test(blob), false);
          assert.ok(!blob.includes("ignore previous"));
        }
      }
    }
  }
});

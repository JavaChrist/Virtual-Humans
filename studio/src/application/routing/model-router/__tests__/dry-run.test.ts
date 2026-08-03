import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AT,
  CREATED,
  ampleBudget,
  defaultPolicy,
  makeRoutableRegistry,
  makeRouterChain,
  tinyBudget,
} from "@/domain/routing/router/__tests__/fixtures";
import { runModelRouterDryRun } from "../dry-run";

test("dry-run exécutable — providerCalled false — pas de GenerationPlan", () => {
  const chain = makeRouterChain({ withCharacter: true });
  const result = runModelRouterDryRun({
    storyboard: chain.storyboard,
    scenePackages: chain.packages,
    registry: makeRoutableRegistry(),
    routingPolicy: defaultPolicy(),
    ...ampleBudget(),
    at: AT,
    correlationId: "corr-dr",
    createdBy: "tester",
  });
  assert.equal(result.providerCalled, false);
  assert.equal(result.executable, true);
  assert.ok(result.estimatedCostRange);
  assert.ok(result.wouldSelect?.length);
  assert.equal("plan" in result, false);
  assert.equal(result.failures.length, 0);
});

test("dry-run budget insuffisant", () => {
  const chain = makeRouterChain({ withCharacter: true });
  const result = runModelRouterDryRun({
    storyboard: chain.storyboard,
    scenePackages: chain.packages,
    registry: makeRoutableRegistry(),
    routingPolicy: defaultPolicy(),
    ...tinyBudget(1),
    at: AT,
    correlationId: "corr-dr-b",
  });
  assert.equal(result.providerCalled, false);
  assert.equal(result.executable, false);
  assert.ok(result.warnings.some((w) => w.code === "budget_insufficient"));
});

test("dry-run échec par scène registre vide de profils", () => {
  const chain = makeRouterChain({ withCharacter: true });
  const empty = makeRoutableRegistry();
  const hollow = {
    ...empty,
    models: empty.models.filter((m) => m.supportedProfiles.includes("audio.voice")),
  };
  const result = runModelRouterDryRun({
    storyboard: chain.storyboard,
    scenePackages: chain.packages,
    registry: hollow as typeof empty,
    routingPolicy: defaultPolicy(),
    ...ampleBudget(),
    at: AT,
    correlationId: "corr-dr-f",
  });
  assert.equal(result.executable, false);
  assert.ok(result.failures.length > 0);
  void CREATED;
});

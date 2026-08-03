import { money } from "@/domain/cost";
import type { GenerationPlan, GenerationStep, SceneGenerationPlan } from "@/domain/routing/router";
import { makeStep as genMakeStep } from "@/domain/generation/__tests__/fixtures";

export const AT = "2026-08-02T12:00:00.000Z";

export function makeStep(over: Partial<GenerationStep> = {}): GenerationStep {
  return genMakeStep(over);
}

export function makeScenePlan(over: Partial<SceneGenerationPlan> = {}): SceneGenerationPlan {
  const steps = over.steps ?? [makeStep()];
  return {
    sceneId: "sc-1",
    sceneOrder: 1,
    strategy: "direct_video",
    steps,
    estimatedCost: steps.reduce(
      (acc, s) => money(acc.amountMinor + s.estimate.total.amountMinor, "USD"),
      money(0, "USD")
    ),
    estimatedDurationSeconds: 5,
    rationale: {
      strategyId: "direct_video",
      summary: "test",
      reasons: [{ code: "eligible", message: "ok" }],
    },
    ...over,
  };
}

export function makePlan(over: Partial<GenerationPlan> = {}): GenerationPlan {
  const scenePlans = over.scenePlans ?? [makeScenePlan()];
  const estimatedCost = scenePlans.reduce(
    (acc, s) => money(acc.amountMinor + s.estimatedCost.amountMinor, "USD"),
    money(0, "USD")
  );
  return {
    id: "plan-1",
    projectId: "proj-1",
    schemaVersion: "1.0.0",
    revision: 1,
    createdAt: AT,
    createdBy: "tester",
    correlationId: "corr-1",
    artifactType: "generation_plan",
    storyboardRevisionId: "sb-1",
    scenePackageRevisionIds: ["pkg-1"],
    registryVersion: "registry.v1",
    policyVersion: "routing-policy.v1",
    currency: "USD",
    scenePlans,
    estimatedCost,
    estimatedDurationSeconds: 5,
    budgetDecision: {
      allowed: true,
      estimated: estimatedCost,
      availableAfter: money(10_000, "USD"),
    },
    rationale: {
      summary: "test",
      policyVersion: "routing-policy.v1",
      registryVersion: "registry.v1",
      decisions: scenePlans.map((s) => ({
        sceneId: s.sceneId,
        strategyId: s.strategy,
        summary: "ok",
      })),
    },
    warnings: [],
    ...over,
  };
}

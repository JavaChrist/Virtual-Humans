import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PRODUCTION_POLICY,
  createProductionRun,
  findReadySteps,
  findStepsToSkip,
  updateStepStatus,
  validateProductionPolicy,
} from "../index";
import { makePlan, makeScenePlan, makeStep } from "./fixtures";

test("scheduling — étape racine prête", () => {
  const plan = makePlan();
  const run = createProductionRun({
    id: "run-1",
    projectId: plan.projectId,
    plan,
    policy: DEFAULT_PRODUCTION_POLICY,
    createdAt: "2026-08-02T12:00:00.000Z",
    correlationId: "c1",
  });
  const ready = findReadySteps(run, plan, DEFAULT_PRODUCTION_POLICY);
  assert.equal(ready.length, 1);
  assert.equal(ready[0]!.stepId, plan.scenePlans[0]!.steps[0]!.id);
});

test("scheduling — dépendances et skipped", () => {
  const s1 = makeStep({ id: "s1", order: 1, dependsOnStepIds: [] });
  const s2 = makeStep({ id: "s2", order: 2, dependsOnStepIds: ["s1"] });
  const plan = makePlan({ scenePlans: [makeScenePlan({ steps: [s1, s2] })] });
  let run = createProductionRun({
    id: "run-1",
    projectId: plan.projectId,
    plan,
    policy: DEFAULT_PRODUCTION_POLICY,
    createdAt: "2026-08-02T12:00:00.000Z",
    correlationId: "c1",
  });
  assert.deepEqual(
    findReadySteps(run, plan, DEFAULT_PRODUCTION_POLICY).map((r) => r.stepId),
    ["s1"]
  );
  run = updateStepStatus(run, "s1", "ready", "2026-08-02T12:00:01.000Z");
  run = updateStepStatus(run, "s1", "reserved", "2026-08-02T12:00:02.000Z");
  run = updateStepStatus(run, "s1", "failed", "2026-08-02T12:00:03.000Z");
  assert.deepEqual(findStepsToSkip(run), ["s2"]);
});

test("scheduling — tri déterministe multi-scènes + parallélisme borné", () => {
  const plan = makePlan({
    scenePlans: [
      makeScenePlan({
        sceneId: "sc-2",
        sceneOrder: 2,
        steps: [makeStep({ id: "b1", order: 1 })],
      }),
      makeScenePlan({
        sceneId: "sc-1",
        sceneOrder: 1,
        steps: [makeStep({ id: "a1", order: 1 })],
      }),
    ],
  });
  const policy = validateProductionPolicy({
    ...DEFAULT_PRODUCTION_POLICY,
    maxConcurrentScenes: 2,
    maxConcurrentSteps: 1,
  });
  const run = createProductionRun({
    id: "run-1",
    projectId: plan.projectId,
    plan,
    policy,
    createdAt: "2026-08-02T12:00:00.000Z",
    correlationId: "c1",
  });
  const ready = findReadySteps(run, plan, policy);
  assert.equal(ready.length, 1);
  assert.equal(ready[0]!.stepId, "a1");
});

test("scheduling — cycle refusé", () => {
  const s1 = makeStep({ id: "s1", dependsOnStepIds: ["s2"] });
  const s2 = makeStep({ id: "s2", dependsOnStepIds: ["s1"] });
  const plan = makePlan({ scenePlans: [makeScenePlan({ steps: [s1, s2] })] });
  const run = createProductionRun({
    id: "run-1",
    projectId: plan.projectId,
    plan,
    policy: DEFAULT_PRODUCTION_POLICY,
    createdAt: "2026-08-02T12:00:00.000Z",
    correlationId: "c1",
  });
  assert.throws(() => findReadySteps(run, plan, DEFAULT_PRODUCTION_POLICY));
});

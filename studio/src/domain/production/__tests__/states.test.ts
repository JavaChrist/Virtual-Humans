import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STEP_RUN_TRANSITIONS,
  assertStepTransition,
  canTransitionStep,
  createProductionRun,
  deserializeProductionRun,
  serializeProductionRun,
  updateStepStatus,
  withRunUpdate,
  DEFAULT_PRODUCTION_POLICY,
} from "../index";
import { makePlan } from "./fixtures";

test("états — transitions valides et interdites", () => {
  assert.equal(canTransitionStep("pending", "ready"), true);
  assert.equal(canTransitionStep("pending", "executing"), false);
  assert.throws(() => assertStepTransition("completed", "failed"));
  assert.equal(canTransitionStep("ready", "ready"), true);
  assert.ok(STEP_RUN_TRANSITIONS.executing.includes("validating"));
});

test("états — révision incrémentée + sérialisable", () => {
  const plan = makePlan();
  let run = createProductionRun({
    id: "run-1",
    projectId: plan.projectId,
    plan,
    policy: DEFAULT_PRODUCTION_POLICY,
    createdAt: "2026-08-02T12:00:00.000Z",
    correlationId: "c1",
  });
  assert.equal(run.revision, 1);
  run = withRunUpdate(run, { status: "running" }, "2026-08-02T12:00:01.000Z");
  assert.equal(run.revision, 2);
  const stepId = run.scenes[0]!.steps[0]!.stepId;
  run = updateStepStatus(run, stepId, "ready", "2026-08-02T12:00:02.000Z");
  assert.equal(run.revision, 3);
  const json = serializeProductionRun(run);
  const back = deserializeProductionRun(json);
  assert.equal(back.id, run.id);
  assert.equal(back.revision, 3);
});

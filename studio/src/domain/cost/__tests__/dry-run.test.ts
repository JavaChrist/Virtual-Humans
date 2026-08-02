import assert from "node:assert/strict";
import { test } from "node:test";
import { createBudgetSnapshot } from "../budget";
import { runDryRun, type DryRunRequest } from "../dry-run";
import { buildCostEstimate } from "../estimate";
import { CostDomainError } from "../errors";
import { money } from "../money";

function estimate(totalMinor = 50) {
  return buildCostEstimate({
    id: "est_dry",
    projectId: "proj_dry",
    createdBy: "user_dry",
    correlationId: "corr-dry-run-0001",
    action: "video",
    quantity: 1,
    unit: "seconds",
    unitCost: money(totalMinor, "USD"),
    confidence: "medium",
    pricingVersion: "dry-v1",
  });
}

function budget(availableMinor = 1000) {
  return createBudgetSnapshot({
    limit: money(availableMinor, "USD"),
    reserved: money(0, "USD"),
    spent: money(0, "USD"),
  });
}

const baseReq: DryRunRequest = {
  mode: "dry-run",
  projectId: "proj_dry",
  action: "video",
  inputs: {
    refKinds: ["image", "character"],
    durationSeconds: 5,
    aspectRatio: "9:16",
  },
};

test("executable dry-run with providerCalled false", () => {
  const result = runDryRun(baseReq, {
    estimate: estimate(50),
    budget: budget(1000),
    capability: {
      action: "video",
      supported: true,
      requiredRefs: ["image"],
      allowedSeconds: [5, 10],
      allowedAspectRatios: ["9:16", "16:9"],
    },
  });
  assert.equal(result.executable, true);
  assert.equal(result.providerCalled, false);
  assert.equal(result.budgetDecision.allowed, true);
});

test("invalid mode throws", () => {
  assert.throws(
    () =>
      runDryRun({ ...baseReq, mode: "live" as "dry-run" }, {
        estimate: estimate(),
        budget: budget(),
      }),
    CostDomainError,
  );
});

test("missing required reference fails", () => {
  const result = runDryRun(
    { ...baseReq, inputs: { refKinds: ["character"], durationSeconds: 5 } },
    {
      estimate: estimate(),
      budget: budget(),
      capability: {
        action: "video",
        supported: true,
        requiredRefs: ["image"],
        allowedSeconds: [5],
      },
    },
  );
  assert.equal(result.executable, false);
  assert.ok(result.validations.some((v) => v.code === "reference_missing" && !v.passed));
  assert.equal(result.providerCalled, false);
});

test("incompatible capability fails", () => {
  const result = runDryRun(baseReq, {
    estimate: estimate(),
    budget: budget(),
    capability: { action: "video", supported: false },
  });
  assert.equal(result.executable, false);
  assert.ok(result.validations.some((v) => v.code === "capability_incompatible" && !v.passed));
});

test("insufficient budget fails", () => {
  const result = runDryRun(baseReq, {
    estimate: estimate(500),
    budget: budget(100),
    capability: { action: "video", supported: true, allowedSeconds: [5] },
  });
  assert.equal(result.executable, false);
  assert.equal(result.budgetDecision.allowed, false);
  assert.equal(result.providerCalled, false);
});

test("non-blocking warning when capability unspecified", () => {
  const result = runDryRun(baseReq, {
    estimate: estimate(10),
    budget: budget(1000),
  });
  assert.equal(result.executable, true);
  assert.ok(result.warnings.some((w) => w.code === "capability_unspecified"));
  assert.equal(result.providerCalled, false);
});

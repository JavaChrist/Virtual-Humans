import assert from "node:assert/strict";
import { test } from "node:test";
import { CostDomainError } from "../errors";
import {
  COST_ESTIMATE_SCHEMA_VERSION,
  assertEstimateCoherent,
  buildCostEstimate,
  type CostEstimate,
} from "../estimate";
import { money } from "../money";

const base = {
  id: "est_1",
  projectId: "proj_1",
  createdBy: "user_1",
  correlationId: "corr-estimate-001",
};

test("buildCostEstimate computes subtotal, margin and total", () => {
  const est = buildCostEstimate({
    ...base,
    action: "video",
    quantity: 5,
    unit: "seconds",
    unitCost: money(28, "USD"),
    margin: money(10, "USD"),
    confidence: "medium",
    pricingVersion: "test-v1",
    assumptions: ["unit test"],
    modelId: "test-model",
    providerId: "test-provider",
    validUntil: "2026-12-31T00:00:00.000Z",
  });
  assert.equal(est.subtotal.amountMinor, 140);
  assert.equal(est.margin.amountMinor, 10);
  assert.equal(est.total.amountMinor, 150);
  assert.equal(est.schemaVersion, COST_ESTIMATE_SCHEMA_VERSION);
  assert.equal(est.pricingVersion, "test-v1");
  assert.equal(est.validUntil, "2026-12-31T00:00:00.000Z");
  assert.deepEqual(est.assumptions, ["unit test"]);
});

test("zero quantity is allowed with zero subtotal", () => {
  const est = buildCostEstimate({
    ...base,
    action: "image",
    quantity: 0,
    unit: "images",
    unitCost: money(4, "USD"),
    confidence: "low",
    pricingVersion: "test-v1",
  });
  assert.equal(est.subtotal.amountMinor, 0);
  assert.equal(est.total.amountMinor, 0);
});

test("rejects invalid quantity and unit", () => {
  assert.throws(
    () =>
      buildCostEstimate({
        ...base,
        action: "image",
        quantity: -1,
        unit: "images",
        unitCost: money(1, "USD"),
        confidence: "high",
        pricingVersion: "v",
      }),
    CostDomainError,
  );
  assert.throws(
    () =>
      buildCostEstimate({
        ...base,
        action: "image",
        quantity: 1.5 as unknown as number,
        unit: "images",
        unitCost: money(1, "USD"),
        confidence: "high",
        pricingVersion: "v",
      }),
    CostDomainError,
  );
  assert.throws(
    () =>
      buildCostEstimate({
        ...base,
        action: "image",
        quantity: 2,
        unit: "flat",
        unitCost: money(1, "USD"),
        confidence: "high",
        pricingVersion: "v",
      }),
    CostDomainError,
  );
});

test("supports multiple units", () => {
  for (const unit of ["images", "seconds", "characters", "tokens", "minutes", "flat"] as const) {
    const est = buildCostEstimate({
      ...base,
      id: `est_${unit}`,
      action: unit === "characters" ? "voice" : unit === "images" || unit === "flat" ? "image" : "video",
      quantity: unit === "flat" ? 1 : 2,
      unit,
      unitCost: money(3, "USD"),
      confidence: "unknown",
      pricingVersion: "multi",
    });
    assert.equal(est.unit, unit);
  }
});

test("detects incoherent total vs components", () => {
  const est = buildCostEstimate({
    ...base,
    action: "image",
    quantity: 2,
    unit: "images",
    unitCost: money(10, "USD"),
    confidence: "exact",
    pricingVersion: "v",
  });
  const broken = { ...est, total: money(999, "USD") } as CostEstimate;
  assert.throws(() => assertEstimateCoherent(broken), CostDomainError);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LEGACY_PRICING_VERSION,
  fromLegacyUsdEstimate,
  toLegacyEstimateResponse,
} from "../legacy";
import { CostDomainError } from "../errors";

const ids = {
  id: "est_legacy",
  projectId: "proj_1",
  createdBy: "user_1",
  correlationId: "corr-legacy-00001",
};

test("fromLegacyUsdEstimate converts USD float with remainder in margin", () => {
  const est = fromLegacyUsdEstimate({
    ...ids,
    action: "video",
    usd: 1.4,
    quantity: 5,
    modelId: "fal-ai/example",
    providerId: "fal",
  });
  // 1.40 USD = 140 cents; 140 / 5 = 28 exactly
  assert.equal(est.unitCost.amountMinor, 28);
  assert.equal(est.subtotal.amountMinor, 140);
  assert.equal(est.margin.amountMinor, 0);
  assert.equal(est.total.amountMinor, 140);
  assert.equal(est.pricingVersion, LEGACY_PRICING_VERSION);
  assert.ok(est.assumptions.length >= 1);
});

test("fromLegacyUsdEstimate places division remainder in margin", () => {
  const est = fromLegacyUsdEstimate({
    ...ids,
    action: "image",
    usd: 0.1,
    quantity: 3,
  });
  // 10 cents / 3 = 3 per unit, remainder 1 in margin
  assert.equal(est.unitCost.amountMinor, 3);
  assert.equal(est.subtotal.amountMinor, 9);
  assert.equal(est.margin.amountMinor, 1);
  assert.equal(est.total.amountMinor, 10);
});

test("rejectZeroWithModel surfaces estimation_impossible", () => {
  assert.throws(
    () =>
      fromLegacyUsdEstimate({
        ...ids,
        action: "video",
        usd: 0,
        quantity: 5,
        modelId: "unknown-model",
        rejectZeroWithModel: true,
      }),
    (e: unknown) => e instanceof CostDomainError && e.code === "estimation_impossible",
  );
});

test("toLegacyEstimateResponse matches /api/estimate shape", () => {
  const est = fromLegacyUsdEstimate({
    ...ids,
    action: "voice",
    usd: 0.15,
    quantity: 1000,
  });
  const res = toLegacyEstimateResponse(est, "voice", { credits: 1000 });
  assert.deepEqual(res, { type: "voice", usd: 0.15, currency: "USD", credits: 1000 });
});

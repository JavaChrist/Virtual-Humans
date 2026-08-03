import assert from "node:assert/strict";
import { test } from "node:test";
import { fromDecimalAmount, money } from "@/domain/cost";
import {
  CapabilityDomainError,
  evaluateEligibility,
  validatePricing,
} from "../index";
import { AT, makeModel } from "./fixtures";
import type { CapabilityRequirements } from "../requirements";

test("coût par image / seconde / requête", () => {
  for (const unit of ["image", "second", "request"] as const) {
    const p = validatePricing({
      id: `p-${unit}`,
      unit,
      unitCost: money(25, "USD"),
      conditions: [],
      pricingVersion: "v1",
      source: "legacy_catalog",
      confidence: "medium",
    });
    assert.equal(p.unit, unit);
    assert.equal(p.unitCost.amountMinor, 25);
  }
});

test("montant négatif ou flottant refusé côté Money", () => {
  assert.throws(() => money(-1, "USD"));
  assert.throws(() => money(1.5, "USD"));
});

test("minimum charge et devise explicite", () => {
  const p = validatePricing({
    id: "p-min",
    unit: "minute",
    unitCost: money(100, "USD"),
    minimumCharge: money(50, "USD"),
    conditions: [],
    pricingVersion: "v1",
    source: "manual",
    confidence: "exact",
  });
  assert.equal(p.minimumCharge?.amountMinor, 50);
  assert.equal(p.unitCost.currency, "USD");
});

test("tarification expirée bloque si pricingRequired", () => {
  const m = makeModel({
    providerId: "fal",
    modelId: "m1",
    pricing: [
      {
        id: "old",
        unit: "second",
        unitCost: money(10, "USD"),
        conditions: [],
        pricingVersion: "v1",
        source: "legacy_catalog",
        confidence: "medium",
        validUntil: "2020-01-01T00:00:00.000Z",
      },
    ],
  });
  const req: CapabilityRequirements = {
    sceneId: "s1",
    requiredProfiles: ["video.text_to_video"],
    mediaInputs: ["text"],
    expectedOutput: "video",
    aspectRatio: "9:16",
    durationSeconds: 6,
    requiredReferences: [],
    needsDialogue: false,
    needsNativeAudio: false,
    characterCount: 0,
    identityPriority: "low",
    pricingRequired: true,
  };
  const r = evaluateEligibility(m, req, AT);
  assert.equal(r.eligible, false);
});

test("confiance inconnue acceptée en pricing + conversion legacy half-up", () => {
  const converted = fromDecimalAmount(0.155, "USD", { decimals: 2, round: "half_up" });
  assert.equal(converted.amountMinor, 16);
  const p = validatePricing({
    id: "unk",
    unit: "thousand_tokens",
    unitCost: converted,
    conditions: [],
    pricingVersion: "legacy-pricing-usd-v1",
    source: "legacy_catalog",
    confidence: "unknown",
  });
  assert.equal(p.confidence, "unknown");
});

test("unité invalide refusée", () => {
  assert.throws(
    () =>
      validatePricing({
        id: "x",
        unit: "banana",
        unitCost: money(1, "USD"),
        conditions: [],
        pricingVersion: "v1",
        source: "manual",
        confidence: "high",
      }),
    CapabilityDomainError,
  );
});

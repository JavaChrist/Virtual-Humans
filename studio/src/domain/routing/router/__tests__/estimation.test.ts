import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import {
  estimateStepCost,
  RoutingDomainError,
  sumEstimates,
} from "../index";
import { AT, CREATED, makeRoutableRegistry } from "./fixtures";

function ctx(over: Record<string, unknown> = {}) {
  return {
    projectId: "proj-1",
    sceneId: "sc-1",
    stepId: "step:sc-1:direct_video:1:video.text_to_video",
    action: "video" as const,
    durationSeconds: 8,
    characterCount: 1200,
    at: AT,
    correlationId: "c1",
    createdBy: "tester",
    createdAt: CREATED,
    role: "primary" as const,
    requireFirmPricing: true,
    rejectUnknownPricingConfidence: false,
    ...over,
  };
}

test("vidéo / image / voix / lipsync / carousel", () => {
  const reg = makeRoutableRegistry();
  const t2v = estimateStepCost(reg.models.find((m) => m.modelId === "t2v")!, ctx());
  assert.equal(t2v.estimate.quantity, 8);
  assert.equal(t2v.estimate.total.amountMinor, 64); // 8s × 8 minor

  const img = estimateStepCost(
    reg.models.find((m) => m.modelId === "tti")!,
    ctx({ action: "image", stepId: "step-img" }),
  );
  assert.equal(img.estimate.quantity, 1);

  const voice = estimateStepCost(
    reg.models.find((m) => m.modelId === "voice-1")!,
    ctx({ action: "voice", stepId: "step-voice" }),
  );
  assert.equal(voice.estimate.quantity, 2); // ceil(1200/1000)

  const lipsync = estimateStepCost(
    reg.models.find((m) => m.modelId === "lipsync-1")!,
    ctx({ action: "lipsync", stepId: "step-ls", durationSeconds: 30 }),
  );
  assert.equal(lipsync.estimate.quantity, 1); // ceil(30/60)

  const car = estimateStepCost(
    reg.models.find((m) => m.modelId === "carousel-1")!,
    ctx({ action: "carousel", stepId: "step-car" }),
  );
  assert.equal(car.estimate.action, "carousel");
});

test("minimum charge + addition", () => {
  const reg = makeRoutableRegistry();
  const model = {
    ...reg.models.find((m) => m.modelId === "tti")!,
    pricing: [
      {
        id: "min",
        unit: "image" as const,
        unitCost: money(1, "USD"),
        minimumCharge: money(50, "USD"),
        conditions: [],
        pricingVersion: "v1",
        source: "manual" as const,
        confidence: "exact" as const,
      },
    ],
  };
  const est = estimateStepCost(model, ctx({ action: "image", stepId: "min" }));
  assert.equal(est.estimate.total.amountMinor, 50);

  const sum = sumEstimates([est.estimate, est.estimate]);
  assert.equal(sum.amountMinor, 100);
});

test("pricing expiré / unité incompatible", () => {
  const reg = makeRoutableRegistry();
  const expired = {
    ...reg.models.find((m) => m.modelId === "t2v")!,
    pricing: [
      {
        id: "old",
        unit: "second" as const,
        unitCost: money(10, "USD"),
        conditions: [],
        pricingVersion: "v1",
        source: "manual" as const,
        confidence: "high" as const,
        validUntil: "2020-01-01T00:00:00.000Z",
      },
    ],
  };
  assert.throws(() => estimateStepCost(expired, ctx()), RoutingDomainError);
});

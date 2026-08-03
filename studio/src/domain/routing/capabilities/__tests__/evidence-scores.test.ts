import assert from "node:assert/strict";
import { test } from "node:test";
import { ModelCapabilitiesSchema, buildRegistrySnapshot } from "../index";
import { CREATED, makeModel, makeProvider } from "./fixtures";

test("score valide avec preuve", () => {
  const m = makeModel({
    providerId: "fal",
    modelId: "m1",
    quality: { quality: 80 },
    evidence: [
      {
        field: "quality.quality",
        source: "manual",
        reference: "manual-calibration",
        confidence: "low",
      },
      {
        field: "supportedProfiles",
        source: "manual",
        reference: "fixture",
        confidence: "high",
      },
    ],
  });
  assert.equal(ModelCapabilitiesSchema.safeParse(m).success, true);
});

test("score hors plage / sans preuve refusés", () => {
  assert.equal(
    ModelCapabilitiesSchema.safeParse(
      makeModel({
        providerId: "fal",
        modelId: "m1",
        quality: { quality: 101 },
        evidence: [
          {
            field: "quality.quality",
            source: "manual",
            reference: "x",
            confidence: "low",
          },
        ],
      }),
    ).success,
    false,
  );
  assert.equal(
    ModelCapabilitiesSchema.safeParse(
      makeModel({
        providerId: "fal",
        modelId: "m1",
        quality: { identity: 50 },
        evidence: [
          {
            field: "supportedProfiles",
            source: "manual",
            reference: "x",
            confidence: "high",
          },
        ],
      }),
    ).success,
    false,
  );
});

test("absence de score acceptée — builder n'invente pas", () => {
  const snap = buildRegistrySnapshot({
    providers: [makeProvider({ id: "fal" })],
    models: [makeModel({ providerId: "fal", modelId: "m1", quality: {} })],
    createdAt: CREATED,
    registryVersion: "v1",
  });
  assert.deepEqual(snap.models[0]!.quality, {});
});

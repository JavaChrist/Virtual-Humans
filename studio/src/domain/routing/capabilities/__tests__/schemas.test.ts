import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import {
  CapabilityRegistrySnapshotSchema,
  ModelCapabilitiesSchema,
  ProviderDefinitionSchema,
  validateRegistrySnapshot,
  CapabilityDomainError,
  buildRegistrySnapshot,
  assertSerializable,
} from "../index";
import { AT, CREATED, EXPIRES, makeModel, makeProvider, makeTestSnapshot } from "./fixtures";

test("provider et modèle valides", () => {
  assert.equal(ProviderDefinitionSchema.safeParse(makeProvider({ id: "fal" })).success, true);
  assert.equal(
    ModelCapabilitiesSchema.safeParse(makeModel({ providerId: "fal", modelId: "m1" })).success,
    true,
  );
});

test("identifiants vides refusés", () => {
  assert.equal(ProviderDefinitionSchema.safeParse(makeProvider({ id: "" })).success, false);
  assert.equal(
    ModelCapabilitiesSchema.safeParse(makeModel({ providerId: "fal", modelId: "" })).success,
    false,
  );
});

test("doublons provider/model refusés", () => {
  assert.throws(
    () =>
      buildRegistrySnapshot({
        providers: [makeProvider({ id: "fal" }), makeProvider({ id: "fal" })],
        models: [makeModel({ providerId: "fal", modelId: "m1" })],
        createdAt: CREATED,
        registryVersion: "v1",
      }),
    CapabilityDomainError,
  );
  assert.throws(
    () =>
      buildRegistrySnapshot({
        providers: [makeProvider({ id: "fal" })],
        models: [
          makeModel({ providerId: "fal", modelId: "m1" }),
          makeModel({ providerId: "fal", modelId: "m1" }),
        ],
        createdAt: CREATED,
        registryVersion: "v1",
      }),
    CapabilityDomainError,
  );
});

test("modèle orphelin refusé", () => {
  assert.throws(
    () =>
      buildRegistrySnapshot({
        providers: [makeProvider({ id: "fal" })],
        models: [makeModel({ providerId: "openai", modelId: "x" })],
        createdAt: CREATED,
        registryVersion: "v1",
      }),
    (e: unknown) => e instanceof CapabilityDomainError && e.code === "orphan_model",
  );
});

test("dates invalides / expiresAt ≤ createdAt", () => {
  assert.equal(
    CapabilityRegistrySnapshotSchema.safeParse({
      schemaVersion: "1.0.0",
      registryVersion: "v1",
      createdAt: "not-a-date",
      providers: [],
      models: [],
    }).success,
    false,
  );
  assert.throws(
    () =>
      buildRegistrySnapshot({
        providers: [makeProvider({ id: "fal" })],
        models: [makeModel({ providerId: "fal", modelId: "m1" })],
        createdAt: EXPIRES,
        expiresAt: CREATED,
        registryVersion: "v1",
      }),
    CapabilityDomainError,
  );
});

test("round-trip JSON", () => {
  const snap = makeTestSnapshot();
  const again = validateRegistrySnapshot(JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(again, snap);
});

test("valeurs non sérialisables refusées", () => {
  assert.throws(
    () => assertSerializable({ fn: () => undefined }),
    CapabilityDomainError,
  );
});

test("money pricing dans modèle", () => {
  const m = makeModel({
    providerId: "fal",
    modelId: "m1",
    pricing: [
      {
        id: "p1",
        unit: "request",
        unitCost: money(0, "USD"),
        conditions: [],
        pricingVersion: "v1",
        source: "unknown",
        confidence: "unknown",
      },
    ],
  });
  assert.equal(ModelCapabilitiesSchema.safeParse(m).success, true);
  void AT;
});

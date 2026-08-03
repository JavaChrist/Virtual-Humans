import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRegistrySnapshot,
  findModel,
  findProvider,
  listModelsForProfile,
} from "../index";
import { CREATED, EXPIRES, makeModel, makeProvider, makeTestSnapshot } from "./fixtures";

test("ordre déterministe et immutabilité", () => {
  const a = buildRegistrySnapshot({
    providers: [makeProvider({ id: "openai" }), makeProvider({ id: "fal" })],
    models: [
      makeModel({ providerId: "openai", modelId: "b" }),
      makeModel({ providerId: "fal", modelId: "a" }),
      makeModel({ providerId: "fal", modelId: "z" }),
    ],
    createdAt: CREATED,
    registryVersion: "v1",
    expiresAt: EXPIRES,
  });
  const b = buildRegistrySnapshot({
    providers: [makeProvider({ id: "fal" }), makeProvider({ id: "openai" })],
    models: [
      makeModel({ providerId: "fal", modelId: "z" }),
      makeModel({ providerId: "openai", modelId: "b" }),
      makeModel({ providerId: "fal", modelId: "a" }),
    ],
    createdAt: CREATED,
    registryVersion: "v1",
    expiresAt: EXPIRES,
  });
  assert.deepEqual(a, b);
  assert.equal(a.providers[0]!.id, "fal");
  assert.throws(() => {
    (a.providers as { id: string }[])[0]!.id = "x";
  });
});

test("lookup et liste par profil", () => {
  const snap = makeTestSnapshot();
  assert.ok(findProvider(snap, "fal"));
  assert.ok(findModel(snap, "fal", "test-t2v"));
  const list = listModelsForProfile(snap, "video.text_to_video");
  assert.ok(list.some((m) => m.modelId === "test-t2v"));
  assert.equal(
    listModelsForProfile(snap, "motion.carousel").length,
    0,
  );
});

test("même entrée → même snapshot", () => {
  const input = {
    providers: [makeProvider({ id: "fal" })],
    models: [makeModel({ providerId: "fal", modelId: "m1" })],
    createdAt: CREATED,
    registryVersion: "reg-1",
    expiresAt: EXPIRES,
  };
  assert.deepEqual(buildRegistrySnapshot(input), buildRegistrySnapshot(input));
});

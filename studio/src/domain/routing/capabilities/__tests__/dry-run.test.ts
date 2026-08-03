import assert from "node:assert/strict";
import { test } from "node:test";
import { runRegistryDryRun, buildRegistrySnapshot } from "../index";
import {
  AT,
  CREATED,
  EXPIRES,
  makeModel,
  makeProvider,
  makeScenePackageChain,
  makeTestSnapshot,
} from "./fixtures";
import { deriveCapabilityRequirements } from "../requirements";

test("plusieurs modèles éligibles / raisons / providerCalled false", () => {
  const chain = makeScenePackageChain();
  const pkg = chain.packages[0]!;
  const requirements = deriveCapabilityRequirements(pkg, chain.storyboard);

  const snap = buildRegistrySnapshot({
    providers: [makeProvider({ id: "fal", status: "available" })],
    models: [
      makeModel({
        providerId: "fal",
        modelId: "a",
        supportedProfiles: requirements.requiredProfiles.slice(0, 1),
        mediaOutputs: [requirements.expectedOutput === "image" ? "image" : "video"],
        supportedAspectRatios: [requirements.aspectRatio, "16:9", "1:1"],
        duration: {
          minimumSeconds: 0.01,
          maximumSeconds: 120,
        },
        references: {
          characterIdentity: true,
          startFrame: true,
          referenceImages: true,
        },
        audio: {
          nativeDialogue: true,
          lipsync: true,
          inputAudio: true,
          nativeAudioOutput: true,
          voiceOver: true,
        },
        characters: { multiCharacter: true, maxCharacters: 4, identityPreservation: true },
      }),
      makeModel({
        providerId: "fal",
        modelId: "disabled",
        enabled: false,
        supportedProfiles: requirements.requiredProfiles,
        mediaOutputs: ["video", "image", "carousel"],
      }),
    ],
    createdAt: CREATED,
    registryVersion: "v1",
    expiresAt: EXPIRES,
  });

  const result = runRegistryDryRun(snap, requirements, AT);
  assert.equal(result.providerCalled, false);
  assert.equal(result.snapshotValid, true);
  assert.ok(result.eligibleModels.some((m) => m.modelId === "a"));
  assert.ok(result.results.some((r) => r.modelId === "disabled" && !r.eligible));
  assert.equal("ranking" in result, false);
  assert.equal("generationPlan" in result, false);
});

test("aucun modèle éligible", () => {
  const chain = makeScenePackageChain();
  const requirements = deriveCapabilityRequirements(chain.packages[0]!, chain.storyboard);
  const snap = makeTestSnapshot([
    makeModel({
      providerId: "fal",
      modelId: "voice-only",
      supportedProfiles: ["audio.voice"],
      mediaOutputs: ["audio"],
      duration: {},
    }),
  ]);
  const result = runRegistryDryRun(snap, requirements, AT);
  assert.equal(result.eligibleModels.length, 0);
  assert.ok(result.results.every((r) => !r.eligible));
});

test("snapshot expiré / invalide", () => {
  const chain = makeScenePackageChain();
  const requirements = deriveCapabilityRequirements(chain.packages[0]!, chain.storyboard);
  const expired = buildRegistrySnapshot({
    providers: [makeProvider({ id: "fal" })],
    models: [makeModel({ providerId: "fal", modelId: "m1" })],
    createdAt: CREATED,
    registryVersion: "v1",
    // After createdAt, before evaluation `AT` → snapshotExpired without invalid schema
    expiresAt: "2026-08-02T11:00:00.000Z",
  });
  const r = runRegistryDryRun(expired, requirements, AT);
  assert.equal(r.snapshotExpired, true);
  assert.equal(r.providerCalled, false);

  const invalid = runRegistryDryRun(
    { ...expired, providers: [] } as typeof expired,
    requirements,
    AT,
  );
  // models orphan → invalid schema
  assert.equal(invalid.snapshotValid, false);
});

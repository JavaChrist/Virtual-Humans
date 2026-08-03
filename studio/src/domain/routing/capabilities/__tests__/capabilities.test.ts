import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluateEligibility,
  supportsCapabilityProfile,
} from "../index";
import { AT, makeModel, makeProvider } from "./fixtures";
import type { CapabilityRequirements } from "../requirements";

function baseReq(overrides: Partial<CapabilityRequirements> = {}): CapabilityRequirements {
  return {
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
    ...overrides,
  };
}

test("profil supporté / inconnu", () => {
  const m = makeModel({
    providerId: "fal",
    modelId: "m1",
    supportedProfiles: ["video.text_to_video"],
  });
  assert.equal(supportsCapabilityProfile(m, "video.text_to_video"), true);
  assert.equal(supportsCapabilityProfile(m, "video.dialogue"), false);
});

test("ratio et durée", () => {
  const m = makeModel({
    providerId: "fal",
    modelId: "m1",
    supportedAspectRatios: ["16:9"],
    duration: { minimumSeconds: 4, maximumSeconds: 8, supportedValuesSeconds: [4, 6, 8] },
  });
  const badRatio = evaluateEligibility(m, baseReq({ aspectRatio: "9:16" }), AT);
  assert.equal(badRatio.eligible, false);
  const ok = evaluateEligibility(m, baseReq({ aspectRatio: "16:9", durationSeconds: 6 }), AT);
  assert.equal(ok.eligible, true);
  const tooLong = evaluateEligibility(m, baseReq({ aspectRatio: "16:9", durationSeconds: 20 }), AT);
  assert.equal(tooLong.eligible, false);
});

test("références / dialogue / audio / personnages / région", () => {
  const m = makeModel({
    providerId: "fal",
    modelId: "m1",
    supportedProfiles: ["video.dialogue", "video.image_to_video"],
    references: { characterIdentity: true, startFrame: true, referenceImages: true },
    audio: { nativeDialogue: true, nativeAudioOutput: true },
    characters: { multiCharacter: true, maxCharacters: 2 },
    regions: ["eu"],
    mediaInputs: ["text", "start_frame"],
  });
  const ok = evaluateEligibility(
    m,
    baseReq({
      requiredProfiles: ["video.dialogue"],
      needsDialogue: true,
      characterCount: 2,
      identityPriority: "high",
      mediaInputs: ["text", "start_frame"],
      region: "eu",
    }),
    AT,
  );
  assert.equal(ok.eligible, true);

  const noMulti = evaluateEligibility(
    { ...m, characters: { multiCharacter: false } },
    baseReq({
      requiredProfiles: ["video.dialogue"],
      needsDialogue: true,
      characterCount: 2,
      identityPriority: "high",
    }),
    AT,
  );
  assert.equal(noMulti.eligible, false);

  const badRegion = evaluateEligibility(
    m,
    baseReq({
      requiredProfiles: ["video.dialogue"],
      needsDialogue: true,
      region: "us",
    }),
    AT,
  );
  assert.equal(badRegion.eligible, false);
});

test("champs inconnus non interprétés comme vrais", () => {
  const m = makeModel({
    providerId: "fal",
    modelId: "m1",
    supportedProfiles: ["video.dialogue"],
    references: {},
    audio: {},
    characters: {},
  });
  const r = evaluateEligibility(
    m,
    baseReq({
      requiredProfiles: ["video.dialogue"],
      needsDialogue: true,
      identityPriority: "high",
      requiredReferences: [{ kind: "character", required: true }],
    }),
    AT,
    makeProvider({ id: "fal" }),
  );
  assert.equal(r.eligible, false);
  if (!r.eligible) {
    assert.ok(r.reasons.some((x) => x.code === "critical_unknown"));
  }
});

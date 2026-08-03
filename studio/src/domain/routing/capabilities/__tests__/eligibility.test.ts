import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import { evaluateEligibility } from "../index";
import { AT, makeModel, makeProvider } from "./fixtures";
import type { CapabilityRequirements } from "../requirements";

function req(over: Partial<CapabilityRequirements> = {}): CapabilityRequirements {
  return {
    sceneId: "s1",
    requiredProfiles: ["video.image_to_video"],
    mediaInputs: ["text", "start_frame"],
    expectedOutput: "video",
    aspectRatio: "9:16",
    durationSeconds: 5,
    requiredReferences: [{ kind: "character", required: true }],
    needsDialogue: false,
    needsNativeAudio: false,
    characterCount: 1,
    identityPriority: "high",
    pricingRequired: true,
    ...over,
  };
}

const eligibleModel = () =>
  makeModel({
    providerId: "fal",
    modelId: "good",
    supportedProfiles: ["video.image_to_video", "image.reference_identity"],
    mediaInputs: ["text", "image", "start_frame"],
    mediaOutputs: ["video"],
    supportedAspectRatios: ["9:16", "16:9", "1:1"],
    duration: { minimumSeconds: 1, maximumSeconds: 10, supportedValuesSeconds: [5, 10] },
    references: {
      startFrame: true,
      referenceImages: true,
      characterIdentity: true,
    },
    characters: { maxCharacters: 1, identityPreservation: true },
    regions: ["global"],
  });

test("modèle pleinement éligible", () => {
  const r = evaluateEligibility(
    eligibleModel(),
    req(),
    AT,
    makeProvider({ id: "fal", status: "available" }),
  );
  assert.equal(r.eligible, true);
});

test("modèle désactivé / provider indisponible", () => {
  assert.equal(
    evaluateEligibility({ ...eligibleModel(), enabled: false }, req(), AT).eligible,
    false,
  );
  assert.equal(
    evaluateEligibility(
      eligibleModel(),
      req(),
      AT,
      makeProvider({ id: "fal", status: "unavailable" }),
    ).eligible,
    false,
  );
});

test("capacité absente / info critique inconnue", () => {
  assert.equal(
    evaluateEligibility(
      { ...eligibleModel(), supportedProfiles: ["audio.voice"] },
      req(),
      AT,
    ).eligible,
    false,
  );
  assert.equal(
    evaluateEligibility(
      {
        ...eligibleModel(),
        references: { startFrame: true, referenceImages: true },
      },
      req(),
      AT,
    ).eligible,
    false,
  );
});

test("ratio / durée / référence / région / pricing", () => {
  assert.equal(
    evaluateEligibility(eligibleModel(), req({ aspectRatio: "1:1" }), AT).eligible,
    true,
  );
  assert.equal(
    evaluateEligibility(
      { ...eligibleModel(), supportedAspectRatios: ["16:9"] },
      req({ aspectRatio: "9:16" }),
      AT,
    ).eligible,
    false,
  );
  assert.equal(
    evaluateEligibility(eligibleModel(), req({ durationSeconds: 50 }), AT).eligible,
    false,
  );
  assert.equal(
    evaluateEligibility(
      eligibleModel(),
      req({ region: "eu" }),
      AT,
    ).eligible,
    true,
  );
  assert.equal(
    evaluateEligibility(
      { ...eligibleModel(), regions: ["us"] },
      req({ region: "eu" }),
      AT,
    ).eligible,
    false,
  );
  assert.equal(
    evaluateEligibility({ ...eligibleModel(), pricing: [] }, req(), AT).eligible,
    false,
  );
});

test("warning sur préférence inconnue — aucune sélection", () => {
  const r = evaluateEligibility(
    { ...eligibleModel(), quality: {}, status: "unknown" },
    req(),
    AT,
    makeProvider({ id: "fal", status: "unknown" }),
  );
  assert.equal(r.eligible, true);
  assert.ok(r.warnings.some((w) => w.code === "status_unknown" || w.code === "score_unknown"));
  // filter returns eligibility only — no ranking field
  assert.equal("selected" in r, false);
  void money;
});

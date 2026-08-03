import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildRegistryFromLegacyPricing,
  buildCapabilityRegistry,
  buildRegistryFromStudioPricing,
} from "../index";
import { CapabilityDomainError } from "@/domain/routing/capabilities";
import { VIDEO_MODELS, LIPSYNC_MODELS } from "@/lib/pricing";

const CREATED = "2026-08-02T10:00:00.000Z";

test("mapping réel du catalogue + prix converti", () => {
  const snap = buildRegistryFromLegacyPricing({
    createdAt: CREATED,
    registryVersion: "legacy-1",
    videoModels: VIDEO_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      mode: m.mode,
      audio: m.audio,
      usdPerSecond: m.usdPerSecond,
      seconds: [...m.seconds],
      aspectRatios: [...m.aspectRatios],
    })),
    lipsyncModels: LIPSYNC_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      usdPerMinute: m.usdPerMinute,
    })),
    imagePrices: {
      "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
    },
    elevenLabsUsdPer1kChars: 0.15,
    sceneImageUsd: 0.05,
  });

  assert.ok(snap.providers.some((p) => p.id === "fal"));
  assert.ok(snap.models.some((m) => m.modelId === "gpt-image-1"));
  assert.ok(snap.models.some((m) => m.modelId === "eleven_multilingual_v2"));
  assert.ok(snap.models.some((m) => m.modelId === VIDEO_MODELS[0]!.id));

  const veo = snap.models.find((m) => m.modelId === "fal-ai/veo3.1/fast");
  assert.ok(veo);
  assert.deepEqual(veo!.supportedProfiles, ["video.text_to_video"]);
  assert.equal(veo!.audio.nativeAudioOutput, true);
  assert.equal(veo!.audio.nativeDialogue, undefined); // not deduced
  assert.equal(veo!.pricing[0]!.source, "legacy_catalog");
  assert.equal(veo!.pricing[0]!.unitCost.currency, "USD");
  assert.ok(Number.isInteger(veo!.pricing[0]!.unitCost.amountMinor));

  // no invented multi-character / dialogue from labels
  for (const m of snap.models) {
    assert.equal(m.characters.multiCharacter, undefined);
    assert.notEqual(m.audio.nativeDialogue, true);
  }
});

test("modèle sans capacité inventée + erreur de conversion", () => {
  assert.throws(
    () =>
      buildRegistryFromLegacyPricing({
        createdAt: CREATED,
        registryVersion: "x",
        videoModels: [],
        lipsyncModels: [],
        imagePrices: { "1024x1024": { low: -1 } },
        elevenLabsUsdPer1kChars: 0.15,
      }),
    (e: unknown) => e instanceof CapabilityDomainError && e.code === "conversion_error",
  );
});

test("buildRegistryFromStudioPricing déterministe (même process)", () => {
  const a = buildRegistryFromStudioPricing({
    createdAt: CREATED,
    registryVersion: "studio-1",
  });
  const b = buildRegistryFromStudioPricing({
    createdAt: CREATED,
    registryVersion: "studio-1",
  });
  assert.deepEqual(a, b);
  assert.ok(a.models.length >= 8);
});

test("builder refuse collision externalModelId", () => {
  assert.throws(
    () =>
      buildCapabilityRegistry({
        providers: [
          {
            id: "fal",
            displayName: "fal",
            adapterKind: "fal",
            enabled: true,
            regions: ["unknown"],
            supportsIdempotency: false,
            supportsCancellation: false,
            supportsWebhooks: false,
            status: "unknown",
          },
        ],
        models: [
          {
            providerId: "fal",
            modelId: "a",
            externalModelId: "same",
            displayName: "A",
            enabled: true,
            status: "unknown",
            supportedProfiles: ["video.text_to_video"],
            mediaInputs: ["text"],
            mediaOutputs: ["video"],
            supportedAspectRatios: ["9:16"],
            duration: {},
            references: {},
            audio: {},
            characters: {},
            limits: {},
            pricing: [],
            quality: {},
            regions: ["unknown"],
            evidence: [],
          },
          {
            providerId: "fal",
            modelId: "b",
            externalModelId: "same",
            displayName: "B",
            enabled: true,
            status: "unknown",
            supportedProfiles: ["video.text_to_video"],
            mediaInputs: ["text"],
            mediaOutputs: ["video"],
            supportedAspectRatios: ["9:16"],
            duration: {},
            references: {},
            audio: {},
            characters: {},
            limits: {},
            pricing: [],
            quality: {},
            regions: ["unknown"],
            evidence: [],
          },
        ],
        createdAt: CREATED,
        registryVersion: "v1",
      }),
    CapabilityDomainError,
  );
});

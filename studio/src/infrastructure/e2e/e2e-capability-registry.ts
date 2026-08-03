/**
 * Capability Registry synthétique pour DIRECTOR_V2_E2E_FAKE_MODE (Phase 8).
 * Injecté via le port `buildRegistry` — n'altère pas le registry Studio réel.
 */

import { money } from "@/domain/cost";
import {
  buildRegistrySnapshot,
  type CapabilityRegistrySnapshot,
  type ModelCapabilities,
  type ProviderDefinition,
} from "@/domain/routing/capabilities";

const EXPIRES = "2099-12-31T23:59:59.000Z";

function provider(id: string): ProviderDefinition {
  return {
    id,
    displayName: id,
    adapterKind: "test",
    enabled: true,
    regions: ["global"],
    supportsIdempotency: false,
    supportsCancellation: false,
    supportsWebhooks: false,
    status: "available",
  };
}

function price(
  id: string,
  unit: "image" | "second" | "minute" | "thousand_tokens",
  minor: number,
) {
  return {
    id,
    unit,
    unitCost: money(minor, "USD"),
    conditions: [],
    pricingVersion: "e2e-v1",
    source: "manual" as const,
    confidence: "high" as const,
  };
}

function evidence(
  field: string,
  confidence: "high" | "medium" | "low" | "verified" = "verified",
) {
  return {
    field,
    source: "manual" as const,
    reference: "e2e-synthetic",
    confidence,
  };
}

/**
 * Registry routable déterministe couvrant les profils Director courants.
 */
export function buildE2eSyntheticCapabilityRegistry(options: {
  createdAt: string;
  registryVersion: string;
}): CapabilityRegistrySnapshot {
  const models: ModelCapabilities[] = [
    {
      providerId: "fal",
      modelId: "e2e-id-image",
      displayName: "E2E identity image",
      enabled: true,
      status: "available",
      supportedProfiles: ["image.reference_identity"],
      mediaInputs: ["text", "image", "reference_image"],
      mediaOutputs: ["image"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: {},
      references: { referenceImages: true, characterIdentity: true },
      audio: {},
      characters: { maxCharacters: 1, identityPreservation: true },
      limits: {},
      pricing: [price("e2e-p-id-image", "image", 5)],
      quality: { identity: 90, quality: 80 },
      regions: ["global"],
      evidence: [
        evidence("quality.identity", "high"),
        evidence("quality.quality", "high"),
        evidence("supportedProfiles"),
      ],
    },
    {
      providerId: "fal",
      modelId: "e2e-dialogue",
      displayName: "E2E dialogue video",
      enabled: true,
      status: "available",
      supportedProfiles: ["video.dialogue"],
      mediaInputs: ["text", "image", "audio", "reference_image"],
      mediaOutputs: ["video"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: {
        minimumSeconds: 1,
        maximumSeconds: 30,
        supportedValuesSeconds: [4, 5, 6, 8, 10],
      },
      references: {
        startFrame: true,
        referenceImages: true,
        characterIdentity: true,
        audioVoice: true,
      },
      audio: {
        nativeAudioOutput: true,
        voiceOver: true,
        nativeDialogue: true,
        inputAudio: true,
      },
      characters: { maxCharacters: 1, identityPreservation: true },
      limits: {},
      pricing: [price("e2e-p-dialogue", "second", 12)],
      quality: { quality: 80, identity: 85, reliability: 75 },
      regions: ["global"],
      evidence: [
        evidence("quality.quality", "high"),
        evidence("quality.identity", "high"),
        evidence("quality.reliability", "high"),
        evidence("supportedProfiles"),
      ],
    },
    {
      providerId: "fal",
      modelId: "e2e-i2v",
      displayName: "E2E image to video",
      enabled: true,
      status: "available",
      supportedProfiles: ["video.image_to_video"],
      mediaInputs: ["text", "image", "start_frame"],
      mediaOutputs: ["video"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: {
        minimumSeconds: 1,
        maximumSeconds: 30,
        supportedValuesSeconds: [4, 5, 6, 8, 10],
      },
      references: {
        startFrame: true,
        referenceImages: true,
        characterIdentity: true,
      },
      audio: { nativeAudioOutput: false },
      characters: { maxCharacters: 1, identityPreservation: true },
      limits: {},
      pricing: [price("e2e-p-i2v", "second", 10)],
      quality: { quality: 75, reliability: 70 },
      regions: ["global"],
      evidence: [
        evidence("quality.quality", "medium"),
        evidence("quality.reliability", "medium"),
        evidence("supportedProfiles"),
      ],
    },
    {
      providerId: "fal",
      modelId: "e2e-t2v",
      displayName: "E2E text to video",
      enabled: true,
      status: "available",
      supportedProfiles: ["video.text_to_video"],
      mediaInputs: ["text"],
      mediaOutputs: ["video"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: {
        minimumSeconds: 1,
        maximumSeconds: 30,
        supportedValuesSeconds: [4, 5, 6, 8, 10],
      },
      references: {},
      audio: { nativeAudioOutput: true },
      characters: {},
      limits: {},
      pricing: [price("e2e-p-t2v", "second", 8)],
      quality: { quality: 70 },
      regions: ["global"],
      evidence: [evidence("quality.quality", "medium"), evidence("supportedProfiles")],
    },
    {
      providerId: "elevenlabs",
      modelId: "e2e-voice",
      displayName: "E2E voice",
      enabled: true,
      status: "available",
      supportedProfiles: ["audio.voice"],
      mediaInputs: ["text"],
      mediaOutputs: ["audio"],
      supportedAspectRatios: [],
      duration: {},
      references: { audioVoice: true },
      audio: { voiceOver: true, voiceControl: true },
      characters: {},
      limits: {},
      pricing: [price("e2e-p-voice", "thousand_tokens", 15)],
      quality: {},
      regions: ["global"],
      evidence: [evidence("supportedProfiles")],
    },
    {
      providerId: "fal",
      modelId: "e2e-lipsync",
      displayName: "E2E lipsync",
      enabled: true,
      status: "available",
      supportedProfiles: ["audio.lipsync"],
      mediaInputs: ["video", "audio"],
      mediaOutputs: ["lipsync_video"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: { minimumSeconds: 1, maximumSeconds: 60 },
      references: { audioVoice: true },
      audio: { inputAudio: true, lipsync: true, nativeDialogue: false },
      characters: {},
      limits: {},
      pricing: [price("e2e-p-lipsync", "minute", 40)],
      quality: {},
      regions: ["global"],
      evidence: [evidence("supportedProfiles")],
    },
    {
      providerId: "openai",
      modelId: "e2e-tti",
      displayName: "E2E text to image",
      enabled: true,
      status: "available",
      supportedProfiles: ["image.text_to_image"],
      mediaInputs: ["text"],
      mediaOutputs: ["image"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: {},
      references: {},
      audio: {},
      characters: {},
      limits: {},
      pricing: [price("e2e-p-tti", "image", 4)],
      quality: { quality: 85 },
      regions: ["global"],
      evidence: [evidence("quality.quality", "high"), evidence("supportedProfiles")],
    },
  ];

  return buildRegistrySnapshot({
    providers: [provider("fal"), provider("elevenlabs"), provider("openai")],
    models,
    createdAt: options.createdAt,
    registryVersion: options.registryVersion,
    expiresAt: EXPIRES,
  });
}

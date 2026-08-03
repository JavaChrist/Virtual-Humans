import {
  createBudgetPolicy,
  createBudgetSnapshot,
  money,
} from "@/domain/cost";
import { finalizePromptPackages } from "@/domain/prompt";
import {
  makePromptChain,
  makeValidPromptCandidate,
} from "@/domain/prompt/__tests__/fixtures";
import {
  buildRegistrySnapshot,
  type ModelCapabilities,
  type ProviderDefinition,
} from "@/domain/routing/capabilities";
import { createDefaultRoutingPolicy } from "../policy";

export const AT = "2026-08-02T12:00:00.000Z";
export const CREATED = "2026-08-02T10:00:00.000Z";
export const EXPIRES = "2026-12-31T23:59:59.000Z";

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

function price(id: string, unit: "image" | "second" | "minute" | "thousand_tokens", minor: number) {
  return {
    id,
    unit,
    unitCost: money(minor, "USD"),
    conditions: [],
    pricingVersion: "test-v1",
    source: "manual" as const,
    confidence: "high" as const,
  };
}

export function makeRoutableRegistry(): ReturnType<typeof buildRegistrySnapshot> {
  const models: ModelCapabilities[] = [
    {
      providerId: "fal",
      modelId: "id-image",
      displayName: "Identity image",
      enabled: true,
      status: "available",
      supportedProfiles: ["image.reference_identity"],
      mediaInputs: ["text", "image", "reference_image"],
      mediaOutputs: ["image"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: {},
      references: {
        referenceImages: true,
        characterIdentity: true,
      },
      audio: {},
      characters: { maxCharacters: 1, identityPreservation: true },
      limits: {},
      pricing: [price("p-id-image", "image", 5)],
      quality: {
        identity: 90,
        quality: 80,
      },
      regions: ["global"],
      evidence: [
        {
          field: "quality.identity",
          source: "manual",
          reference: "fixture",
          confidence: "high",
        },
        {
          field: "quality.quality",
          source: "manual",
          reference: "fixture",
          confidence: "high",
        },
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
    {
      providerId: "fal",
      modelId: "i2v",
      displayName: "Image to video",
      enabled: true,
      status: "available",
      supportedProfiles: ["video.image_to_video"],
      mediaInputs: ["text", "image", "start_frame"],
      mediaOutputs: ["video"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: { minimumSeconds: 1, maximumSeconds: 30, supportedValuesSeconds: [4, 5, 6, 8, 10] },
      references: {
        startFrame: true,
        referenceImages: true,
        characterIdentity: true,
      },
      audio: { nativeAudioOutput: false },
      characters: { maxCharacters: 1, identityPreservation: true },
      limits: {},
      pricing: [price("p-i2v", "second", 10)],
      quality: { quality: 75, reliability: 70 },
      regions: ["global"],
      evidence: [
        {
          field: "quality.quality",
          source: "manual",
          reference: "fixture",
          confidence: "medium",
        },
        {
          field: "quality.reliability",
          source: "manual",
          reference: "fixture",
          confidence: "medium",
        },
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
    {
      providerId: "fal",
      modelId: "i2v-alt",
      displayName: "Image to video alt",
      enabled: true,
      status: "available",
      supportedProfiles: ["video.image_to_video"],
      mediaInputs: ["text", "image", "start_frame"],
      mediaOutputs: ["video"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: { minimumSeconds: 1, maximumSeconds: 30, supportedValuesSeconds: [4, 5, 6, 8, 10] },
      references: {
        startFrame: true,
        referenceImages: true,
        characterIdentity: true,
      },
      audio: {},
      characters: { maxCharacters: 1, identityPreservation: true },
      limits: {},
      pricing: [price("p-i2v-alt", "second", 20)],
      quality: { quality: 60, reliability: 60 },
      regions: ["global"],
      evidence: [
        {
          field: "quality.quality",
          source: "manual",
          reference: "fixture",
          confidence: "low",
        },
        {
          field: "quality.reliability",
          source: "manual",
          reference: "fixture",
          confidence: "low",
        },
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
    {
      providerId: "fal",
      modelId: "t2v",
      displayName: "Text to video",
      enabled: true,
      status: "available",
      supportedProfiles: ["video.text_to_video"],
      mediaInputs: ["text"],
      mediaOutputs: ["video"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: { minimumSeconds: 1, maximumSeconds: 30, supportedValuesSeconds: [4, 5, 6, 8, 10] },
      references: {},
      audio: { nativeAudioOutput: true },
      characters: {},
      limits: {},
      pricing: [price("p-t2v", "second", 8)],
      quality: { quality: 70 },
      regions: ["global"],
      evidence: [
        {
          field: "quality.quality",
          source: "manual",
          reference: "fixture",
          confidence: "medium",
        },
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
    {
      providerId: "elevenlabs",
      modelId: "voice-1",
      displayName: "Voice",
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
      pricing: [price("p-voice", "thousand_tokens", 15)],
      quality: {},
      regions: ["global"],
      evidence: [
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
    {
      providerId: "fal",
      modelId: "lipsync-1",
      displayName: "Lipsync",
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
      pricing: [price("p-lipsync", "minute", 40)],
      quality: {},
      regions: ["global"],
      evidence: [
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
    {
      providerId: "openai",
      modelId: "tti",
      displayName: "Text to image",
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
      pricing: [price("p-tti", "image", 4)],
      quality: { quality: 85 },
      regions: ["global"],
      evidence: [
        {
          field: "quality.quality",
          source: "manual",
          reference: "fixture",
          confidence: "high",
        },
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
    {
      providerId: "fal",
      modelId: "carousel-1",
      displayName: "Carousel",
      enabled: true,
      status: "available",
      supportedProfiles: ["motion.carousel"],
      mediaInputs: ["image"],
      mediaOutputs: ["carousel"],
      supportedAspectRatios: ["9:16", "16:9", "1:1"],
      duration: { minimumSeconds: 1, maximumSeconds: 120 },
      references: {},
      audio: {},
      characters: {},
      limits: {},
      pricing: [price("p-carousel", "second", 2)],
      quality: {},
      regions: ["global"],
      evidence: [
        {
          field: "supportedProfiles",
          source: "manual",
          reference: "fixture",
          confidence: "verified",
        },
      ],
    },
  ];

  return buildRegistrySnapshot({
    providers: [provider("fal"), provider("elevenlabs"), provider("openai")],
    models,
    createdAt: CREATED,
    registryVersion: "routable-test-1",
    expiresAt: EXPIRES,
  });
}

export function makeRouterChain(options: { withCharacter?: boolean } = {}) {
  const chain = makePromptChain({ withCharacter: options.withCharacter ?? true });
  const output = finalizePromptPackages({
    brief: chain.brief,
    marketingPlan: chain.marketingPlan,
    creativeConcept: chain.creativeConcept,
    videoScript: chain.videoScript,
    visualDirection: chain.visualDirection,
    storyboard: chain.storyboard,
    candidate: makeValidPromptCandidate(),
    metadata: {
      createdBy: "tester",
      correlationId: "corr-router-1",
      createdAt: CREATED,
    },
  });
  return { ...chain, packages: output.packages };
}

export function ampleBudget(limitMinor = 1_000_000) {
  const limit = money(limitMinor, "USD");
  return {
    budgetPolicy: createBudgetPolicy(limit),
    budgetSnapshot: createBudgetSnapshot({
      limit,
      reserved: money(0, "USD"),
      spent: money(0, "USD"),
    }),
  };
}

export function tinyBudget(limitMinor = 1) {
  const limit = money(limitMinor, "USD");
  return {
    budgetPolicy: createBudgetPolicy(limit),
    budgetSnapshot: createBudgetSnapshot({
      limit,
      reserved: money(0, "USD"),
      spent: money(0, "USD"),
    }),
  };
}

export function defaultPolicy() {
  return createDefaultRoutingPolicy();
}

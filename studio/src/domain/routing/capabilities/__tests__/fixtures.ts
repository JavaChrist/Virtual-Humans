import { money } from "@/domain/cost";
import { finalizePromptPackages } from "@/domain/prompt";
import { makePromptChain, makeValidPromptCandidate } from "@/domain/prompt/__tests__/fixtures";
import type { ModelCapabilities } from "../model";
import type { ProviderDefinition } from "../provider";
import { buildRegistrySnapshot } from "../registry";

export const AT = "2026-08-02T12:00:00.000Z";
export const CREATED = "2026-08-02T10:00:00.000Z";
export const EXPIRES = "2026-12-31T23:59:59.000Z";

export function makeProvider(
  overrides: Partial<ProviderDefinition> & { id: string },
): ProviderDefinition {
  return {
    displayName: overrides.id,
    adapterKind: "test",
    enabled: true,
    regions: ["global"],
    supportsIdempotency: false,
    supportsCancellation: false,
    supportsWebhooks: false,
    status: "available",
    ...overrides,
  };
}

export function makeModel(
  overrides: Partial<ModelCapabilities> & {
    providerId: string;
    modelId: string;
  },
): ModelCapabilities {
  return {
    displayName: overrides.modelId,
    enabled: true,
    status: "available",
    supportedProfiles: ["video.text_to_video"],
    mediaInputs: ["text"],
    mediaOutputs: ["video"],
    supportedAspectRatios: ["9:16", "16:9", "1:1"],
    duration: { minimumSeconds: 1, maximumSeconds: 30, supportedValuesSeconds: [4, 6, 8] },
    references: {},
    audio: {},
    characters: {},
    limits: {},
    pricing: [
      {
        id: `price:${overrides.modelId}`,
        unit: "second",
        unitCost: money(10, "USD"),
        conditions: [],
        pricingVersion: "test-v1",
        source: "manual",
        confidence: "high",
      },
    ],
    quality: {},
    regions: ["global"],
    evidence: [
      {
        field: "supportedProfiles",
        source: "manual",
        reference: "test-fixture",
        confidence: "high",
      },
    ],
    ...overrides,
  };
}

export function makeTestSnapshot(models?: ModelCapabilities[]) {
  const providers = [
    makeProvider({ id: "fal", status: "available" }),
    makeProvider({ id: "openai", status: "available" }),
  ];
  const defaultModels = [
    makeModel({
      providerId: "fal",
      modelId: "test-t2v",
      supportedProfiles: ["video.text_to_video"],
      audio: { nativeAudioOutput: true },
    }),
    makeModel({
      providerId: "fal",
      modelId: "test-i2v",
      supportedProfiles: ["video.image_to_video", "image.reference_identity"],
      mediaInputs: ["text", "image", "start_frame"],
      mediaOutputs: ["video"],
      references: {
        startFrame: true,
        referenceImages: true,
        characterIdentity: true,
      },
      audio: { lipsync: true, inputAudio: true, nativeDialogue: false },
      characters: { maxCharacters: 1, identityPreservation: true },
    }),
    makeModel({
      providerId: "openai",
      modelId: "gpt-image-1",
      supportedProfiles: ["image.text_to_image"],
      mediaInputs: ["text"],
      mediaOutputs: ["image"],
      duration: {},
      pricing: [
        {
          id: "price:gpt-image-1",
          unit: "image",
          unitCost: money(4, "USD"),
          conditions: [],
          pricingVersion: "test-v1",
          source: "manual",
          confidence: "high",
        },
      ],
    }),
  ];
  return buildRegistrySnapshot({
    providers,
    models: models ?? defaultModels,
    createdAt: CREATED,
    registryVersion: "test-registry-1",
    expiresAt: EXPIRES,
  });
}

export function makeScenePackageChain(options: { withCharacter?: boolean } = {}) {
  const chain = makePromptChain(options);
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
      correlationId: "corr-cap-1",
      createdAt: CREATED,
    },
  });
  return { ...chain, packages: output.packages };
}

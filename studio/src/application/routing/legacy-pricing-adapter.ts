/**
 * Pure adapter: legacy studio pricing catalogue → CapabilityRegistrySnapshot (VHS-107).
 * Does not modify pricing.ts, fetch providers, or invent capabilities from model names.
 *
 * Structural fields only (mode, audio, seconds, aspectRatios, unit prices).
 * Unknown capabilities remain omitted / undefined.
 */

import {
  fromDecimalAmount,
  isCostDomainError,
  LEGACY_PRICING_VERSION,
} from "@/domain/cost";
import {
  buildRegistrySnapshot,
  CapabilityDomainError,
  type AspectRatio,
  type CapabilityEvidence,
  type CapabilityRegistrySnapshot,
  type ModelCapabilities,
  type PricingDefinition,
  type ProviderDefinition,
} from "@/domain/routing/capabilities";
import type { CapabilityProfile } from "@/domain/prompt";

export type LegacyVideoModelInput = {
  id: string;
  label: string;
  mode: "text-to-video" | "image-to-video" | "reference-to-video";
  audio: "native" | "silent";
  usdPerSecond: number;
  seconds: number[];
  aspectRatios: string[];
};

export type LegacyLipsyncModelInput = {
  id: string;
  label: string;
  usdPerMinute: number;
};

export type LegacyImagePriceTable = Record<
  string,
  Record<string, number>
>;

export type BuildRegistryFromLegacyPricingInput = {
  createdAt: string;
  registryVersion: string;
  expiresAt?: string;
  videoModels: LegacyVideoModelInput[];
  lipsyncModels: LegacyLipsyncModelInput[];
  imagePrices: LegacyImagePriceTable;
  elevenLabsUsdPer1kChars: number;
  sceneImageUsd?: number;
  duoFrameUsd?: number;
  carouselUsdPerSecondApprox?: number;
  mergeUsdPerSecondApprox?: number;
  /** Manual overlays — never inferred from names. */
  manualModels?: ModelCapabilities[];
  manualProviders?: ProviderDefinition[];
};

const ASPECT: AspectRatio[] = ["9:16", "1:1", "16:9"];

function usdToMoney(usd: number) {
  try {
    return fromDecimalAmount(usd, "USD", { decimals: 2, round: "half_up" });
  } catch (e) {
    if (isCostDomainError(e)) {
      throw new CapabilityDomainError(
        "conversion_error",
        "Failed to convert legacy USD price to Money.",
        e.publicMessage,
      );
    }
    throw e;
  }
}

function evidence(
  field: string,
  reference: string,
  confidence: CapabilityEvidence["confidence"] = "medium",
): CapabilityEvidence {
  return {
    field,
    source: "legacy_pricing",
    reference,
    confidence,
  };
}

function filterAspectRatios(ratios: string[]): AspectRatio[] {
  return ratios.filter((r): r is AspectRatio =>
    (ASPECT as string[]).includes(r),
  );
}

function profilesForVideoMode(
  mode: LegacyVideoModelInput["mode"],
): CapabilityProfile[] {
  switch (mode) {
    case "text-to-video":
      return ["video.text_to_video"];
    case "image-to-video":
      return ["video.image_to_video"];
    case "reference-to-video":
      // Structural mode implies reference images + i2v-class video — not dialogue.
      return ["video.image_to_video", "image.reference_identity"];
    default: {
      const _e: never = mode;
      return _e;
    }
  }
}

function baseProviders(): ProviderDefinition[] {
  // status unknown — presence in code ≠ availability
  return [
    {
      id: "openai",
      displayName: "OpenAI",
      adapterKind: "openai_image",
      enabled: true,
      regions: ["unknown"],
      supportsIdempotency: false,
      supportsCancellation: false,
      supportsWebhooks: false,
      status: "unknown",
    },
    {
      id: "elevenlabs",
      displayName: "ElevenLabs",
      adapterKind: "elevenlabs_voice",
      enabled: true,
      regions: ["unknown"],
      supportsIdempotency: false,
      supportsCancellation: false,
      supportsWebhooks: false,
      status: "unknown",
    },
    {
      id: "fal",
      displayName: "fal.ai",
      adapterKind: "fal_queue",
      enabled: true,
      regions: ["unknown"],
      supportsIdempotency: true,
      supportsCancellation: false,
      supportsWebhooks: false,
      status: "unknown",
    },
  ];
}

function pricingLine(input: {
  id: string;
  unit: PricingDefinition["unit"];
  usd: number;
  conditions?: PricingDefinition["conditions"];
}): PricingDefinition {
  return {
    id: input.id,
    unit: input.unit,
    unitCost: usdToMoney(input.usd),
    conditions: input.conditions ?? [],
    pricingVersion: LEGACY_PRICING_VERSION,
    source: "legacy_catalog",
    confidence: "medium",
  };
}

function mapVideoModel(m: LegacyVideoModelInput): ModelCapabilities {
  const profiles = profilesForVideoMode(m.mode);
  const aspects = filterAspectRatios(m.aspectRatios);
  const refs: ModelCapabilities["references"] = {};
  if (m.mode === "image-to-video") {
    refs.startFrame = true;
    refs.referenceImages = true;
  }
  if (m.mode === "reference-to-video") {
    refs.referenceImages = true;
    // characterIdentity left unknown — not deduced from label
  }

  const audio: ModelCapabilities["audio"] = {
    nativeAudioOutput: m.audio === "native",
    // nativeDialogue intentionally unknown even when audio is native
  };

  const mediaInputs: ModelCapabilities["mediaInputs"] =
    m.mode === "text-to-video"
      ? ["text"]
      : m.mode === "image-to-video"
        ? ["text", "image", "start_frame"]
        : ["text", "image", "reference_image"];

  return {
    providerId: "fal",
    modelId: m.id,
    externalModelId: m.id,
    displayName: m.label,
    enabled: true,
    status: "unknown",
    supportedProfiles: profiles,
    mediaInputs,
    mediaOutputs: ["video"],
    supportedAspectRatios: aspects,
    duration: {
      minimumSeconds: Math.min(...m.seconds),
      maximumSeconds: Math.max(...m.seconds),
      supportedValuesSeconds: [...m.seconds],
    },
    references: refs,
    audio,
    characters: {},
    limits: {},
    pricing: [
      pricingLine({
        id: `price:${m.id}:second`,
        unit: "second",
        usd: m.usdPerSecond,
      }),
    ],
    quality: {},
    regions: ["unknown"],
    evidence: [
      evidence("supportedProfiles", `VIDEO_MODELS.mode=${m.mode}`),
      evidence("audio.nativeAudioOutput", `VIDEO_MODELS.audio=${m.audio}`),
      evidence("duration", "VIDEO_MODELS.seconds"),
      evidence("supportedAspectRatios", "VIDEO_MODELS.aspectRatios"),
      evidence("pricing", "VIDEO_MODELS.usdPerSecond"),
    ],
  };
}

function mapLipsyncModel(m: LegacyLipsyncModelInput): ModelCapabilities {
  return {
    providerId: "fal",
    modelId: m.id,
    externalModelId: m.id,
    displayName: m.label,
    enabled: true,
    status: "unknown",
    supportedProfiles: ["audio.lipsync"],
    mediaInputs: ["video", "audio"],
    mediaOutputs: ["lipsync_video"],
    supportedAspectRatios: [],
    duration: {},
    references: { audioVoice: true },
    audio: {
      inputAudio: true,
      lipsync: true,
      nativeDialogue: false,
    },
    characters: {},
    limits: {},
    pricing: [
      pricingLine({
        id: `price:${m.id}:minute`,
        unit: "minute",
        usd: m.usdPerMinute,
      }),
    ],
    quality: {},
    regions: ["unknown"],
    evidence: [
      evidence("supportedProfiles", "LIPSYNC_MODELS"),
      evidence("audio.lipsync", "LIPSYNC_MODELS"),
      evidence("pricing", "LIPSYNC_MODELS.usdPerMinute"),
    ],
  };
}

function mapGptImage(imagePrices: LegacyImagePriceTable): ModelCapabilities {
  const pricing: PricingDefinition[] = [];
  for (const [size, qualities] of Object.entries(imagePrices)) {
    for (const [quality, usd] of Object.entries(qualities)) {
      pricing.push(
        pricingLine({
          id: `price:gpt-image-1:${size}:${quality}`,
          unit: "image",
          usd,
          conditions: [
            { key: "size", value: size },
            { key: "quality", value: quality },
          ],
        }),
      );
    }
  }
  return {
    providerId: "openai",
    modelId: "gpt-image-1",
    externalModelId: "gpt-image-1",
    displayName: "gpt-image-1",
    enabled: true,
    status: "unknown",
    supportedProfiles: ["image.text_to_image"],
    mediaInputs: ["text"],
    mediaOutputs: ["image"],
    supportedAspectRatios: ["1:1", "9:16", "16:9"],
    duration: {},
    references: {},
    audio: {},
    characters: {},
    limits: {},
    pricing,
    quality: {},
    regions: ["unknown"],
    evidence: [
      evidence("supportedProfiles", "openai-image.ts model=gpt-image-1", "high"),
      evidence("pricing", "IMAGE_PRICE table", "medium"),
    ],
  };
}

function mapElevenLabs(usdPer1k: number): ModelCapabilities {
  return {
    providerId: "elevenlabs",
    modelId: "eleven_multilingual_v2",
    externalModelId: "eleven_multilingual_v2",
    displayName: "ElevenLabs Multilingual v2",
    enabled: true,
    status: "unknown",
    supportedProfiles: ["audio.voice"],
    mediaInputs: ["text"],
    mediaOutputs: ["audio"],
    supportedAspectRatios: [],
    duration: {},
    references: { audioVoice: true },
    audio: {
      voiceOver: true,
      voiceControl: true,
      nativeDialogue: false,
    },
    characters: {},
    limits: {},
    pricing: [
      pricingLine({
        id: "price:eleven_multilingual_v2:thousand_chars",
        unit: "thousand_tokens",
        usd: usdPer1k,
        conditions: [{ key: "unit_note", value: "per_1000_characters" }],
      }),
    ],
    quality: {},
    regions: ["unknown"],
    evidence: [
      evidence("supportedProfiles", "elevenlabs-voice.ts default model", "high"),
      evidence("pricing", "ELEVENLABS_USD_PER_1K_CHARS", "medium"),
    ],
  };
}

function mapFalImageModel(input: {
  id: string;
  displayName: string;
  profiles: CapabilityProfile[];
  usd: number;
  characterIdentity?: boolean;
  reference: string;
}): ModelCapabilities {
  return {
    providerId: "fal",
    modelId: input.id,
    externalModelId: input.id,
    displayName: input.displayName,
    enabled: true,
    status: "unknown",
    supportedProfiles: input.profiles,
    mediaInputs: ["text", "image", "reference_image"],
    mediaOutputs: ["image"],
    supportedAspectRatios: ["9:16", "1:1", "16:9"],
    duration: {},
    references: {
      referenceImages: true,
      characterIdentity: input.characterIdentity,
    },
    audio: {},
    characters:
      input.characterIdentity === true
        ? { identityPreservation: true, maxCharacters: 1 }
        : {},
    limits: {},
    pricing: [
      pricingLine({
        id: `price:${input.id}:image`,
        unit: "image",
        usd: input.usd,
      }),
    ],
    quality: {},
    regions: ["unknown"],
    evidence: [
      evidence("supportedProfiles", input.reference, "medium"),
      evidence("pricing", input.reference, "medium"),
      ...(input.characterIdentity === true
        ? [evidence("references.characterIdentity", input.reference, "medium")]
        : []),
    ],
  };
}

function mapUtilityVideo(input: {
  id: string;
  displayName: string;
  profile: CapabilityProfile;
  usdPerSecond: number;
  reference: string;
}): ModelCapabilities {
  return {
    providerId: "fal",
    modelId: input.id,
    externalModelId: input.id,
    displayName: input.displayName,
    enabled: true,
    status: "unknown",
    supportedProfiles: [input.profile],
    mediaInputs: ["image"],
    mediaOutputs: input.profile === "motion.carousel" ? ["carousel"] : ["video"],
    supportedAspectRatios: ["9:16", "1:1", "16:9"],
    duration: { minimumSeconds: 1, maximumSeconds: 120 },
    references: {},
    audio: {},
    characters: {},
    limits: {},
    pricing: [
      pricingLine({
        id: `price:${input.id}:second`,
        unit: "second",
        usd: input.usdPerSecond,
      }),
    ],
    quality: {},
    regions: ["unknown"],
    evidence: [
      evidence("supportedProfiles", input.reference, "medium"),
      evidence("pricing", input.reference, "low"),
    ],
  };
}

/**
 * Build a partial-but-valid registry from legacy catalogue inputs.
 * Capabilities not present in the catalogue remain unknown.
 */
export function buildRegistryFromLegacyPricing(
  input: BuildRegistryFromLegacyPricingInput,
): CapabilityRegistrySnapshot {
  const providers = [...baseProviders(), ...(input.manualProviders ?? [])];
  const models: ModelCapabilities[] = [
    mapGptImage(input.imagePrices),
    mapElevenLabs(input.elevenLabsUsdPer1kChars),
    ...input.videoModels.map(mapVideoModel),
    ...input.lipsyncModels.map(mapLipsyncModel),
  ];

  if (input.sceneImageUsd !== undefined) {
    models.push(
      mapFalImageModel({
        id: "fal-ai/flux-pulid",
        displayName: "Flux PuLID (scene still)",
        profiles: ["image.reference_identity"],
        usd: input.sceneImageUsd,
        characterIdentity: true,
        reference: "SCENE_IMAGE_MODEL_ID + fal.ts flux-pulid",
      }),
    );
  }

  if (input.duoFrameUsd !== undefined) {
    models.push(
      mapFalImageModel({
        id: "fal-ai/nano-banana/edit",
        displayName: "Nano Banana edit (duo frame)",
        profiles: ["image.reference_identity"],
        usd: input.duoFrameUsd,
        // multi-character NOT claimed — unknown
        reference: "DUO_FRAME_MODEL_ID",
      }),
    );
  }

  if (input.carouselUsdPerSecondApprox !== undefined) {
    models.push(
      mapUtilityVideo({
        id: "fal-ai/ffmpeg-api/images-to-video",
        displayName: "FFmpeg images-to-video (carousel)",
        profile: "motion.carousel",
        usdPerSecond: input.carouselUsdPerSecondApprox,
        reference: "CAROUSEL_MODEL_ID",
      }),
    );
  }

  // merge helpers: no CapabilityProfile — omitted rather than inventing

  if (input.manualModels?.length) {
    models.push(...input.manualModels);
  }

  return buildRegistrySnapshot({
    providers,
    models,
    createdAt: input.createdAt,
    registryVersion: input.registryVersion,
    expiresAt: input.expiresAt,
  });
}

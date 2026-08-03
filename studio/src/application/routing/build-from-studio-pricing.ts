/**
 * Convenience wiring: import live studio pricing catalogue into a registry snapshot.
 * Application-only — domain never imports lib/pricing.
 */

import {
  ELEVENLABS_USD_PER_1K_CHARS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  LIPSYNC_MODELS,
  VIDEO_MODELS,
  estimateCarousel,
  estimateDuoFrame,
  estimateImage,
  estimateSceneImage,
  type ImageQuality,
  type ImageSize,
} from "@/lib/pricing";
import {
  buildRegistryFromLegacyPricing,
  type BuildRegistryFromLegacyPricingInput,
} from "./legacy-pricing-adapter";
import type { CapabilityRegistrySnapshot } from "@/domain/routing/capabilities";

/** Rebuild image price table via public estimateImage — does not require exporting IMAGE_PRICE. */
function legacyImagePrices(): BuildRegistryFromLegacyPricingInput["imagePrices"] {
  const table: BuildRegistryFromLegacyPricingInput["imagePrices"] = {};
  for (const size of IMAGE_SIZES) {
    table[size] = {};
    for (const quality of IMAGE_QUALITIES) {
      table[size]![quality] = estimateImage(size as ImageSize, quality as ImageQuality, 1);
    }
  }
  return table;
}

export function buildRegistryFromStudioPricing(options: {
  createdAt: string;
  registryVersion: string;
  expiresAt?: string;
}): CapabilityRegistrySnapshot {
  const input: BuildRegistryFromLegacyPricingInput = {
    createdAt: options.createdAt,
    registryVersion: options.registryVersion,
    expiresAt: options.expiresAt,
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
    imagePrices: legacyImagePrices(),
    elevenLabsUsdPer1kChars: ELEVENLABS_USD_PER_1K_CHARS,
    sceneImageUsd: estimateSceneImage(),
    duoFrameUsd: estimateDuoFrame(),
    carouselUsdPerSecondApprox: estimateCarousel(1),
  };
  return buildRegistryFromLegacyPricing(input);
}

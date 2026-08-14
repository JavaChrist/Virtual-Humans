/**
 * Phase 11B — fal Kling I2V Registry profile (disabled).
 *
 * Do NOT insert into the Production CapabilityRegistrySnapshot.
 * enabled = false; paidExecution = false; status = unknown.
 * Does not declare global SUPPORTED. Bounded exception VHS11B only.
 */
import { money } from "@/domain/cost";
import type { ModelCapabilities } from "./model";

export const FAL_KLING_I2V_REGISTRY_PROVIDER_ID = "fal" as const;
export const FAL_KLING_I2V_REGISTRY_MODEL_ID =
  "fal-ai/kling-video/v2/master/image-to-video" as const;
export const FAL_KLING_I2V_REGISTRY_PROFILE_VERSION =
  "fal-kling-i2v-registry-profile-1.0.0" as const;

export function buildFalKlingI2vModelCapabilities(): ModelCapabilities {
  return {
    providerId: FAL_KLING_I2V_REGISTRY_PROVIDER_ID,
    modelId: FAL_KLING_I2V_REGISTRY_MODEL_ID,
    displayName: "fal Kling v2 Master image-to-video (disabled)",
    enabled: false,
    status: "unknown",
    supportedProfiles: ["video.image_to_video"],
    mediaInputs: ["image", "start_frame", "text"],
    mediaOutputs: ["video"],
    supportedAspectRatios: ["9:16", "16:9", "1:1"],
    duration: {
      minimumSeconds: 5,
      maximumSeconds: 10,
      supportedValuesSeconds: [5, 10],
    },
    references: { startFrame: true, referenceImages: false },
    audio: { nativeAudioOutput: false },
    characters: {},
    limits: { maxOutputSeconds: 10 },
    pricing: [
      {
        id: "price:fal-kling-i2v-v2-master",
        unit: "second",
        unitCost: money(28, "USD"),
        conditions: [],
        pricingVersion: "fal-official-2026-08-14",
        source: "provider_documentation",
        confidence: "high",
      },
    ],
    quality: {},
    regions: ["global"],
    evidence: [
      {
        field: "supportedProfiles",
        source: "provider_documentation",
        reference: "fal-ai/kling-video/v2/master/image-to-video",
        confidence: "high",
      },
      {
        field: "pricing",
        source: "provider_documentation",
        reference: "fal official 5s=$1.40 / $0.28 per extra second",
        confidence: "high",
      },
    ],
  };
}

export const FAL_KLING_I2V_REGISTRY_PROFILE = {
  providerId: FAL_KLING_I2V_REGISTRY_PROVIDER_ID,
  modelId: FAL_KLING_I2V_REGISTRY_MODEL_ID,
  enabled: false as const,
  paidExecution: false as const,
  status: "unknown" as const,
  globallyEligible: false as const,
  insertedIntoProductionSnapshot: false as const,
  profileVersion: FAL_KLING_I2V_REGISTRY_PROFILE_VERSION,
  capabilities: buildFalKlingI2vModelCapabilities(),
  note:
    "Phase 11B: adapter+pricing documented only — enabled/paidExecution remain false; " +
    "bounded VHS11B exception; do not declare SUPPORTED globally.",
} as const;

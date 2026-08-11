/**
 * Canonical strategy library (VHS-108).
 * Templates only — no provider/model IDs.
 */

import { RoutingDomainError } from "./errors";
import {
  GenerationStrategyIdValues,
  type GenerationStrategyId,
  type StrategyDefinition,
} from "./strategies";

const LIBRARY: StrategyDefinition[] = [
  {
    id: "direct_video",
    supportedProductionIntents: ["b_roll", "transition", "voice_over_visual"],
    requiredProfiles: ["video.text_to_video"],
    steps: [
      {
        order: 1,
        action: "video",
        capabilityProfile: "video.text_to_video",
        expectedOutput: "video",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 300,
      },
    ],
    constraints: [{ code: "no_identity", description: "No identity preservation required." }],
    version: "1.0.0",
  },
  {
    id: "image_to_video",
    supportedProductionIntents: ["image_to_video", "product_demo"],
    requiredProfiles: ["image.reference_identity", "video.image_to_video"],
    steps: [
      {
        order: 1,
        action: "image",
        capabilityProfile: "image.reference_identity",
        expectedOutput: "image",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 180,
      },
      {
        order: 2,
        action: "video",
        capabilityProfile: "video.image_to_video",
        expectedOutput: "video",
        dependsOnOrders: [1],
        defaultTimeoutSeconds: 300,
      },
    ],
    constraints: [
      { code: "identity_frame", description: "Start frame / identity reference required." },
    ],
    version: "1.0.0",
  },
  {
    id: "talking_head",
    supportedProductionIntents: ["talking_head"],
    requiredProfiles: [
      "image.reference_identity",
      "video.image_to_video",
      "audio.voice",
      "audio.lipsync",
    ],
    steps: [
      {
        order: 1,
        action: "image",
        capabilityProfile: "image.reference_identity",
        expectedOutput: "image",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 180,
      },
      {
        order: 2,
        action: "video",
        capabilityProfile: "video.image_to_video",
        expectedOutput: "video",
        dependsOnOrders: [1],
        defaultTimeoutSeconds: 300,
      },
      {
        order: 3,
        action: "voice",
        capabilityProfile: "audio.voice",
        expectedOutput: "audio",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 120,
      },
      {
        order: 4,
        action: "lipsync",
        capabilityProfile: "audio.lipsync",
        expectedOutput: "lipsync_video",
        dependsOnOrders: [2, 3],
        defaultTimeoutSeconds: 300,
      },
    ],
    constraints: [
      { code: "dialogue_pipeline", description: "Voice + lipsync pipeline for spoken dialogue." },
    ],
    version: "1.0.0",
  },
  {
    id: "voice_over",
    supportedProductionIntents: ["voice_over_visual"],
    requiredProfiles: ["video.text_to_video", "audio.voice"],
    steps: [
      {
        order: 1,
        action: "video",
        capabilityProfile: "video.text_to_video",
        expectedOutput: "video",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 300,
      },
      {
        order: 2,
        action: "voice",
        capabilityProfile: "audio.voice",
        expectedOutput: "audio",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 120,
      },
    ],
    constraints: [
      { code: "vo_mux_later", description: "Audio mux is Production Director responsibility." },
    ],
    version: "1.0.0",
  },
  {
    id: "carousel",
    supportedProductionIntents: ["carousel"],
    requiredProfiles: ["motion.carousel"],
    steps: [
      {
        order: 1,
        action: "carousel",
        capabilityProfile: "motion.carousel",
        expectedOutput: "carousel",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 180,
      },
    ],
    constraints: [],
    version: "1.0.0",
  },
  {
    id: "product_demo",
    supportedProductionIntents: ["product_demo"],
    requiredProfiles: ["image.text_to_image", "video.image_to_video"],
    steps: [
      {
        order: 1,
        action: "image",
        capabilityProfile: "image.text_to_image",
        expectedOutput: "image",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 180,
      },
      {
        order: 2,
        action: "video",
        capabilityProfile: "video.image_to_video",
        expectedOutput: "video",
        dependsOnOrders: [1],
        defaultTimeoutSeconds: 300,
      },
    ],
    constraints: [],
    version: "1.0.0",
  },
  {
    id: "tutorial",
    supportedProductionIntents: ["tutorial"],
    requiredProfiles: [
      "image.reference_identity",
      "video.image_to_video",
      "audio.voice",
    ],
    steps: [
      {
        order: 1,
        action: "image",
        capabilityProfile: "image.reference_identity",
        expectedOutput: "image",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 180,
      },
      {
        order: 2,
        action: "video",
        capabilityProfile: "video.image_to_video",
        expectedOutput: "video",
        dependsOnOrders: [1],
        defaultTimeoutSeconds: 300,
      },
      {
        order: 3,
        action: "voice",
        capabilityProfile: "audio.voice",
        expectedOutput: "audio",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 120,
      },
    ],
    constraints: [],
    version: "1.0.0",
  },
  {
    id: "multi_character",
    supportedProductionIntents: ["talking_head", "image_to_video"],
    requiredProfiles: ["video.multi_character", "image.reference_identity"],
    steps: [
      {
        order: 1,
        action: "image",
        capabilityProfile: "image.reference_identity",
        expectedOutput: "image",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 180,
      },
      {
        order: 2,
        action: "video",
        capabilityProfile: "video.multi_character",
        expectedOutput: "video",
        dependsOnOrders: [1],
        defaultTimeoutSeconds: 300,
      },
    ],
    constraints: [
      { code: "multi_char", description: "Requires explicit multi-character capability." },
    ],
    version: "1.0.0",
  },
  /**
   * Motion transfer (MT-003).
   * Not bound to a ProductionIntent yet — invoked via routeMotionTransfer only.
   * maximumFallbacksPerStep must remain 0 (enforced by the MT router).
   */
  {
    id: "motion_transfer",
    supportedProductionIntents: [],
    requiredProfiles: ["video.motion_transfer"],
    steps: [
      {
        order: 1,
        action: "motion_transfer",
        capabilityProfile: "video.motion_transfer",
        expectedOutput: "video",
        dependsOnOrders: [],
        defaultTimeoutSeconds: 600,
      },
    ],
    constraints: [
      {
        code: "no_fallback",
        description: "maximumFallbacksPerStep=0 — no I2V/T2V silent fallback.",
      },
      {
        code: "source_video_required",
        description: "Real source video + verified motion-transfer capability required.",
      },
    ],
    version: "1.0.0",
  },
];
Object.freeze(LIBRARY);

export function listStrategies(): readonly StrategyDefinition[] {
  return LIBRARY;
}

export function getStrategy(id: GenerationStrategyId): StrategyDefinition {
  const found = LIBRARY.find((s) => s.id === id);
  if (!found) {
    throw new RoutingDomainError("invalid_strategy", "Unknown strategy id.", id);
  }
  return found;
}

export function strategiesForIntent(
  intent: StrategyDefinition["supportedProductionIntents"][number],
): StrategyDefinition[] {
  return LIBRARY.filter((s) => s.supportedProductionIntents.includes(intent)).slice();
}

/** Assert library integrity (no provider leakage, valid deps). */
export function assertStrategyLibraryValid(): void {
  const ids = new Set<string>();
  for (const s of LIBRARY) {
    if (!GenerationStrategyIdValues.includes(s.id)) {
      throw new RoutingDomainError("invalid_strategy", "Invalid strategy id in library.");
    }
    if (ids.has(s.id)) {
      throw new RoutingDomainError("invalid_strategy", "Duplicate strategy id.");
    }
    ids.add(s.id);
    const blob = JSON.stringify(s).toLowerCase();
    if (/\b(openai|fal\.ai|elevenlabs|kling|veo|runway|seedance)\b/.test(blob)) {
      throw new RoutingDomainError(
        "invalid_strategy",
        "Strategy template must not embed provider names.",
      );
    }
    const orders = s.steps.map((st) => st.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        throw new RoutingDomainError("invalid_strategy", "Strategy step orders must be contiguous.");
      }
    }
    for (const st of s.steps) {
      for (const dep of st.dependsOnOrders) {
        if (dep >= st.order) {
          throw new RoutingDomainError(
            "invalid_strategy",
            "Strategy step dependency must reference earlier order.",
          );
        }
      }
    }
    for (const p of s.requiredProfiles) {
      if (!s.steps.some((st) => st.capabilityProfile === p)) {
        throw new RoutingDomainError(
          "invalid_strategy",
          "requiredProfiles must appear in steps.",
          p,
        );
      }
    }
  }
}

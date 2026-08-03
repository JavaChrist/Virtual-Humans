/**
 * Abstract capability profiles (VHS-106).
 * No provider/model names, tariffs, availability, or fallbacks.
 */

import type { ProductionIntent } from "@/domain/storyboard";

export const CapabilityProfileValues = [
  "image.text_to_image",
  "image.reference_identity",
  "video.text_to_video",
  "video.image_to_video",
  "video.dialogue",
  "video.multi_character",
  "audio.voice",
  "audio.lipsync",
  "motion.carousel",
] as const;
export type CapabilityProfile = (typeof CapabilityProfileValues)[number];

export const MediaTypeValues = [
  "image",
  "video",
  "audio",
  "lipsync",
  "carousel",
] as const;
export type MediaType = (typeof MediaTypeValues)[number];

export type ProfileSpec = {
  profile: CapabilityProfile;
  mediaType: MediaType;
};

/**
 * Deterministic mapping productionIntent → abstract capability profiles needed.
 */
export function profilesForProductionIntent(intent: ProductionIntent): ProfileSpec[] {
  switch (intent) {
    case "talking_head":
      return [
        { profile: "image.reference_identity", mediaType: "image" },
        { profile: "video.dialogue", mediaType: "video" },
        { profile: "audio.voice", mediaType: "audio" },
        { profile: "audio.lipsync", mediaType: "lipsync" },
      ];
    case "image_to_video":
      return [
        { profile: "image.reference_identity", mediaType: "image" },
        { profile: "video.image_to_video", mediaType: "video" },
      ];
    case "b_roll":
      return [
        { profile: "video.text_to_video", mediaType: "video" },
      ];
    case "product_demo":
      return [
        { profile: "image.text_to_image", mediaType: "image" },
        { profile: "video.image_to_video", mediaType: "video" },
      ];
    case "carousel":
      return [{ profile: "motion.carousel", mediaType: "carousel" }];
    case "tutorial":
      return [
        { profile: "image.reference_identity", mediaType: "image" },
        { profile: "video.image_to_video", mediaType: "video" },
        { profile: "audio.voice", mediaType: "audio" },
      ];
    case "voice_over_visual":
      return [
        { profile: "video.text_to_video", mediaType: "video" },
        { profile: "audio.voice", mediaType: "audio" },
      ];
    case "text_motion":
      return [{ profile: "image.text_to_image", mediaType: "image" }];
    case "transition":
      return [{ profile: "video.text_to_video", mediaType: "video" }];
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}

/** Guard: profiles must never embed vendor names. */
export function assertProfilesVendorAgnostic(profiles: readonly string[]): boolean {
  const blob = profiles.join(" ").toLowerCase();
  return !/\b(openai|veo|kling|seedance|runway|fal\.ai|elevenlabs|midjourney|sora)\b/.test(
    blob,
  );
}

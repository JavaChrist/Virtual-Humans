/**
 * MT-007A — Registry profile DESIGN for recommended fal Kling motion-control.
 * NOT a Production registry entry. enabled=false forever in this module.
 * Activation requires MT-007B adapter + Gate MT-5/7/8.
 */

import type { MotionTransferModelCapabilities } from "../motion-transfer";
import { MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION } from "../motion-transfer";

export const MT007A_RECOMMENDED_PROVIDER_ID = "fal" as const;
/** Official fal endpoint id — mirrored from public llms.txt (2026-08-11). */
export const MT007A_RECOMMENDED_MODEL_ID =
  "fal-ai/kling-video/v3/pro/motion-control" as const;

/**
 * Documentary capability levels after official schema review (2026-08-11).
 * Anything quality-critical for Tai-Chi remains UNVERIFIED until paid benchmark.
 */
export function designFalKlingV3ProMotionTransferCaps(): MotionTransferModelCapabilities {
  return {
    schemaVersion: MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
    motionTransfer: true,
    sourceVideo: "SUPPORTED", // official required video_url
    characterReference: "SUPPORTED", // official required image_url
    outfitReference: "PARTIAL", // via character image appearance — no dedicated field
    poseControl: ["provider_native"],
    motionFidelityLevels: {
      standard: "UNVERIFIED",
      high: "UNVERIFIED",
      critical: "UNVERIFIED",
    },
    timingPreservation: "UNVERIFIED",
    cameraPreservation: "PARTIAL", // character_orientation image|video
    identityControl: "PARTIAL", // image_url + optional V3 elements face binding
    outfitControl: "UNVERIFIED",
    fullBodySupport: "PARTIAL", // docs: entire body or upper body visible
    handFootQuality: "UNVERIFIED",
    minDurationSeconds: 1,
    maxDurationSeconds: 30,
    aspectRatios: ["9:16", "16:9", "1:1"],
    resolutions: ["720p", "1080p"],
    fps: [24],
    syncOrAsync: "async",
    pollingRequired: true,
    cancellationSupported: false, // NOT_SUPPORTED until proven in MT-007B
    estimateStrategy: "per_second",
  };
}

export const MT007A_REGISTRY_DESIGN = {
  providerId: MT007A_RECOMMENDED_PROVIDER_ID,
  modelId: MT007A_RECOMMENDED_MODEL_ID,
  enabled: false as const,
  paidExecution: false as const,
  status: "UNVERIFIED" as const,
  motionTransfer: designFalKlingV3ProMotionTransferCaps(),
  note: "Design-only — do not insert into Production CapabilityRegistrySnapshot",
} as const;

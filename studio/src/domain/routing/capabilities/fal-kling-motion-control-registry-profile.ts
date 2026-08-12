/**
 * MT-007B / MT-014 — fal Kling v3 Pro motion-control Registry profile (disabled).
 *
 * Evaluation (MT-014): PROVIDER_ADAPTER_VALIDATED_BENCHMARK_ONLY after MV-001.
 * enabled = false; paidExecution = false; status = UNVERIFIED.
 * critical fidelity remains UNVERIFIED (Motion QC measurements unavailable).
 * outfitReference / cancellation remain NOT_SUPPORTED.
 * Do NOT insert into Production CapabilityRegistrySnapshot.
 * Do NOT set enabled/paidExecution from a single benchmark.
 */

import type { MotionTransferModelCapabilities } from "./motion-transfer";
import { MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION } from "./motion-transfer";

export const FAL_KLING_V3_PRO_REGISTRY_PROVIDER_ID = "fal" as const;
export const FAL_KLING_V3_PRO_REGISTRY_MODEL_ID =
  "fal-ai/kling-video/v3/pro/motion-control" as const;

export function buildFalKlingV3ProMotionTransferCaps(): MotionTransferModelCapabilities {
  return {
    schemaVersion: MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
    motionTransfer: true,
    sourceVideo: "SUPPORTED",
    characterReference: "SUPPORTED",
    outfitReference: "NOT_SUPPORTED",
    poseControl: ["provider_native"],
    motionFidelityLevels: {
      standard: "UNVERIFIED",
      high: "UNVERIFIED",
      critical: "UNVERIFIED",
    },
    timingPreservation: "UNVERIFIED",
    cameraPreservation: "PARTIAL",
    identityControl: "PARTIAL",
    outfitControl: "UNVERIFIED",
    fullBodySupport: "PARTIAL",
    handFootQuality: "UNVERIFIED",
    minDurationSeconds: 3,
    maxDurationSeconds: 30,
    aspectRatios: ["9:16", "16:9", "1:1"],
    resolutions: ["720p", "1080p"],
    fps: [24],
    syncOrAsync: "async",
    pollingRequired: true,
    cancellationSupported: false,
    estimateStrategy: "per_second",
  };
}

export const FAL_KLING_V3_PRO_REGISTRY_PROFILE = {
  providerId: FAL_KLING_V3_PRO_REGISTRY_PROVIDER_ID,
  modelId: FAL_KLING_V3_PRO_REGISTRY_MODEL_ID,
  enabled: false as const,
  paidExecution: false as const,
  status: "UNVERIFIED" as const,
  motionTransfer: buildFalKlingV3ProMotionTransferCaps(),
  note:
    "MT-014: adapter+MV-001 benchmark validated only — enabled/paidExecution remain false; " +
    "critical fidelity not hard-eligible; see docs/Developer-Handover/99_MT014_MOTION_TRANSFER_BENCHMARK_EVALUATION.md",
} as const;

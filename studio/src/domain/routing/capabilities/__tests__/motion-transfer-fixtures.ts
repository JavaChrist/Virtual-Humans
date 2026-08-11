/**
 * SYNTHETIC fixtures for MT-002 — not Production registry entries.
 * Do not enable these models outside tests.
 */

import type { ModelCapabilities } from "../model";
import type { MotionTransferModelCapabilities } from "../motion-transfer";
import {
  MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
} from "../motion-transfer";
import { makeModel, makeProvider, AT, CREATED, EXPIRES } from "./fixtures";
import { buildRegistrySnapshot } from "../registry";
import type { MotionTransferHardConstraintInput } from "../motion-transfer";

export const SYNTHETIC_MT_PROVIDER_ID = "synthetic_mt_test" as const;
export const SYNTHETIC_MT_MODEL_ID = "synthetic-motion-transfer-complete" as const;

export function makeCompleteMotionTransferCaps(
  overrides: Partial<MotionTransferModelCapabilities> = {},
): MotionTransferModelCapabilities {
  return {
    schemaVersion: MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
    motionTransfer: true,
    sourceVideo: "SUPPORTED",
    characterReference: "SUPPORTED",
    outfitReference: "SUPPORTED",
    poseControl: ["provider_native", "derived_pose", "none"],
    motionFidelityLevels: {
      standard: "SUPPORTED",
      high: "SUPPORTED",
      critical: "SUPPORTED",
    },
    timingPreservation: "SUPPORTED",
    cameraPreservation: "SUPPORTED",
    identityControl: "SUPPORTED",
    outfitControl: "SUPPORTED",
    fullBodySupport: "SUPPORTED",
    handFootQuality: "SUPPORTED",
    minDurationSeconds: 1,
    maxDurationSeconds: 30,
    aspectRatios: ["9:16", "16:9", "1:1"],
    resolutions: ["720p", "1080p"],
    fps: [24, 30],
    syncOrAsync: "async",
    pollingRequired: true,
    cancellationSupported: true,
    estimateStrategy: "per_second",
    ...overrides,
  };
}

/** Fully eligible synthetic motion-transfer model (tests only). */
export function makeSyntheticMotionTransferModel(
  overrides: Partial<ModelCapabilities> = {},
): ModelCapabilities {
  return makeModel({
    providerId: SYNTHETIC_MT_PROVIDER_ID,
    modelId: SYNTHETIC_MT_MODEL_ID,
    displayName: "SYNTHETIC motion-transfer complete (test-only)",
    supportedProfiles: ["video.motion_transfer"],
    mediaInputs: ["source_video", "reference_image", "text"],
    mediaOutputs: ["video"],
    supportedAspectRatios: ["9:16", "16:9", "1:1"],
    duration: { minimumSeconds: 1, maximumSeconds: 30 },
    references: {
      referenceImages: true,
      characterIdentity: true,
    },
    motionTransfer: makeCompleteMotionTransferCaps(),
    evidence: [
      {
        field: "supportedProfiles",
        source: "manual",
        reference: "mt-002-synthetic-fixture",
        confidence: "high",
      },
      {
        field: "motionTransfer",
        source: "manual",
        reference: "mt-002-synthetic-fixture",
        confidence: "high",
      },
    ],
    ...overrides,
  });
}

export function makeI2vNonMotionModel(): ModelCapabilities {
  return makeModel({
    providerId: "fal",
    modelId: "synthetic-i2v-not-mt",
    supportedProfiles: ["video.image_to_video", "image.reference_identity"],
    mediaInputs: ["text", "image", "start_frame", "video"],
    mediaOutputs: ["video"],
    references: {
      startFrame: true,
      referenceImages: true,
      characterIdentity: true,
    },
  });
}

export function makeT2vNonMotionModel(): ModelCapabilities {
  return makeModel({
    providerId: "fal",
    modelId: "synthetic-t2v-not-mt",
    supportedProfiles: ["video.text_to_video"],
    mediaInputs: ["text"],
    mediaOutputs: ["video"],
  });
}

export function makeReferenceImagesToVideoNonMotionModel(): ModelCapabilities {
  return makeModel({
    providerId: "fal",
    modelId: "synthetic-ref-images-to-video-not-mt",
    supportedProfiles: ["video.image_to_video", "image.reference_identity"],
    mediaInputs: ["text", "image", "reference_image", "start_frame"],
    mediaOutputs: ["video"],
    references: {
      referenceImages: true,
      characterIdentity: true,
      startFrame: true,
      maxReferences: 4,
    },
  });
}

export function baselineHardInput(
  overrides: Partial<MotionTransferHardConstraintInput> = {},
): MotionTransferHardConstraintInput {
  return {
    fidelity: "standard",
    identityLock: "preferred",
    preserveTiming: true,
    aspectRatio: "9:16",
    durationSeconds: 8,
    resolution: "1080p",
    fps: 24,
    requireVerifiedForPaid: true,
    ...overrides,
  };
}

/** Production-shaped snapshot with zero motion-transfer models. */
export function makeProductionLikeSnapshotWithoutMotionTransfer() {
  return buildRegistrySnapshot({
    providers: [
      makeProvider({ id: "fal", status: "available" }),
      makeProvider({ id: "openai", status: "available" }),
    ],
    models: [makeI2vNonMotionModel(), makeT2vNonMotionModel()],
    createdAt: CREATED,
    registryVersion: "mt002-prod-empty-mt",
    expiresAt: EXPIRES,
  });
}

void AT;

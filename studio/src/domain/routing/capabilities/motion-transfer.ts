/**
 * Motion Transfer Capability Registry extension (MT-002).
 * Pure data + eligibility helpers — no routing, no provider selection.
 */

import { z } from "zod";
import type { BriefAspectRatio } from "@/domain/brief";
import { AspectRatioValues } from "@/domain/brief";
import { MOTION_TRANSFER_CAPABILITY } from "@/domain/motion/capability";
import {
  MotionFidelityValues,
  PoseControlModeValues,
  type LockLevel,
  type MotionFidelity,
  type PoseControlMode,
} from "@/domain/motion/types";
import type { ModelCapabilities } from "./model";
import { supportsCapabilityProfile } from "./model";

export const MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION = "1.0.0" as const;

export const SupportLevelValues = [
  "SUPPORTED",
  "PARTIAL",
  "UNVERIFIED",
  "NOT_SUPPORTED",
] as const;
export type SupportLevel = (typeof SupportLevelValues)[number];

export const MotionEstimateStrategyValues = [
  "per_second",
  "per_job",
  "minimum_then_per_second",
] as const;
export type MotionEstimateStrategy = (typeof MotionEstimateStrategyValues)[number];

export const SyncOrAsyncValues = ["sync", "async"] as const;
export type SyncOrAsync = (typeof SyncOrAsyncValues)[number];

/**
 * Versioned motion-transfer block on ModelCapabilities.
 * Discriminant: motionTransfer === true.
 */
export type MotionTransferModelCapabilities = {
  schemaVersion: typeof MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION;
  /** Discriminant — must be true. */
  motionTransfer: true;
  sourceVideo: SupportLevel;
  characterReference: SupportLevel;
  outfitReference: SupportLevel;
  poseControl: PoseControlMode[];
  motionFidelityLevels: {
    standard: SupportLevel;
    high: SupportLevel;
    critical: SupportLevel;
  };
  timingPreservation: SupportLevel;
  cameraPreservation: SupportLevel;
  identityControl: SupportLevel;
  outfitControl: SupportLevel;
  fullBodySupport: SupportLevel;
  handFootQuality: SupportLevel;
  minDurationSeconds?: number;
  maxDurationSeconds: number;
  aspectRatios: BriefAspectRatio[];
  resolutions: string[];
  fps: number[];
  syncOrAsync: SyncOrAsync;
  pollingRequired: boolean;
  cancellationSupported: boolean;
  estimateStrategy: MotionEstimateStrategy;
};

export type MotionTransferHardConstraintInput = {
  fidelity: MotionFidelity;
  identityLock: LockLevel;
  outfitLock?: LockLevel;
  fullBodyRequired?: boolean;
  preserveTiming: boolean;
  preserveCamera?: boolean;
  poseControl?: PoseControlMode;
  /** When true (default), hands/feet critical path requires handFootQuality SUPPORTED. */
  handsFeetCritical?: boolean;
  durationSeconds?: number;
  aspectRatio: BriefAspectRatio;
  resolution?: string;
  fps?: number;
  /**
   * Production paid eligibility (default true):
   * UNVERIFIED never satisfies hard constraints.
   */
  requireVerifiedForPaid?: boolean;
};

export const MotionTransferIneligibilityReasonValues = [
  "motion_transfer_not_supported",
  "source_video_not_supported",
  "identity_control_not_supported",
  "outfit_control_not_supported",
  "critical_fidelity_unverified",
  "fidelity_not_supported",
  "full_body_not_supported",
  "hand_foot_quality_not_supported",
  "duration_exceeded",
  "duration_below_minimum",
  "aspect_ratio_unsupported",
  "resolution_unsupported",
  "fps_unsupported",
  "pose_control_unsupported",
  "timing_preservation_not_supported",
  "camera_preservation_not_supported",
  "model_disabled",
  "profile_missing",
  "media_input_missing",
] as const;
export type MotionTransferIneligibilityReason =
  (typeof MotionTransferIneligibilityReasonValues)[number];

export type MotionTransferIneligibility = {
  reason: MotionTransferIneligibilityReason;
  field?: string;
  /** Stable public message — no URLs / media / secrets. */
  message: string;
};

export const MotionTransferModelCapabilitiesSchema = z
  .object({
    schemaVersion: z.literal(MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION),
    motionTransfer: z.literal(true),
    sourceVideo: z.enum(SupportLevelValues),
    characterReference: z.enum(SupportLevelValues),
    outfitReference: z.enum(SupportLevelValues),
    poseControl: z.array(z.enum(PoseControlModeValues)).min(1).max(8),
    motionFidelityLevels: z
      .object({
        standard: z.enum(SupportLevelValues),
        high: z.enum(SupportLevelValues),
        critical: z.enum(SupportLevelValues),
      })
      .strict(),
    timingPreservation: z.enum(SupportLevelValues),
    cameraPreservation: z.enum(SupportLevelValues),
    identityControl: z.enum(SupportLevelValues),
    outfitControl: z.enum(SupportLevelValues),
    fullBodySupport: z.enum(SupportLevelValues),
    handFootQuality: z.enum(SupportLevelValues),
    minDurationSeconds: z.number().positive().optional(),
    maxDurationSeconds: z.number().positive().max(3600),
    aspectRatios: z.array(z.enum(AspectRatioValues)).min(1).max(8),
    resolutions: z.array(z.string().min(1).max(32)).min(1).max(16),
    fps: z.array(z.number().int().min(1).max(120)).min(1).max(16),
    syncOrAsync: z.enum(SyncOrAsyncValues),
    pollingRequired: z.boolean(),
    cancellationSupported: z.boolean(),
    estimateStrategy: z.enum(MotionEstimateStrategyValues),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (
      m.minDurationSeconds !== undefined &&
      m.minDurationSeconds > m.maxDurationSeconds
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minDurationSeconds must be ≤ maxDurationSeconds",
        path: ["minDurationSeconds"],
      });
    }
    if (m.syncOrAsync === "async" && m.pollingRequired !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "async models must set pollingRequired=true",
        path: ["pollingRequired"],
      });
    }
    if (new Set(m.poseControl).size !== m.poseControl.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate poseControl values",
        path: ["poseControl"],
      });
    }
  });

/**
 * Effect of SupportLevel on hard constraints / paid eligibility:
 * - SUPPORTED → can satisfy a hard constraint
 * - PARTIAL → never satisfies hard constraints (needs explicit non-hard decision later)
 * - UNVERIFIED → never eligible for a paid run
 * - NOT_SUPPORTED → ineligible
 */
export function supportLevelSatisfiesHard(level: SupportLevel): boolean {
  return level === "SUPPORTED";
}

/** UNVERIFIED never counts as support for paid eligibility. */
export function isSupportLevelPaidEligible(level: SupportLevel): boolean {
  return level === "SUPPORTED";
}

export function supportsMotionTransfer(model: ModelCapabilities): boolean {
  if (!model.enabled) return false;
  if (!supportsCapabilityProfile(model, MOTION_TRANSFER_CAPABILITY)) return false;
  const mt = model.motionTransfer;
  if (!mt || mt.motionTransfer !== true) return false;
  if (mt.schemaVersion !== MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION) {
    return false;
  }
  const hasVideoInput =
    model.mediaInputs.includes("video") ||
    model.mediaInputs.includes("source_video");
  if (!hasVideoInput) return false;
  if (!model.mediaOutputs.includes("video")) return false;
  return true;
}

export function satisfiesMotionTransferHardConstraints(
  model: ModelCapabilities,
  input: MotionTransferHardConstraintInput,
): boolean {
  return explainMotionTransferIneligibility(model, input).length === 0;
}

export function explainMotionTransferIneligibility(
  model: ModelCapabilities,
  input: MotionTransferHardConstraintInput,
): MotionTransferIneligibility[] {
  const reasons: MotionTransferIneligibility[] = [];
  const requireVerified = input.requireVerifiedForPaid !== false;

  if (!model.enabled) {
    reasons.push({
      reason: "model_disabled",
      message: "Model is disabled.",
    });
    return reasons;
  }

  if (!supportsCapabilityProfile(model, MOTION_TRANSFER_CAPABILITY)) {
    reasons.push({
      reason: "profile_missing",
      field: "supportedProfiles",
      message: "Model does not declare video.motion_transfer.",
    });
  }

  const mt = model.motionTransfer;
  if (!mt || mt.motionTransfer !== true) {
    reasons.push({
      reason: "motion_transfer_not_supported",
      field: "motionTransfer",
      message: "Motion-transfer capability block is absent or invalid.",
    });
    return reasons;
  }

  if (mt.schemaVersion !== MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION) {
    reasons.push({
      reason: "motion_transfer_not_supported",
      field: "motionTransfer.schemaVersion",
      message: "Unknown motion-transfer capabilities schema version.",
    });
    return reasons;
  }

  const hasVideoInput =
    model.mediaInputs.includes("video") ||
    model.mediaInputs.includes("source_video");
  if (!hasVideoInput) {
    reasons.push({
      reason: "media_input_missing",
      field: "mediaInputs",
      message: "Model mediaInputs must include video or source_video.",
    });
  }

  if (!supportLevelSatisfiesHard(mt.sourceVideo)) {
    reasons.push({
      reason: "source_video_not_supported",
      field: "motionTransfer.sourceVideo",
      message: "Source video input is not hard-supported.",
    });
  }

  const fidelityLevel = mt.motionFidelityLevels[input.fidelity];
  if (input.fidelity === "critical") {
    if (fidelityLevel !== "SUPPORTED") {
      reasons.push({
        reason:
          fidelityLevel === "UNVERIFIED" || fidelityLevel === "PARTIAL"
            ? "critical_fidelity_unverified"
            : "fidelity_not_supported",
        field: "motionTransfer.motionFidelityLevels.critical",
        message: "critical fidelity requires verified SUPPORTED level.",
      });
    }
  } else if (!supportLevelSatisfiesHard(fidelityLevel)) {
    // Paid hard path: PARTIAL and UNVERIFIED never satisfy hard constraints.
    void requireVerified;
    reasons.push({
      reason: "fidelity_not_supported",
      field: `motionTransfer.motionFidelityLevels.${input.fidelity}`,
      message: `Fidelity ${input.fidelity} is not hard-supported.`,
    });
  }

  if (input.identityLock === "required") {
    if (!supportLevelSatisfiesHard(mt.identityControl)) {
      reasons.push({
        reason: "identity_control_not_supported",
        field: "motionTransfer.identityControl",
        message: "identityLock=required needs identityControl=SUPPORTED.",
      });
    }
    if (!supportLevelSatisfiesHard(mt.characterReference)) {
      reasons.push({
        reason: "identity_control_not_supported",
        field: "motionTransfer.characterReference",
        message: "identityLock=required needs characterReference=SUPPORTED.",
      });
    }
  }

  if (input.outfitLock === "required") {
    if (!supportLevelSatisfiesHard(mt.outfitControl)) {
      reasons.push({
        reason: "outfit_control_not_supported",
        field: "motionTransfer.outfitControl",
        message: "outfitLock=required needs outfitControl=SUPPORTED.",
      });
    }
    if (!supportLevelSatisfiesHard(mt.outfitReference)) {
      reasons.push({
        reason: "outfit_control_not_supported",
        field: "motionTransfer.outfitReference",
        message: "outfitLock=required needs outfitReference=SUPPORTED.",
      });
    }
  }

  if (input.fullBodyRequired) {
    if (!supportLevelSatisfiesHard(mt.fullBodySupport)) {
      reasons.push({
        reason: "full_body_not_supported",
        field: "motionTransfer.fullBodySupport",
        message: "fullBodyRequired needs fullBodySupport=SUPPORTED.",
      });
    }
  }

  if (input.handsFeetCritical) {
    if (!supportLevelSatisfiesHard(mt.handFootQuality)) {
      reasons.push({
        reason: "hand_foot_quality_not_supported",
        field: "motionTransfer.handFootQuality",
        message: "Critical hands/feet needs handFootQuality=SUPPORTED.",
      });
    }
  }

  if (input.preserveTiming) {
    if (!supportLevelSatisfiesHard(mt.timingPreservation)) {
      reasons.push({
        reason: "timing_preservation_not_supported",
        field: "motionTransfer.timingPreservation",
        message: "Timing preservation is not hard-supported.",
      });
    }
  }

  if (input.preserveCamera) {
    if (!supportLevelSatisfiesHard(mt.cameraPreservation)) {
      reasons.push({
        reason: "camera_preservation_not_supported",
        field: "motionTransfer.cameraPreservation",
        message: "Camera preservation is not hard-supported.",
      });
    }
  }

  if (input.poseControl && input.poseControl !== "none") {
    if (!mt.poseControl.includes(input.poseControl)) {
      reasons.push({
        reason: "pose_control_unsupported",
        field: "motionTransfer.poseControl",
        message: "Requested poseControl mode is not listed.",
      });
    }
  }

  if (input.durationSeconds != null) {
    if (mt.minDurationSeconds != null && input.durationSeconds < mt.minDurationSeconds) {
      reasons.push({
        reason: "duration_below_minimum",
        field: "motionTransfer.minDurationSeconds",
        message: "Duration is below model minimum.",
      });
    }
    if (input.durationSeconds > mt.maxDurationSeconds) {
      reasons.push({
        reason: "duration_exceeded",
        field: "motionTransfer.maxDurationSeconds",
        message: "Duration exceeds model maximum.",
      });
    }
  }

  if (!mt.aspectRatios.includes(input.aspectRatio)) {
    reasons.push({
      reason: "aspect_ratio_unsupported",
      field: "motionTransfer.aspectRatios",
      message: "Aspect ratio is not supported.",
    });
  }

  if (input.resolution && !mt.resolutions.includes(input.resolution)) {
    reasons.push({
      reason: "resolution_unsupported",
      field: "motionTransfer.resolutions",
      message: "Resolution is not supported.",
    });
  }

  if (input.fps != null && !mt.fps.includes(input.fps)) {
    reasons.push({
      reason: "fps_unsupported",
      field: "motionTransfer.fps",
      message: "FPS is not supported.",
    });
  }

  // Deduplicate by reason+field for determinism
  const seen = new Set<string>();
  const unique: MotionTransferIneligibility[] = [];
  for (const r of reasons) {
    const key = `${r.reason}:${r.field ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique.sort((a, b) =>
    a.reason === b.reason
      ? (a.field ?? "").localeCompare(b.field ?? "")
      : a.reason.localeCompare(b.reason),
  );
}

/** Count Production-eligible motion-transfer models in a snapshot. */
export function countEligibleMotionTransferModels(
  models: readonly ModelCapabilities[],
  input: MotionTransferHardConstraintInput,
): number {
  return models.filter((m) => satisfiesMotionTransferHardConstraints(m, input)).length;
}

export function parseMotionTransferModelCapabilities(
  raw: unknown,
): MotionTransferModelCapabilities {
  const parsed = MotionTransferModelCapabilitiesSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `invalid_motion_transfer_model_capabilities:${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  return parsed.data;
}

/** Stable JSON serialization (sorted keys via JSON.stringify default object order as authored). */
export function serializeMotionTransferModelCapabilities(
  caps: MotionTransferModelCapabilities,
): string {
  return JSON.stringify(caps);
}

/** Map estimateStrategy → expected PricingUnit conventions (documentation helper). */
export function pricingUnitsForMotionEstimateStrategy(
  strategy: MotionEstimateStrategy,
): readonly ("second" | "video" | "request")[] {
  switch (strategy) {
    case "per_second":
      return ["second"];
    case "per_job":
      return ["video", "request"];
    case "minimum_then_per_second":
      return ["second"];
    default: {
      const _e: never = strategy;
      return _e;
    }
  }
}

// Keep MotionFidelityValues referenced for compile-time alignment
void MotionFidelityValues;

/**
 * Motion QC policy (MT-009) — versioned, project-supplied thresholds.
 * No Tai-Chi-specific rules hardcoded.
 */

import { deepFreeze } from "../freeze";
import type { MotionFidelity } from "../types";

export const MOTION_QC_POLICY_SCHEMA_VERSION = "1.0.0" as const;

export type MotionQcMissingEvidenceBehavior = "human_review" | "reject";

export type MotionQcLayerPolicy = {
  required: boolean;
  /** When measurement unavailable for a required layer. */
  missingBehavior: MotionQcMissingEvidenceBehavior;
  /** Minimum confidence [0,1] — below → unavailable. */
  minConfidence: number;
  /** Pass threshold for similarity-like metrics [0,1] when present. */
  passThreshold?: number;
};

export type MotionQcPolicy = {
  schemaVersion: typeof MOTION_QC_POLICY_SCHEMA_VERSION;
  policyId: string;
  version: string;
  fidelityLevel: MotionFidelity;
  /** Relative duration tolerance (e.g. 0.15 = ±15%). */
  durationToleranceRatio: number;
  /** Absolute duration tolerance in seconds (max of ratio/abs applies). */
  durationToleranceSeconds: number;
  timingToleranceRatio: number;
  missingEvidenceBehavior: MotionQcMissingEvidenceBehavior;
  /** Critical fidelity always forces human review even if auto PASS. */
  criticalRequiresHumanReview: boolean;
  layers: {
    technical: MotionQcLayerPolicy;
    motionFidelity: MotionQcLayerPolicy;
    identityFidelity: MotionQcLayerPolicy;
    outfitFidelity: MotionQcLayerPolicy;
    bodyIntegrity: MotionQcLayerPolicy;
    temporalConsistency: MotionQcLayerPolicy;
    cameraCompliance: MotionQcLayerPolicy;
    checkpoints: MotionQcLayerPolicy;
  };
  /** Measurement set versions accepted by this policy. */
  acceptedMeasurementVersions: readonly string[];
};

function layer(
  required: boolean,
  passThreshold = 0.7,
  missingBehavior: MotionQcMissingEvidenceBehavior = "human_review",
): MotionQcLayerPolicy {
  return {
    required,
    missingBehavior,
    minConfidence: 0.5,
    passThreshold,
  };
}

/** Synthetic test policy — not a Tai-Chi product policy. */
export function createSyntheticMotionQcPolicy(
  over: Partial<
    Omit<MotionQcPolicy, "layers"> & {
      layers?: Partial<MotionQcPolicy["layers"]>;
    }
  > = {},
): Readonly<MotionQcPolicy> {
  const { layers: layerOver, ...rest } = over;
  const policy: MotionQcPolicy = {
    schemaVersion: MOTION_QC_POLICY_SCHEMA_VERSION,
    policyId: "synthetic-motion-qc",
    version: "mt009-test-1.0.0",
    fidelityLevel: "standard",
    durationToleranceRatio: 0.2,
    durationToleranceSeconds: 1,
    timingToleranceRatio: 0.25,
    missingEvidenceBehavior: "human_review",
    criticalRequiresHumanReview: true,
    acceptedMeasurementVersions: ["mt009-measurement-1.0.0"],
    ...rest,
    layers: {
      technical: {
        required: true,
        missingBehavior: "reject",
        minConfidence: 1,
        ...layerOver?.technical,
      },
      motionFidelity: { ...layer(true, 0.7), ...layerOver?.motionFidelity },
      identityFidelity: { ...layer(true, 0.75), ...layerOver?.identityFidelity },
      outfitFidelity: { ...layer(false, 0.7), ...layerOver?.outfitFidelity },
      bodyIntegrity: { ...layer(true, 0.7), ...layerOver?.bodyIntegrity },
      temporalConsistency: {
        ...layer(true, 0.7),
        ...layerOver?.temporalConsistency,
      },
      cameraCompliance: { ...layer(false, 0.7), ...layerOver?.cameraCompliance },
      checkpoints: { ...layer(true, 0.7), ...layerOver?.checkpoints },
    },
  };
  return deepFreeze(policy);
}

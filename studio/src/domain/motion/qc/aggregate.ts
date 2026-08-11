/**
 * Deterministic Motion QC aggregation (MT-009).
 *
 * Decision table (priority):
 * 1. technical invalid → reject
 * 2. critical fidelity → humanValidationRequired (even if auto pass)
 * 3. required FAIL retryable → retry
 * 4. required FAIL non-retryable → reject
 * 5. required UNAVAILABLE → human_review (or reject per policy)
 * 6. human_only / humanValidationRequired from spec → human_review
 * 7. all automatic pass + no human → pass
 */

import type {
  MotionFidelity,
  MotionQcIssue,
  MotionQcOverallStatus,
  MotionQcResult,
  MotionQcRequirement,
  MotionReferenceSpec,
  QcStatus,
} from "../types";
import { MOTION_QC_RESULT_SCHEMA_VERSION } from "../types";
import type { MotionQcMeasurementSet } from "./measurements";
import { findMetric } from "./measurements";
import type { MotionQcPolicy } from "./policy";
import type { MotionQcTechnicalResult } from "./technical";
import { evaluateOpaqueCheckpoints } from "./checkpoints";
import { deepFreeze } from "../freeze";

export type MotionQcLayerStatuses = {
  motionFidelity: QcStatus;
  identityFidelity: QcStatus;
  outfitFidelity: QcStatus;
  cameraCompliance: QcStatus;
  bodyIntegrity: QcStatus;
  temporalConsistency: QcStatus;
};

export type MotionQcAggregationInput = {
  technical: MotionQcTechnicalResult;
  measurements: MotionQcMeasurementSet;
  policy: MotionQcPolicy;
  fidelity: MotionFidelity;
  referenceSpec?: MotionReferenceSpec;
  qcRequirements: readonly MotionQcRequirement[];
};

function metricToStatus(
  set: MotionQcMeasurementSet,
  metricId: Parameters<typeof findMetric>[1],
  passThreshold: number,
  minConfidence: number,
): QcStatus {
  const m = findMetric(set, metricId);
  if (!m || !m.available || m.value == null) return "unknown";
  if (m.confidence < minConfidence) return "unknown";
  return m.value >= passThreshold ? "pass" : "fail";
}

function layerIssue(
  layer: MotionQcIssue["layer"],
  status: QcStatus,
  required: boolean,
  missingBehavior: "human_review" | "reject",
  codePrefix: string,
): MotionQcIssue | undefined {
  if (status === "pass" || status === "skipped") return undefined;
  if (status === "fail") {
    return {
      code: `${codePrefix}.fail`,
      severity: required ? "blocking" : "warning",
      message: `Couche ${codePrefix} en échec.`,
      layer,
      requirementClass: required ? "required" : "advisory",
      retryClass: required ? "retryable" : "retryable",
      reviewIntent: required ? "RETRY_WITH_SAME_REFERENCE" : undefined,
    };
  }
  // unknown
  if (!required) return undefined;
  return {
    code: `${codePrefix}.unavailable`,
    severity: "blocking",
    message: `Mesure required indisponible: ${codePrefix}.`,
    layer,
    requirementClass: "required",
    retryClass: missingBehavior === "reject" ? "nonRetryable" : "humanOnly",
    reviewIntent: missingBehavior === "reject" ? "REJECT" : undefined,
  };
}

export function evaluateMotionQcLayers(
  input: MotionQcAggregationInput,
): {
  layers: MotionQcLayerStatuses;
  checkpointResults: MotionQcResult["checkpointResults"];
  issues: MotionQcIssue[];
} {
  const p = input.policy.layers;
  const set = input.measurements;
  const layers: MotionQcLayerStatuses = {
    motionFidelity: metricToStatus(
      set,
      "motion_similarity",
      p.motionFidelity.passThreshold ?? 0.7,
      p.motionFidelity.minConfidence,
    ),
    identityFidelity: metricToStatus(
      set,
      "identity_similarity",
      p.identityFidelity.passThreshold ?? 0.75,
      p.identityFidelity.minConfidence,
    ),
    outfitFidelity: metricToStatus(
      set,
      "outfit_similarity",
      p.outfitFidelity.passThreshold ?? 0.7,
      p.outfitFidelity.minConfidence,
    ),
    cameraCompliance: metricToStatus(
      set,
      "camera_compliance",
      p.cameraCompliance.passThreshold ?? 0.7,
      p.cameraCompliance.minConfidence,
    ),
    bodyIntegrity: metricToStatus(
      set,
      "body_integrity",
      p.bodyIntegrity.passThreshold ?? 0.7,
      p.bodyIntegrity.minConfidence,
    ),
    temporalConsistency: metricToStatus(
      set,
      "temporal_consistency",
      p.temporalConsistency.passThreshold ?? 0.7,
      p.temporalConsistency.minConfidence,
    ),
  };

  // Timing metric can reinforce temporal
  const timing = findMetric(set, "phase_timing");
  if (
    timing?.available &&
    timing.value != null &&
    timing.confidence >= p.temporalConsistency.minConfidence
  ) {
    // value as ratio error — fail if above tolerance
    if (timing.value > input.policy.timingToleranceRatio) {
      layers.temporalConsistency = "fail";
    }
  }

  const issues: MotionQcIssue[] = [];
  const push = (i: MotionQcIssue | undefined) => {
    if (i) issues.push(i);
  };
  push(
    layerIssue(
      "motion_fidelity",
      layers.motionFidelity,
      p.motionFidelity.required,
      p.motionFidelity.missingBehavior,
      "motion_fidelity",
    ),
  );
  push(
    layerIssue(
      "identity_fidelity",
      layers.identityFidelity,
      p.identityFidelity.required,
      p.identityFidelity.missingBehavior,
      "identity_fidelity",
    ),
  );
  push(
    layerIssue(
      "outfit_fidelity",
      layers.outfitFidelity,
      p.outfitFidelity.required,
      p.outfitFidelity.missingBehavior,
      "outfit_fidelity",
    ),
  );
  push(
    layerIssue(
      "camera_compliance",
      layers.cameraCompliance,
      p.cameraCompliance.required,
      p.cameraCompliance.missingBehavior,
      "camera_compliance",
    ),
  );
  push(
    layerIssue(
      "body_integrity",
      layers.bodyIntegrity,
      p.bodyIntegrity.required,
      p.bodyIntegrity.missingBehavior,
      "body_integrity",
    ),
  );
  push(
    layerIssue(
      "temporal_consistency",
      layers.temporalConsistency,
      p.temporalConsistency.required,
      p.temporalConsistency.missingBehavior,
      "temporal_consistency",
    ),
  );

  // hands/feet & full-body — advisory unless required by fidelity critical
  for (const metricId of [
    "full_body_visibility",
    "hands_feet_confidence",
  ] as const) {
    const m = findMetric(set, metricId);
    if (!m || !m.available) {
      issues.push({
        code: `${metricId}.unavailable`,
        severity: "warning",
        message: `Mesure ${metricId} indisponible.`,
        layer: "body_integrity",
        requirementClass: "advisory",
        retryClass: "humanOnly",
      });
    } else if (
      m.confidence < p.bodyIntegrity.minConfidence ||
      (m.value != null && m.value < (p.bodyIntegrity.passThreshold ?? 0.7))
    ) {
      issues.push({
        code: `${metricId}.weak`,
        severity: "warning",
        message: `Mesure ${metricId} faible.`,
        layer: "body_integrity",
        requirementClass: "advisory",
        retryClass: "retryable",
      });
    }
  }

  const opaque = evaluateOpaqueCheckpoints({
    spec: input.referenceSpec,
    measurements: set,
    policy: input.policy,
  });
  issues.push(...opaque.issues);

  // Merge body integrity with relation failures
  if (opaque.bodyRelationIssues.some((i) => i.severity === "blocking")) {
    if (layers.bodyIntegrity === "pass") layers.bodyIntegrity = "fail";
  }

  return {
    layers,
    checkpointResults: [...opaque.checkpointResults],
    issues,
  };
}

export function aggregateMotionQcResult(
  input: MotionQcAggregationInput,
): Readonly<MotionQcResult> {
  const issues: MotionQcIssue[] = [...input.technical.issues];

  if (input.technical.status === "fail") {
    return deepFreeze({
      schemaVersion: MOTION_QC_RESULT_SCHEMA_VERSION,
      motionFidelity: "unknown",
      identityFidelity: "unknown",
      outfitFidelity: "unknown",
      cameraCompliance: "unknown",
      bodyIntegrity: "unknown",
      temporalConsistency: "unknown",
      checkpointResults: [],
      issues,
      overallStatus: "reject",
      humanValidationRequired: true,
    });
  }

  const evaluated = evaluateMotionQcLayers(input);
  issues.push(...evaluated.issues);

  // Spec / requirement human_only
  let humanValidationRequired =
    input.referenceSpec?.humanValidationRequired === true ||
    input.qcRequirements.some((r) => r.humanValidationRequired === true);

  for (const req of input.qcRequirements) {
    if (req.severity === "blocking" && req.humanValidationRequired) {
      humanValidationRequired = true;
      issues.push({
        code: `requirement.human_only:${req.code}`,
        severity: "blocking",
        message: "Exigence human_only.",
        layer: "human_review",
        requirementClass: "human_only",
        retryClass: "humanOnly",
      });
    }
  }

  if (
    input.fidelity === "critical" &&
    input.policy.criticalRequiresHumanReview
  ) {
    humanValidationRequired = true;
  }

  const requiredFails = issues.filter(
    (i) =>
      i.requirementClass === "required" &&
      i.severity === "blocking" &&
      i.retryClass === "retryable" &&
      i.code.includes(".fail"),
  );
  const requiredNonRetry = issues.filter(
    (i) =>
      i.requirementClass === "required" &&
      i.severity === "blocking" &&
      (i.retryClass === "nonRetryable" || i.reviewIntent === "REJECT") &&
      !i.code.includes(".unavailable"),
  );
  const requiredUnavailable = issues.filter(
    (i) =>
      i.requirementClass === "required" &&
      i.severity === "blocking" &&
      (i.code.includes(".unavailable") || i.retryClass === "humanOnly"),
  );

  let overallStatus: MotionQcOverallStatus = "pass";

  if (requiredNonRetry.length > 0) {
    overallStatus = "reject";
    humanValidationRequired = true;
  } else if (requiredFails.length > 0) {
    overallStatus = "retry";
    humanValidationRequired = true;
  } else if (requiredUnavailable.length > 0) {
    overallStatus =
      input.policy.missingEvidenceBehavior === "reject"
        ? "reject"
        : "human_review";
    humanValidationRequired = true;
  } else if (humanValidationRequired) {
    overallStatus = "human_review";
  } else {
    overallStatus = "pass";
  }

  // pass + human required stays human_review
  if (overallStatus === "pass" && humanValidationRequired) {
    overallStatus = "human_review";
  }

  return deepFreeze({
    schemaVersion: MOTION_QC_RESULT_SCHEMA_VERSION,
    ...evaluated.layers,
    checkpointResults: evaluated.checkpointResults,
    issues,
    overallStatus,
    humanValidationRequired,
  });
}

/** Map overall status → worker handoff phase / review outcome. */
export function motionQcHandoffFromResult(result: MotionQcResult): {
  phase: "qc_passed" | "qc_rejected" | "retry_recommended" | "qc_pending";
  outcome: "qc_passed" | "needs_review" | "rejected" | "retry_recommended";
} {
  if (result.overallStatus === "pass" && !result.humanValidationRequired) {
    return { phase: "qc_passed", outcome: "qc_passed" };
  }
  if (result.overallStatus === "reject") {
    return { phase: "qc_rejected", outcome: "rejected" };
  }
  if (result.overallStatus === "retry") {
    return { phase: "retry_recommended", outcome: "retry_recommended" };
  }
  // human_review or pass+human
  return { phase: "qc_pending", outcome: "needs_review" };
}

/**
 * Opaque checkpoint / body-relation evaluation (MT-009).
 * VHS does not interpret project-specific semantics (e.g. Tai-Chi).
 */

import type {
  MotionCheckpointResult,
  MotionQcIssue,
  MotionReferenceSpec,
  QcStatus,
} from "../types";
import type { MotionQcMeasurementSet } from "./measurements";
import { findMetric } from "./measurements";
import type { MotionQcPolicy } from "./policy";
import { deepFreeze } from "../freeze";

export type OpaqueCheckpointEvaluation = {
  checkpointResults: readonly MotionCheckpointResult[];
  bodyRelationIssues: readonly MotionQcIssue[];
  layerStatus: QcStatus;
  issues: readonly MotionQcIssue[];
};

function obsStatus(
  available: boolean | undefined,
  value: number | undefined,
  passThreshold: number,
  minConfidence: number,
  confidence: number,
): QcStatus {
  if (!available || value == null) return "unknown";
  if (confidence < minConfidence) return "unknown";
  return value >= passThreshold ? "pass" : "fail";
}

/**
 * Match checkpoints / body relations by opaque IDs only.
 */
export function evaluateOpaqueCheckpoints(input: {
  spec: MotionReferenceSpec | undefined;
  measurements: MotionQcMeasurementSet;
  policy: MotionQcPolicy;
}): Readonly<OpaqueCheckpointEvaluation> {
  const issues: MotionQcIssue[] = [];
  const bodyRelationIssues: MotionQcIssue[] = [];
  const checkpointResults: MotionCheckpointResult[] = [];
  const layer = input.policy.layers.checkpoints;
  const threshold = layer.passThreshold ?? 0.7;

  if (!input.spec) {
    if (layer.required) {
      issues.push({
        code: "checkpoint.spec_missing",
        severity: "blocking",
        message: "MotionReferenceSpec absente pour checkpoints required.",
        layer: "checkpoint",
        requirementClass: "required",
        retryClass: "requiresUpdatedConstraints",
        reviewIntent: "RETRY_WITH_UPDATED_CONSTRAINTS",
      });
      return deepFreeze({
        checkpointResults: [],
        bodyRelationIssues: [],
        layerStatus: "unknown",
        issues,
      });
    }
    return deepFreeze({
      checkpointResults: [],
      bodyRelationIssues: [],
      layerStatus: "skipped",
      issues: [],
    });
  }

  let anyFail = false;
  let anyUnknown = false;

  for (const cp of input.spec.checkpoints) {
    const m = findMetric(
      input.measurements,
      "checkpoint_observation",
      cp.checkpointId,
    );
    const status = obsStatus(
      m?.available,
      m?.value,
      threshold,
      layer.minConfidence,
      m?.confidence ?? 0,
    );
    checkpointResults.push({
      checkpointId: cp.checkpointId,
      status,
      notes: m?.unavailableReason,
    });
    if (status === "fail") {
      anyFail = true;
      if (cp.mandatory || layer.required) {
        issues.push({
          code: `checkpoint.fail:${cp.checkpointId}`,
          severity: "blocking",
          message: "Checkpoint opaque en échec.",
          layer: "checkpoint",
          requirementClass: "required",
          retryClass: "retryable",
          reviewIntent: "RETRY_WITH_SAME_REFERENCE",
        });
      } else {
        issues.push({
          code: `checkpoint.advisory_fail:${cp.checkpointId}`,
          severity: "warning",
          message: "Checkpoint advisory en échec.",
          layer: "checkpoint",
          requirementClass: "advisory",
          retryClass: "retryable",
        });
      }
    } else if (status === "unknown") {
      anyUnknown = true;
      if (cp.mandatory || layer.required) {
        issues.push({
          code: `checkpoint.unavailable:${cp.checkpointId}`,
          severity: "blocking",
          message: "Observation checkpoint absente / confiance insuffisante.",
          layer: "checkpoint",
          requirementClass: "required",
          retryClass: "humanOnly",
          reviewIntent: "REJECT",
        });
      }
    }
  }

  for (const rel of input.spec.bodyRelations) {
    const m = findMetric(
      input.measurements,
      "body_relation_observation",
      rel.relationId,
    );
    const status = obsStatus(
      m?.available,
      m?.value,
      threshold,
      layer.minConfidence,
      m?.confidence ?? 0,
    );
    if (status === "fail" && rel.mandatory) {
      anyFail = true;
      bodyRelationIssues.push({
        code: `body_relation.fail:${rel.relationId}`,
        severity: "blocking",
        message: "Relation corporelle opaque en échec.",
        layer: "body_integrity",
        requirementClass: "required",
        retryClass: "retryable",
        reviewIntent: "RETRY_WITH_SAME_REFERENCE",
      });
    } else if (status === "unknown" && rel.mandatory) {
      anyUnknown = true;
      bodyRelationIssues.push({
        code: `body_relation.unavailable:${rel.relationId}`,
        severity: "blocking",
        message: "Relation corporelle non observée.",
        layer: "body_integrity",
        requirementClass: "required",
        retryClass: "humanOnly",
      });
    }
  }

  issues.push(...bodyRelationIssues);

  let layerStatus: QcStatus = "pass";
  if (anyFail) layerStatus = "fail";
  else if (anyUnknown) layerStatus = "unknown";

  return deepFreeze({
    checkpointResults,
    bodyRelationIssues,
    layerStatus,
    issues,
  });
}

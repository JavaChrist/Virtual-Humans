/**
 * Production-safe Motion QC measurement port — honest unavailable metrics.
 * Never invents fidelity scores. Fake adapter must not be resolved in Production.
 */

import { deepFreeze } from "@/domain/motion";
import {
  MOTION_QC_MEASUREMENT_SET_VERSION,
  assertMeasurementSetValid,
  type MotionQcMeasurement,
  type MotionQcMetricId,
} from "@/domain/motion/qc";
import type {
  MotionQcMeasurementContext,
  MotionQcMeasurementInput,
  MotionQcMeasurementPort,
} from "./motion-qc-measurement-port";

export const UNAVAILABLE_MOTION_QC_MEASUREMENT_VERSION =
  "mt013k-unavailable-1.0.0" as const;

const UNAVAILABLE_METRICS: readonly MotionQcMetricId[] = [
  "motion_similarity",
  "identity_similarity",
  "outfit_similarity",
  "body_integrity",
  "temporal_consistency",
  "camera_compliance",
  "phase_timing",
  "full_body_visibility",
  "hands_feet_confidence",
  "checkpoint_observation",
  "body_relation_observation",
] as const;

function unavailable(
  metricId: MotionQcMetricId,
  version: string,
): MotionQcMeasurement {
  return {
    metricId,
    unit: "ratio",
    confidence: 0,
    source: "none",
    measurementVersion: version,
    available: false,
    unavailableReason: "no_real_motion_measurement_adapter",
  };
}

/**
 * Honest Production measurement port — all Motion fidelity metrics unavailable.
 * Technical QC (MIME/duration/dims/…) stays separate in evaluateMotionTechnicalQc.
 */
export function createUnavailableMotionQcMeasurementPort(options?: {
  measurementVersion?: string;
}): MotionQcMeasurementPort & { readonly kind: "unavailable" } {
  const version =
    options?.measurementVersion ?? MOTION_QC_MEASUREMENT_SET_VERSION;
  return {
    kind: "unavailable",
    measurementVersion: version,
    async measure(
      _input: MotionQcMeasurementInput,
      context: MotionQcMeasurementContext,
    ) {
      return assertMeasurementSetValid(
        deepFreeze({
          schemaVersion: "1.0.0",
          measurementVersion: version,
          measuredAt: context.nowIso,
          measurements: UNAVAILABLE_METRICS.map((id) => unavailable(id, version)),
        }),
      );
    },
  };
}

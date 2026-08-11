/**
 * Configurable fake Motion QC measurement port (MT-009).
 * Forbidden on Vercel/Production without harness.
 */

import {
  MOTION_QC_MEASUREMENT_SET_VERSION,
  assertMeasurementSetValid,
  type MotionQcMeasurement,
  type MotionQcMeasurementSet,
  type MotionQcMetricId,
} from "@/domain/motion/qc";
import { MotionTransferDomainError, deepFreeze } from "@/domain/motion";
import { assertMotionQcFakeMeasurementAllowed } from "./assert-motion-qc-fake-allowed";
import type {
  MotionQcMeasurementInput,
  MotionQcMeasurementPort,
} from "./motion-qc-measurement-port";

export type FakeMotionQcMetricOverride = {
  metricId: MotionQcMetricId;
  subjectId?: string;
  available?: boolean;
  value?: number;
  confidence?: number;
  unavailableReason?: string;
};

export type FakeMotionQcMeasurementOptions = {
  env?: Record<string, string | undefined>;
  /** Default value for similarity metrics when not overridden. */
  defaultPassValue?: number;
  defaultConfidence?: number;
  overrides?: readonly FakeMotionQcMetricOverride[];
  /** When true, return empty measurements (all unavailable). */
  empty?: boolean;
  measurementVersion?: string;
};

function baseMetric(
  metricId: MotionQcMetricId,
  value: number,
  confidence: number,
  subjectId?: string,
): MotionQcMeasurement {
  return {
    metricId,
    value,
    unit: "ratio",
    confidence,
    source: "fake-motion-qc",
    measurementVersion: MOTION_QC_MEASUREMENT_SET_VERSION,
    available: true,
    subjectId,
    evidenceRefs: [`ev:fake:${metricId}${subjectId ? `:${subjectId}` : ""}`],
  };
}

export function createFakeMotionQcMeasurementPort(
  options: FakeMotionQcMeasurementOptions = {},
): MotionQcMeasurementPort & { readonly kind: "fake" } {
  const guard = assertMotionQcFakeMeasurementAllowed(options.env);
  if (!guard.ok) {
    throw new MotionTransferDomainError(
      "provider_not_configured",
      "Fake Motion QC measurement interdit hors harness.",
      { diagnostic: `fake_qc_forbidden:${guard.reason}` },
    );
  }

  const defaultValue = options.defaultPassValue ?? 0.9;
  const defaultConfidence = options.defaultConfidence ?? 0.95;
  const version = options.measurementVersion ?? MOTION_QC_MEASUREMENT_SET_VERSION;

  return {
    kind: "fake",
    measurementVersion: version,
    async measure(input: MotionQcMeasurementInput, context) {
      if (options.empty) {
        return assertMeasurementSetValid(
          deepFreeze({
            schemaVersion: "1.0.0",
            measurementVersion: version,
            measuredAt: context.nowIso,
            measurements: [],
          }),
        );
      }

      const measurements: MotionQcMeasurement[] = [
        baseMetric("motion_similarity", defaultValue, defaultConfidence),
        baseMetric("identity_similarity", defaultValue, defaultConfidence),
        baseMetric("outfit_similarity", defaultValue, defaultConfidence),
        baseMetric("body_integrity", defaultValue, defaultConfidence),
        baseMetric("temporal_consistency", defaultValue, defaultConfidence),
        baseMetric("camera_compliance", defaultValue, defaultConfidence),
        baseMetric("phase_timing", 0.05, defaultConfidence),
        baseMetric("full_body_visibility", defaultValue, defaultConfidence),
        baseMetric("hands_feet_confidence", defaultValue, defaultConfidence),
      ];

      const spec = input.referenceSpec ?? input.motionInput.referenceSpec;
      if (spec) {
        for (const cp of spec.checkpoints) {
          measurements.push(
            baseMetric(
              "checkpoint_observation",
              defaultValue,
              defaultConfidence,
              cp.checkpointId,
            ),
          );
        }
        for (const rel of spec.bodyRelations) {
          measurements.push(
            baseMetric(
              "body_relation_observation",
              defaultValue,
              defaultConfidence,
              rel.relationId,
            ),
          );
        }
      }

      for (const o of options.overrides ?? []) {
        const idx = measurements.findIndex(
          (m) =>
            m.metricId === o.metricId &&
            (o.subjectId == null || m.subjectId === o.subjectId),
        );
        const next: MotionQcMeasurement = {
          metricId: o.metricId,
          subjectId: o.subjectId,
          unit: "ratio",
          source: "fake-motion-qc",
          measurementVersion: version,
          confidence: o.confidence ?? defaultConfidence,
          available: o.available !== false,
          value: o.available === false ? undefined : (o.value ?? defaultValue),
          unavailableReason:
            o.available === false
              ? (o.unavailableReason ?? "fake_unavailable")
              : undefined,
          evidenceRefs: [`ev:fake:${o.metricId}`],
        };
        if (idx >= 0) measurements[idx] = next;
        else measurements.push(next);
      }

      const set: MotionQcMeasurementSet = {
        schemaVersion: "1.0.0",
        measurementVersion: version,
        measuredAt: context.nowIso,
        measurements,
      };
      return assertMeasurementSetValid(set);
    },
  };
}

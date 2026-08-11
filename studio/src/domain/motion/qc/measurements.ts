/**
 * Motion QC measurement contracts (MT-009).
 * Provider-agnostic — no OpenPose/DWPose/CV engine in-repo.
 */

import { MotionTransferDomainError } from "../errors";
import { deepFreeze } from "../freeze";

export const MOTION_QC_MEASUREMENT_SET_VERSION = "mt009-measurement-1.0.0" as const;

export const MotionQcMetricIdValues = [
  "motion_similarity",
  "phase_timing",
  "identity_similarity",
  "outfit_similarity",
  "body_integrity",
  "temporal_consistency",
  "camera_compliance",
  "full_body_visibility",
  "hands_feet_confidence",
  "checkpoint_observation",
  "body_relation_observation",
] as const;
export type MotionQcMetricId = (typeof MotionQcMetricIdValues)[number];

export type MotionQcMeasurement = {
  metricId: MotionQcMetricId;
  /** Bound [0,1] for similarity/confidence-style metrics; timing may use seconds. */
  value?: number;
  unit: "ratio" | "seconds" | "boolean" | "opaque";
  confidence: number;
  source: string;
  measurementVersion: string;
  available: boolean;
  unavailableReason?: string;
  /** Opaque checkpoint / relation id when metric is observation. */
  subjectId?: string;
  timeRangeSeconds?: { start: number; end: number };
  frameRange?: { start: number; end: number };
  evidenceRefs?: readonly string[];
};

export type MotionQcMeasurementSet = {
  schemaVersion: "1.0.0";
  measurementVersion: typeof MOTION_QC_MEASUREMENT_SET_VERSION | string;
  measuredAt: string;
  measurements: readonly MotionQcMeasurement[];
};

export function assertMeasurementValid(m: MotionQcMeasurement): void {
  if (m.confidence < 0 || m.confidence > 1 || !Number.isFinite(m.confidence)) {
    throw new MotionTransferDomainError(
      "qc_rejected",
      "Confidence de mesure invalide.",
      { diagnostic: `metric=${m.metricId}` },
    );
  }
  if (!m.measurementVersion?.trim()) {
    throw new MotionTransferDomainError(
      "qc_rejected",
      "Version de mesure absente.",
    );
  }
  if (!m.source?.trim()) {
    throw new MotionTransferDomainError(
      "qc_rejected",
      "Provenance de mesure absente.",
    );
  }
  if (m.available) {
    if (m.value == null || !Number.isFinite(m.value)) {
      throw new MotionTransferDomainError(
        "qc_rejected",
        "Mesure disponible sans valeur.",
        { diagnostic: `metric=${m.metricId}` },
      );
    }
    if (m.unit === "ratio" && (m.value < 0 || m.value > 1)) {
      throw new MotionTransferDomainError(
        "qc_rejected",
        "Score ratio hors bornes [0,1].",
        { diagnostic: `metric=${m.metricId}` },
      );
    }
  } else if (!m.unavailableReason?.trim()) {
    throw new MotionTransferDomainError(
      "qc_rejected",
      "Mesure indisponible sans raison.",
      { diagnostic: `metric=${m.metricId}` },
    );
  }
}

export function assertMeasurementSetValid(
  set: MotionQcMeasurementSet,
): Readonly<MotionQcMeasurementSet> {
  if (!set.measurementVersion?.trim()) {
    throw new MotionTransferDomainError(
      "qc_rejected",
      "measurementVersion manquante.",
    );
  }
  for (const m of set.measurements) {
    assertMeasurementValid(m);
  }
  return deepFreeze(set);
}

export function findMetric(
  set: MotionQcMeasurementSet,
  metricId: MotionQcMetricId,
  subjectId?: string,
): MotionQcMeasurement | undefined {
  return set.measurements.find(
    (m) =>
      m.metricId === metricId &&
      (subjectId == null || m.subjectId === subjectId),
  );
}

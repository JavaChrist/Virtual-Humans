/**
 * Motion QC evidence descriptors (MT-009) — private refs only.
 */

import { deepFreeze } from "../freeze";
import { MotionTransferDomainError } from "../errors";

export type MotionQcEvidenceDescriptor = {
  evidenceId: string;
  role: "motion_qc_evidence";
  assetId?: string;
  contentFingerprint: string;
  mimeType: string;
  timeRangeSeconds?: { start: number; end: number };
  frameRange?: { start: number; end: number };
  metricIds?: readonly string[];
  checkpointIds?: readonly string[];
  checksum?: string;
  provenance: {
    correlationId: string;
    providerId?: string;
    modelId?: string;
    measurementVersion: string;
  };
};

export function assertMotionQcEvidenceSafe(
  evidence: MotionQcEvidenceDescriptor,
): Readonly<MotionQcEvidenceDescriptor> {
  const blob = JSON.stringify(evidence);
  if (/https?:\/\//i.test(blob) || /data:[^;]+;base64,/i.test(blob)) {
    throw new MotionTransferDomainError(
      "qc_rejected",
      "Evidence QC contient une URL/média interdit.",
    );
  }
  if (evidence.role !== "motion_qc_evidence") {
    throw new MotionTransferDomainError(
      "qc_rejected",
      "Role evidence invalide.",
    );
  }
  return deepFreeze(evidence);
}

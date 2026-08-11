/**
 * Redacted Motion QC observability (MT-009).
 * MT-011 — assert delegates to central Motion sanitizer.
 */

import { assertMotionSurfaceRedacted } from "@/domain/motion/security";

export type MotionQcEventType =
  | "motion.qc.started"
  | "motion.qc.technical.completed"
  | "motion.qc.measurements.completed"
  | "motion.qc.checkpoint.failed"
  | "motion.qc.completed"
  | "motion.qc.needs_review"
  | "motion.qc.rejected"
  | "motion.qc.retry_recommended";

export type MotionQcEvent = {
  type: MotionQcEventType;
  correlationId: string;
  workspaceId?: string;
  projectId: string;
  runId: string;
  jobId?: string;
  policyId?: string;
  policyVersion?: string;
  measurementVersion?: string;
  passCount?: number;
  failCount?: number;
  unavailableCount?: number;
  overallStatus?: string;
  humanValidationRequired?: boolean;
};

export type MotionQcEventSink = {
  emit(event: MotionQcEvent): void;
};

export function assertMotionQcEventRedacted(event: MotionQcEvent): void {
  assertMotionSurfaceRedacted(event, "motion_qc_event");
}

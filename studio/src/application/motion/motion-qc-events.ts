/**
 * Redacted Motion QC observability (MT-009).
 */

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
  const blob = JSON.stringify(event);
  if (/https?:\/\//i.test(blob) || /data:[^;]+;base64,/i.test(blob)) {
    throw new Error("motion_qc_event_media_leak");
  }
  if (/\bsk-[A-Za-z0-9]{10,}/i.test(blob)) {
    throw new Error("motion_qc_event_secret_leak");
  }
}

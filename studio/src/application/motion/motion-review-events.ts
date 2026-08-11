/**
 * Redacted Motion human-review observability (MT-010).
 */

export type MotionReviewEventType =
  | "motion.review.opened"
  | "motion.review.decision.recorded"
  | "motion.review.decision.existing"
  | "motion.review.conflict"
  | "motion.review.rejected"
  | "motion.review.retry_requested"
  | "motion.review.new_reference_requested";

export type MotionReviewEvent = {
  type: MotionReviewEventType;
  correlationId: string;
  workspaceId?: string;
  projectId: string;
  runId?: string;
  resultId?: string;
  reviewRequestId?: string;
  decisionId?: string;
  actorId?: string;
  decision?: string;
  revision?: number;
  policyVersion?: string;
};

export type MotionReviewEventSink = {
  emit(event: MotionReviewEvent): void;
};

export function assertMotionReviewEventRedacted(event: MotionReviewEvent): void {
  const blob = JSON.stringify(event);
  if (/https?:\/\//i.test(blob) || /data:[^;]+;base64,/i.test(blob)) {
    throw new Error("motion_review_event_media_leak");
  }
  if (/\bsk-[A-Za-z0-9]{10,}/i.test(blob)) {
    throw new Error("motion_review_event_secret_leak");
  }
}

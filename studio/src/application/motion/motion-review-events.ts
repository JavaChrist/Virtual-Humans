/**
 * Redacted Motion human-review observability (MT-010).
 * MT-011 — assert delegates to central Motion sanitizer.
 */

import { assertMotionSurfaceRedacted } from "@/domain/motion/security";

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
  assertMotionSurfaceRedacted(event, "motion_review_event");
}

/**
 * Phase 11B — I2V Human Review handoff scaffold. No Production session is created here.
 */
import { assertPhase11AOutputNotAutoActive } from "./phase-11a-human-review-gate";

export const PHASE_11B_HUMAN_REVIEW_REQUIRED = true as const;

export type Phase11BI2vReviewDecision = "pending" | "approved" | "rejected" | "retry_intent_only";

export function createPhase11BI2vReviewHandoff(input: {
  outputAssetId: string;
  qualityReportId: string;
  reviewRequestId: string;
}): {
  outputAssetId: string;
  qualityReportId: string;
  reviewRequestId: string;
  decision: "pending";
  activationAuthorized: false;
  mergeExportAuthorized: false;
  retryCreatesJob: false;
  persistedToProduction: false;
} {
  assertPhase11AOutputNotAutoActive({
    active: false,
    published: false,
    mergeRequested: false,
    exportRequested: false,
    downstreamRequested: false,
  });
  return {
    outputAssetId: input.outputAssetId,
    qualityReportId: input.qualityReportId,
    reviewRequestId: input.reviewRequestId,
    decision: "pending",
    activationAuthorized: false,
    mergeExportAuthorized: false,
    retryCreatesJob: false,
    persistedToProduction: false,
  };
}

export function assertPhase11BI2vReviewStaysLocal(persistedToProduction: boolean): void {
  if (persistedToProduction) {
    throw new Error("Phase 11B must not create a Production Human Review session.");
  }
}

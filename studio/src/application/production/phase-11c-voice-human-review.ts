/**
 * Phase 11C — Voice Human Review handoff. No Production session is created here.
 * APPROVE means the audio may later be considered for a lipsync gate. It does not open that gate.
 */
export const PHASE_11C_HUMAN_REVIEW_REQUIRED = true as const;

export type Phase11CVoiceReviewDecision = "pending" | "approved" | "rejected";

export type Phase11CVoiceReviewHandoff = {
  outputAssetId: string;
  qualityReportId: string;
  reviewRequestId: string;
  expectedRevision: number;
  decision: Phase11CVoiceReviewDecision;
  comment?: string;
  activationAuthorized: false;
  lipsyncAuthorized: false;
  mergeExportAuthorized: false;
  retryCreatesJob: false;
  persistedToProduction: false;
};

export function createPhase11CVoiceReviewHandoff(input: {
  outputAssetId: string;
  qualityReportId: string;
  reviewRequestId: string;
  expectedRevision: number;
}): Phase11CVoiceReviewHandoff {
  return {
    outputAssetId: input.outputAssetId,
    qualityReportId: input.qualityReportId,
    reviewRequestId: input.reviewRequestId,
    expectedRevision: input.expectedRevision,
    decision: "pending",
    activationAuthorized: false,
    lipsyncAuthorized: false,
    mergeExportAuthorized: false,
    retryCreatesJob: false,
    persistedToProduction: false,
  };
}

export function applyPhase11CVoiceReviewDecision(input: {
  current: Phase11CVoiceReviewHandoff;
  decision: Exclude<Phase11CVoiceReviewDecision, "pending">;
  comment: string;
  expectedRevision: number;
}): Phase11CVoiceReviewHandoff {
  if (input.expectedRevision !== input.current.expectedRevision) {
    throw new Error("Phase 11C Human Review: optimistic lock conflict.");
  }
  if (input.current.decision !== "pending") {
    if (input.current.decision === input.decision) {
      return {
        ...input.current,
        decision: input.decision,
        comment: input.comment,
        lipsyncAuthorized: false,
        activationAuthorized: false,
      };
    }
    throw new Error("Phase 11C Human Review: replay must stay idempotent.");
  }
  return {
    ...input.current,
    decision: input.decision,
    comment: input.comment,
    expectedRevision: input.current.expectedRevision + 1,
    lipsyncAuthorized: false,
    activationAuthorized: false,
    retryCreatesJob: false,
  };
}

export function assertPhase11CVoiceReviewStaysLocal(persistedToProduction: boolean): void {
  if (persistedToProduction) {
    throw new Error("Phase 11C must not create a Production Human Review session.");
  }
}

export function assertPhase11CVoiceApproveDoesNotOpenLipsync(lipsyncAuthorized: boolean): void {
  if (lipsyncAuthorized) {
    throw new Error("Phase 11C Voice APPROVE must not authorize the lipsync gate.");
  }
}

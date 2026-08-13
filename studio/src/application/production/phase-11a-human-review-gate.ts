/**
 * Phase 11A — Human Review gate before any activation/publication.
 * Append-only decisions; no auto retry/merge/export/downstream.
 */

export const PHASE_11A_HUMAN_REVIEW_REQUIRED = true as const;

export type Phase11AHumanReviewDecision =
  | "pending"
  | "approved"
  | "rejected"
  | "retry_intent_only";

export type Phase11AHumanReviewRecord = {
  decision: Phase11AHumanReviewDecision;
  decidedAt: string;
  actorId: string;
  assetId: string;
  /** Append-only sequence (1-based). */
  sequence: number;
  notesRedacted?: string;
};

export function assertPhase11AOutputNotAutoActive(input: {
  active: boolean;
  published: boolean;
  mergeRequested: boolean;
  exportRequested: boolean;
  downstreamRequested: boolean;
}): void {
  if (input.active) {
    throw new Error("Phase 11A: asset must remain active=false until Human Review approve.");
  }
  if (input.published) {
    throw new Error("Phase 11A: publication forbidden without Human Review.");
  }
  if (input.mergeRequested || input.exportRequested || input.downstreamRequested) {
    throw new Error("Phase 11A: merge/export/downstream forbidden.");
  }
}

export function assertPhase11AActivationAllowed(input: {
  technicalQcStatus: "accepted" | "needs_review" | "rejected";
  reviews: readonly Phase11AHumanReviewRecord[];
}): void {
  if (input.technicalQcStatus === "rejected") {
    throw new Error("Phase 11A: cannot activate after technical QC reject.");
  }
  if (!PHASE_11A_HUMAN_REVIEW_REQUIRED) {
    throw new Error("Phase 11A: Human Review flag unexpectedly off.");
  }
  const last = input.reviews[input.reviews.length - 1];
  if (!last || last.decision !== "approved") {
    throw new Error("Phase 11A: Human Review approved decision required before activation.");
  }
  // Ensure append-only monotonic sequences
  for (let i = 0; i < input.reviews.length; i++) {
    if (input.reviews[i]!.sequence !== i + 1) {
      throw new Error("Phase 11A: Human Review sequence must be append-only.");
    }
  }
}

export function assertPhase11ARetryIsIntentOnly(decision: Phase11AHumanReviewDecision): void {
  if (decision === "retry_intent_only") return;
  throw new Error("Phase 11A: automatic retry creation forbidden — intent-only retry.");
}

/** REJECT closes Human Review without activation, retry, or downstream. */
export function assertPhase11ARejectedBlocksActivationAndDownstream(input: {
  decision: Phase11AHumanReviewDecision;
  active: boolean;
  mergeRequested: boolean;
  exportRequested: boolean;
  retryJobCreated: boolean;
  providerCalls: number;
}): void {
  if (input.decision !== "rejected") {
    throw new Error("Phase 11A: expected rejected Human Review decision.");
  }
  if (input.active) {
    throw new Error("Phase 11A: rejected asset must remain active=false.");
  }
  if (input.mergeRequested || input.exportRequested) {
    throw new Error("Phase 11A: rejected asset must not enter merge/export.");
  }
  if (input.retryJobCreated) {
    throw new Error("Phase 11A: REJECT must not create a retry job.");
  }
  if (input.providerCalls !== 0) {
    throw new Error("Phase 11A: REJECT must not call a provider.");
  }
}

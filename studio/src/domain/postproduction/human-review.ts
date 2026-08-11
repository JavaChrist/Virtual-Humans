/**
 * Human review decisions — append-only, no UI (VHS-111 / MT-005).
 */

import { PostProductionDomainError } from "./errors";

export const MAX_HUMAN_REVIEW_COMMENT_LENGTH = 2000;

/** SQL + domain decision values (column human_review_decisions.decision). */
export const HumanReviewDecisionStatusValues = [
  "approved",
  "rejected",
  "retry_same_reference",
  "retry_updated_constraints",
  "request_new_reference",
] as const;

export type HumanReviewDecisionStatus =
  (typeof HumanReviewDecisionStatusValues)[number];

export type HumanReviewDecision = {
  id: string;
  productionRunId: string;
  /** ProductionResult revision id this decision targets. */
  productionResultRevisionId: string;
  productionResultRevision: number;
  status: HumanReviewDecisionStatus;
  decidedAt: string;
  decidedBy: string;
  reviewedIssueCodes: string[];
  comment?: string;
};

/** Technical corruption codes that human review cannot waive. */
export const NON_WAIVABLE_TECHNICAL_CODES = new Set([
  "asset_absent",
  "source_expired",
  "invalid_mime",
  "empty_file",
  "missing_asset",
  "expired_asset",
]);

function isKnownDecisionStatus(
  status: string,
): status is HumanReviewDecisionStatus {
  return (HumanReviewDecisionStatusValues as readonly string[]).includes(status);
}

export function createHumanReviewDecision(input: {
  id: string;
  productionRunId: string;
  productionResultRevisionId: string;
  productionResultRevision: number;
  status: HumanReviewDecisionStatus;
  decidedAt: string;
  decidedBy: string;
  reviewedIssueCodes: string[];
  comment?: string;
  /** Blocking technical codes still present on the report. */
  remainingBlockingTechnicalCodes?: string[];
}): HumanReviewDecision {
  if (!input.id?.trim() || !input.decidedBy?.trim()) {
    throw new PostProductionDomainError("human_review_invalid", "id et decidedBy requis.");
  }
  if (!isKnownDecisionStatus(input.status)) {
    throw new PostProductionDomainError("human_review_invalid", "Statut de revue invalide.");
  }
  if (input.comment != null && input.comment.length > MAX_HUMAN_REVIEW_COMMENT_LENGTH) {
    throw new PostProductionDomainError(
      "human_review_invalid",
      "Commentaire trop long."
    );
  }

  if (input.status === "approved") {
    const remaining = input.remainingBlockingTechnicalCodes ?? [];
    const nonWaivable = remaining.filter((c) => NON_WAIVABLE_TECHNICAL_CODES.has(c));
    if (nonWaivable.length > 0) {
      throw new PostProductionDomainError(
        "human_review_invalid",
        "Impossible d'ignorer une corruption technique non récupérable.",
        nonWaivable.join(",")
      );
    }
  }

  const decision: HumanReviewDecision = {
    id: input.id,
    productionRunId: input.productionRunId,
    productionResultRevisionId: input.productionResultRevisionId,
    productionResultRevision: input.productionResultRevision,
    status: input.status,
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    reviewedIssueCodes: [...input.reviewedIssueCodes],
  };
  if (input.comment) decision.comment = input.comment;
  return Object.freeze(decision);
}

export function assertReviewTargetsRevision(
  decision: HumanReviewDecision,
  active: { revisionId: string; revision: number }
): void {
  if (
    decision.productionResultRevisionId !== active.revisionId ||
    decision.productionResultRevision !== active.revision
  ) {
    throw new PostProductionDomainError(
      "human_review_invalid",
      "La revue cible une révision obsolète."
    );
  }
}

/** Final delivery/export may proceed only after APPROVE. */
export function isFinalizableHumanReview(
  status: HumanReviewDecisionStatus,
): boolean {
  return status === "approved";
}

export function isRetryHumanReview(
  status: HumanReviewDecisionStatus,
): boolean {
  return (
    status === "retry_same_reference" ||
    status === "retry_updated_constraints" ||
    status === "request_new_reference"
  );
}

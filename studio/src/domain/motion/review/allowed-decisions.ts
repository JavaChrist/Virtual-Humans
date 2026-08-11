/**
 * Pure helper — map Motion QC result / policy / review state → allowed SQL decisions.
 * MT-010 — no job / provider / merge side effects.
 */

import type { MotionQcResult } from "../types";
import type { MotionHumanReviewDecision } from "../persistence";
import type { MotionQcPolicy } from "../qc/policy";

export type MotionReviewGateState = {
  /** Worker / handoff outcome. */
  outcome:
    | "needs_review"
    | "qc_passed"
    | "retry_recommended"
    | "rejected"
    | "qc_pending"
    | "provider_incomplete"
    | "quarantined"
    | "unavailable";
  humanValidationRequired: boolean;
  qualityReportPresent: boolean;
  qualityReportStale: boolean;
  lateQuarantined?: boolean;
  reconciliationRequired?: boolean;
};

export type AllowedHumanReviewDecisionsResult = {
  allowed: readonly MotionHumanReviewDecision[];
  reasons: readonly string[];
  approveBlockedReasons: readonly string[];
};

function hasRequiredBlockingIssues(qc: MotionQcResult): boolean {
  return qc.issues.some(
    (i) =>
      i.severity === "blocking" &&
      (i.requirementClass === "required" || i.requirementClass === "human_only"),
  );
}

function hasRetryableIssues(qc: MotionQcResult): boolean {
  return qc.issues.some(
    (i) =>
      i.severity === "blocking" &&
      (i.retryClass === "retryable" ||
        i.retryClass === "requiresUpdatedConstraints" ||
        i.reviewIntent === "RETRY_WITH_SAME_REFERENCE" ||
        i.reviewIntent === "RETRY_WITH_UPDATED_CONSTRAINTS"),
  );
}

function requiresNewReference(qc: MotionQcResult): boolean {
  return qc.issues.some(
    (i) =>
      i.retryClass === "requiresNewReference" ||
      i.reviewIntent === "REQUEST_NEW_REFERENCE",
  );
}

function nonRetryableCritical(qc: MotionQcResult): boolean {
  return (
    qc.overallStatus === "reject" ||
    qc.issues.some(
      (i) =>
        i.severity === "blocking" &&
        (i.retryClass === "nonRetryable" || i.reviewIntent === "REJECT") &&
        i.requirementClass === "required",
    )
  );
}

/**
 * Deterministic allow-list of human_review_decisions.decision values.
 */
export function allowedHumanReviewDecisions(
  qcResult: MotionQcResult | null,
  _policy: MotionQcPolicy | null,
  state: MotionReviewGateState,
): AllowedHumanReviewDecisionsResult {
  const reasons: string[] = [];
  const approveBlocked: string[] = [];

  if (
    state.outcome === "provider_incomplete" ||
    state.outcome === "qc_pending" ||
    state.outcome === "unavailable"
  ) {
    reasons.push("review_state_incompatible");
    return { allowed: [], reasons, approveBlockedReasons: ["review_state_incompatible"] };
  }
  if (state.lateQuarantined || state.reconciliationRequired) {
    reasons.push("quarantined_or_unreconciled");
    return { allowed: [], reasons, approveBlockedReasons: ["quarantined_or_unreconciled"] };
  }
  if (!state.qualityReportPresent) {
    reasons.push("quality_report_absent");
    return { allowed: [], reasons, approveBlockedReasons: ["quality_report_absent"] };
  }
  if (state.qualityReportStale) {
    reasons.push("quality_report_stale");
    return { allowed: [], reasons, approveBlockedReasons: ["quality_report_stale"] };
  }
  if (!qcResult) {
    reasons.push("qc_result_absent");
    return { allowed: [], reasons, approveBlockedReasons: ["qc_result_absent"] };
  }

  const reviewable =
    state.outcome === "needs_review" ||
    state.outcome === "retry_recommended" ||
    (state.outcome === "qc_passed" && state.humanValidationRequired);

  if (!reviewable) {
    reasons.push("outcome_not_reviewable");
    return { allowed: [], reasons, approveBlockedReasons: ["outcome_not_reviewable"] };
  }

  const allowed = new Set<MotionHumanReviewDecision>();

  // REJECT always available when reviewable
  allowed.add("rejected");

  if (nonRetryableCritical(qcResult) && qcResult.overallStatus === "reject") {
    reasons.push("qc_reject_reject_only");
    approveBlocked.push("qc_overall_reject");
    return {
      allowed: ["rejected"],
      reasons,
      approveBlockedReasons: approveBlocked,
    };
  }

  if (requiresNewReference(qcResult)) {
    allowed.add("request_new_reference");
    reasons.push("requires_new_reference");
  }

  if (hasRetryableIssues(qcResult) || qcResult.overallStatus === "retry") {
    allowed.add("retry_same_reference");
    allowed.add("retry_updated_constraints");
    reasons.push("retryable_issues");
  }

  // APPROVE gates
  if (qcResult.overallStatus === "reject") {
    approveBlocked.push("qc_overall_reject");
  }
  if (hasRequiredBlockingIssues(qcResult) && qcResult.overallStatus !== "pass" && qcResult.overallStatus !== "human_review") {
    // required fails block approve unless overall is human_review with only human_only gates
    if (qcResult.issues.some((i) => i.requirementClass === "required" && i.code.includes(".fail"))) {
      approveBlocked.push("required_issue_unresolved");
    }
    if (qcResult.issues.some((i) => i.requirementClass === "required" && i.code.includes(".unavailable"))) {
      approveBlocked.push("required_evidence_unavailable");
    }
  }
  if (
    qcResult.overallStatus === "retry" &&
    qcResult.issues.some((i) => i.requirementClass === "required" && i.severity === "blocking")
  ) {
    approveBlocked.push("required_issue_unresolved");
  }

  // human_review / pass+human / auto pass awaiting attestation → approve ok if no hard blocks
  if (
    approveBlocked.length === 0 &&
    (qcResult.overallStatus === "human_review" ||
      qcResult.overallStatus === "pass" ||
      (state.outcome === "qc_passed" && state.humanValidationRequired))
  ) {
    // still block if required fail present
    if (
      !qcResult.issues.some(
        (i) =>
          i.severity === "blocking" &&
          i.requirementClass === "required" &&
          (i.code.includes(".fail") || i.retryClass === "nonRetryable"),
      )
    ) {
      allowed.add("approved");
      reasons.push("approve_eligible");
    } else {
      approveBlocked.push("required_issue_unresolved");
    }
  }

  if (approveBlocked.length > 0) {
    reasons.push(...approveBlocked.map((r) => `approve_blocked:${r}`));
  }

  return {
    allowed: Object.freeze([...allowed]),
    reasons: Object.freeze(reasons),
    approveBlockedReasons: Object.freeze(approveBlocked),
  };
}

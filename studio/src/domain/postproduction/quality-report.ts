/**
 * Extended final quality report — technical / contractual / editorial (VHS-111).
 * No invented visual/identity/perceptual scores.
 */

export const FINAL_QUALITY_VALIDATOR_VERSION = "final-quality.v1" as const;

export type QualityCheck = {
  code: string;
  passed: boolean;
  /** unknown = not measurable without real media analysis */
  outcome: "pass" | "fail" | "unknown" | "needs_review";
  detail?: string;
  layer: "technical" | "contractual" | "editorial";
};

export type QualityIssue = {
  code: string;
  message: string;
  blocking: boolean;
  layer: "technical" | "contractual" | "editorial";
  sceneId?: string;
};

export type QualityWarning = {
  code: string;
  message: string;
  sceneId?: string;
};

export type FinalQualityReport = {
  status: "accepted" | "rejected" | "needs_review";
  technicalChecks: QualityCheck[];
  contractualChecks: QualityCheck[];
  editorialChecks: QualityCheck[];
  blockingIssues: QualityIssue[];
  warnings: QualityWarning[];
  reviewedAt: string;
  validatorVersion: string;
};

export function finalizeQualityReport(report: FinalQualityReport): FinalQualityReport {
  return Object.freeze(JSON.parse(JSON.stringify(report)) as FinalQualityReport);
}

/**
 * Derive report status:
 * - any blocking fail → rejected
 * - any needs_review / unknown (non-pass) without blocking → needs_review
 * - else accepted
 * unknown is NEVER treated as pass.
 */
export function deriveQualityStatus(
  checks: readonly QualityCheck[],
  blockingIssues: readonly QualityIssue[]
): FinalQualityReport["status"] {
  if (blockingIssues.some((i) => i.blocking)) return "rejected";
  if (checks.some((c) => c.outcome === "fail" && c.layer === "technical")) {
    return "rejected";
  }
  if (
    checks.some((c) => c.outcome === "needs_review" || c.outcome === "unknown") ||
    blockingIssues.some((i) => !i.blocking && i.code.includes("review"))
  ) {
    return "needs_review";
  }
  if (checks.some((c) => c.outcome === "fail")) return "rejected";
  return "accepted";
}

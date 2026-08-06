/**
 * Domain error taxonomy for Creative Director (VHS-102).
 * Public messages never include full briefs, plans, or secrets.
 */

export type CreativeErrorCode =
  | "invalid_concept"
  | "invalid_candidate"
  | "invariant_violation"
  | "missing_information"
  | "incoherent_with_marketing"
  | "responsibility_leak"
  | "unsourced_claim"
  | "forbidden_reference"
  | "technical_leak";

/** Redacted diagnostics only — never full candidate text. */
export type CreativeIssueDiagnostics = {
  matchedRule?: string;
  category?: string;
  matchHash?: string;
  matchLen?: number;
  sourceType?: "candidate_field" | "brief" | "marketing_plan";
  /** Numeric-only arc shape (8H-A) — never beat prose. */
  arcLength?: number;
  /** Beat `order` values only (post-normalization when available). */
  orders?: number[];
  /** 8I-A — array capacity / Zod too_big (numeric only). */
  schemaName?: string;
  zodCode?: string;
  arrayName?: string;
  arrayLength?: number;
  arrayMax?: number;
  lengthBeforeEnrichment?: number;
  lengthAfterEnrichment?: number;
  finalizeStep?:
    | "candidate"
    | "normalization"
    | "enrichment"
    | "artifact_final";
};

export class CreativeDomainError extends Error {
  readonly code: CreativeErrorCode;
  readonly publicMessage: string;
  readonly field?: string;
  readonly diagnostics?: CreativeIssueDiagnostics;

  constructor(
    code: CreativeErrorCode,
    publicMessage: string,
    field?: string,
    diagnostics?: CreativeIssueDiagnostics,
  ) {
    super(publicMessage);
    this.name = "CreativeDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
    this.diagnostics = diagnostics;
  }
}

export function isCreativeDomainError(e: unknown): e is CreativeDomainError {
  return e instanceof CreativeDomainError;
}

export type CreativeValidationIssue = {
  code: CreativeErrorCode | string;
  field?: string;
  message: string;
  diagnostics?: CreativeIssueDiagnostics;
};

export type CreativeWarning = {
  code: string;
  message: string;
  field?: string;
};

export type MissingInformation = {
  code: string;
  field?: string;
  message: string;
  required: boolean;
};

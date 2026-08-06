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

export class CreativeDomainError extends Error {
  readonly code: CreativeErrorCode;
  readonly publicMessage: string;
  readonly field?: string;

  constructor(code: CreativeErrorCode, publicMessage: string, field?: string) {
    super(publicMessage);
    this.name = "CreativeDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
  }
}

export function isCreativeDomainError(e: unknown): e is CreativeDomainError {
  return e instanceof CreativeDomainError;
}

/** Redacted diagnostics only — never full candidate text. */
export type CreativeIssueDiagnostics = {
  matchedRule?: string;
  category?: string;
  matchHash?: string;
  matchLen?: number;
  sourceType?: "candidate_field" | "brief" | "marketing_plan";
};

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

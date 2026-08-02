/**
 * Domain error taxonomy for Marketing Director artifacts (VHS-101).
 * Public messages never include secrets, full briefs, or PII.
 */

export type MarketingErrorCode =
  | "invalid_plan"
  | "invalid_candidate"
  | "invariant_violation"
  | "missing_information"
  | "incoherent_with_brief"
  | "unsourced_claim"
  | "sensitive_targeting"
  | "technical_leak";

export class MarketingDomainError extends Error {
  readonly code: MarketingErrorCode;
  readonly publicMessage: string;
  readonly field?: string;

  constructor(code: MarketingErrorCode, publicMessage: string, field?: string) {
    super(publicMessage);
    this.name = "MarketingDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
  }
}

export function isMarketingDomainError(e: unknown): e is MarketingDomainError {
  return e instanceof MarketingDomainError;
}

export type MarketingValidationIssue = {
  code: MarketingErrorCode | string;
  field?: string;
  message: string;
};

export type MarketingWarning = {
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

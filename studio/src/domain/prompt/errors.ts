/**
 * Domain error taxonomy for Prompt Director (VHS-106).
 */

export type PromptErrorCode =
  | "invalid_package"
  | "invalid_candidate"
  | "invariant_violation"
  | "missing_information"
  | "incoherent_with_sources"
  | "coverage_violation"
  | "constraint_contradiction"
  | "reference_unavailable"
  | "fidelity_violation"
  | "injection_blocked"
  | "responsibility_leak"
  | "technical_leak"
  | "render_failed";

export class PromptDomainError extends Error {
  readonly code: PromptErrorCode;
  readonly publicMessage: string;
  readonly field?: string;

  constructor(code: PromptErrorCode, publicMessage: string, field?: string) {
    super(publicMessage);
    this.name = "PromptDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
  }
}

export function isPromptDomainError(e: unknown): e is PromptDomainError {
  return e instanceof PromptDomainError;
}

export type PromptValidationIssue = {
  code: PromptErrorCode | string;
  field?: string;
  message: string;
};

export type PromptWarning = {
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

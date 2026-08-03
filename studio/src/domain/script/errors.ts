/**
 * Domain error taxonomy for Script Writer (VHS-103).
 */

export type ScriptErrorCode =
  | "invalid_script"
  | "invalid_candidate"
  | "invariant_violation"
  | "missing_information"
  | "incoherent_with_sources"
  | "responsibility_leak"
  | "duration_out_of_range"
  | "unsourced_claim"
  | "technical_leak";

export class ScriptDomainError extends Error {
  readonly code: ScriptErrorCode;
  readonly publicMessage: string;
  readonly field?: string;

  constructor(code: ScriptErrorCode, publicMessage: string, field?: string) {
    super(publicMessage);
    this.name = "ScriptDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
  }
}

export function isScriptDomainError(e: unknown): e is ScriptDomainError {
  return e instanceof ScriptDomainError;
}

export type ScriptValidationIssue = {
  code: ScriptErrorCode | string;
  field?: string;
  message: string;
};

export type ScriptWarning = {
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

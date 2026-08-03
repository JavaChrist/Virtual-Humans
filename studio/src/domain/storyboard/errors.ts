/**
 * Domain error taxonomy for Storyboard Director (VHS-105).
 */

export type StoryboardErrorCode =
  | "invalid_storyboard"
  | "invalid_candidate"
  | "invariant_violation"
  | "missing_information"
  | "incoherent_with_sources"
  | "coverage_violation"
  | "continuity_violation"
  | "timing_invalid"
  | "reference_unavailable"
  | "responsibility_leak"
  | "technical_leak"
  | "spoken_reconstruction_failed";

export class StoryboardDomainError extends Error {
  readonly code: StoryboardErrorCode;
  readonly publicMessage: string;
  readonly field?: string;

  constructor(code: StoryboardErrorCode, publicMessage: string, field?: string) {
    super(publicMessage);
    this.name = "StoryboardDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
  }
}

export function isStoryboardDomainError(e: unknown): e is StoryboardDomainError {
  return e instanceof StoryboardDomainError;
}

export type StoryboardValidationIssue = {
  code: StoryboardErrorCode | string;
  field?: string;
  message: string;
};

export type StoryboardWarning = {
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

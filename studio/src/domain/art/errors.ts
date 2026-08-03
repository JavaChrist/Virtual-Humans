/**
 * Domain error taxonomy for Art Director (VHS-104).
 */

export type ArtErrorCode =
  | "invalid_direction"
  | "invalid_candidate"
  | "invariant_violation"
  | "missing_information"
  | "incoherent_with_sources"
  | "continuity_violation"
  | "asset_unavailable"
  | "responsibility_leak"
  | "accessibility_violation"
  | "technical_leak";

export class ArtDomainError extends Error {
  readonly code: ArtErrorCode;
  readonly publicMessage: string;
  readonly field?: string;

  constructor(code: ArtErrorCode, publicMessage: string, field?: string) {
    super(publicMessage);
    this.name = "ArtDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
  }
}

export function isArtDomainError(e: unknown): e is ArtDomainError {
  return e instanceof ArtDomainError;
}

export type ArtValidationIssue = {
  code: ArtErrorCode | string;
  field?: string;
  message: string;
};

export type ArtWarning = {
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

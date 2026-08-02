export type BriefErrorCode =
  | "invalid_brief"
  | "missing_field"
  | "invalid_language"
  | "invalid_length"
  | "invalid_combination";

export class BriefDomainError extends Error {
  readonly code: BriefErrorCode;
  readonly publicMessage: string;
  readonly field?: string;

  constructor(code: BriefErrorCode, publicMessage: string, field?: string) {
    super(publicMessage);
    this.name = "BriefDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.field = field;
  }
}

export function isBriefDomainError(e: unknown): e is BriefDomainError {
  return e instanceof BriefDomainError;
}

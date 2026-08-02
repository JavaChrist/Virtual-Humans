/**
 * Domain error taxonomy for cost / budget / dry-run (VHS-006).
 * Public messages never include secrets, prompts, or PII.
 */

export type CostErrorCode =
  | "invalid_money"
  | "currency_mismatch"
  | "integer_overflow"
  | "incoherent_budget"
  | "insufficient_budget"
  | "estimation_impossible"
  | "invalid_unit"
  | "invalid_estimate"
  | "invalid_dry_run";

export class CostDomainError extends Error {
  readonly code: CostErrorCode;
  /** Safe for API / UI. */
  readonly publicMessage: string;

  constructor(code: CostErrorCode, publicMessage: string, diagnostic?: string) {
    super(diagnostic ?? publicMessage);
    this.name = "CostDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isCostDomainError(e: unknown): e is CostDomainError {
  return e instanceof CostDomainError;
}

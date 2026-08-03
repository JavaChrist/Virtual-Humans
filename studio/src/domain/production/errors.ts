/**
 * Production Director error taxonomy (VHS-110).
 */

export type ProductionErrorCode =
  | "invalid_input"
  | "not_approved"
  | "invalid_policy"
  | "invalid_transition"
  | "optimistic_conflict"
  | "budget_reservation_failed"
  | "idempotency_conflict"
  | "engine_failed"
  | "fallback_exhausted"
  | "fallback_not_allowed"
  | "quality_rejected"
  | "needs_review"
  | "cancelled"
  | "run_not_found"
  | "concurrent_run"
  | "store_required"
  | "unknown";

export class ProductionDomainError extends Error {
  readonly code: ProductionErrorCode;
  readonly publicMessage: string;

  constructor(code: ProductionErrorCode, publicMessage: string, diagnostic?: string) {
    super(diagnostic ?? publicMessage);
    this.name = "ProductionDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isProductionDomainError(e: unknown): e is ProductionDomainError {
  return e instanceof ProductionDomainError;
}

export type ProductionIssue = {
  code: ProductionErrorCode | string;
  message: string;
  path?: string;
};

export type ProductionWarning = {
  code: string;
  message: string;
  sceneId?: string;
  stepId?: string;
};

/**
 * Model Router error taxonomy (VHS-108).
 * No secrets, prompts, or signed URLs in public messages.
 */

export type RoutingErrorCode =
  | "invalid_input"
  | "invalid_policy"
  | "invalid_strategy"
  | "invalid_plan"
  | "no_eligible_strategy"
  | "budget_exceeded"
  | "combination_limit"
  | "candidate_limit"
  | "estimation_failed"
  | "unknown_dimension_required"
  | "cycle_detected"
  | "incoherent_cost"
  | "non_serializable"
  /** Motion-transfer routing (MT-003) — no eligible verified model. */
  | "motion_capability_unavailable";

export class RoutingDomainError extends Error {
  readonly code: RoutingErrorCode;
  readonly publicMessage: string;

  constructor(code: RoutingErrorCode, publicMessage: string, diagnostic?: string) {
    super(diagnostic ?? publicMessage);
    this.name = "RoutingDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isRoutingDomainError(e: unknown): e is RoutingDomainError {
  return e instanceof RoutingDomainError;
}

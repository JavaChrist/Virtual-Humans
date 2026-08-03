/**
 * Capability registry error taxonomy (VHS-107).
 * Independent of HTTP; never embeds secrets or signed URLs.
 */

export type CapabilityErrorCode =
  | "unknown_provider"
  | "unknown_model"
  | "duplicate_provider"
  | "duplicate_model"
  | "orphan_model"
  | "invalid_capability"
  | "invalid_pricing"
  | "currency_mismatch"
  | "snapshot_expired"
  | "unsupported_requirement"
  | "critical_unknown"
  | "incompatible_region"
  | "non_serializable"
  | "invalid_snapshot"
  | "invalid_identifier"
  | "invalid_score"
  | "invalid_evidence"
  | "conversion_error";

export class CapabilityDomainError extends Error {
  readonly code: CapabilityErrorCode;
  readonly publicMessage: string;

  constructor(code: CapabilityErrorCode, publicMessage: string, diagnostic?: string) {
    super(diagnostic ?? publicMessage);
    this.name = "CapabilityDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isCapabilityDomainError(e: unknown): e is CapabilityDomainError {
  return e instanceof CapabilityDomainError;
}

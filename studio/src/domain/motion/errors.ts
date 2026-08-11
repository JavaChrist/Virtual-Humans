/**
 * Motion Transfer domain error taxonomy (MT-001).
 * Public messages never include secrets, signed URLs, prompts, or media bytes.
 */

/** Validation / invariant errors (this ticket). */
export const MotionTransferValidationErrorCodeValues = [
  "invalid_motion_transfer_input",
  "source_video_required",
  "identity_reference_required",
  "outfit_reference_required",
  "unsupported_motion_fidelity",
  "invalid_motion_reference_spec",
  "invalid_motion_checkpoint",
  "human_validation_required",
  "unknown_schema_version",
  "contradictory_constraints",
  "invalid_duration",
  "invalid_aspect_ratio",
  "invalid_fps",
  "duplicate_id",
  "data_url_forbidden",
  "signed_url_leak_blocked",
] as const;
export type MotionTransferValidationErrorCode =
  (typeof MotionTransferValidationErrorCodeValues)[number];

/** Routing errors (MT-003). */
export const MotionTransferRoutingErrorCodeValues = [
  "motion_capability_unavailable",
  "no_eligible_motion_strategy",
  "budget_exceeded",
  "budget_limit_exceeded",
  "pricing_unconfigured",
  "estimate_unavailable",
  "provider_not_allowlisted",
  "model_not_allowlisted",
  "invalid_routing_request",
  "fallback_forbidden",
  "fidelity_relaxation_forbidden",
] as const;
export type MotionTransferRoutingErrorCode =
  (typeof MotionTransferRoutingErrorCodeValues)[number];

/** Provider errors — MT-006 port / MT-007 adapters. */
export const MotionTransferProviderErrorCodeValues = [
  "provider_not_configured",
  "provider_auth_failed",
  "provider_invalid_request",
  "provider_rate_limited",
  "provider_quota_exceeded",
  "provider_timeout",
  "provider_unavailable",
  "provider_job_not_found",
  "provider_status_unknown",
  "provider_output_invalid",
  "provider_cancel_unsupported",
  "provider_cancel_failed",
  "provider_failed",
  "provider_rejected",
  /** @deprecated prefer provider_timeout — kept for MT-001 compat */
  "timeout",
  "cancelled",
  "late_result_ignored",
  "adapter_not_found",
  "model_not_supported",
] as const;
export type MotionTransferProviderErrorCode =
  (typeof MotionTransferProviderErrorCodeValues)[number];

/** Codes that upper layers may treat as human-retry candidates (never auto-retried by the port). */
export const MOTION_TRANSFER_PROVIDER_HUMAN_RETRYABLE: ReadonlySet<MotionTransferProviderErrorCode> =
  new Set([
    "provider_rate_limited",
    "provider_timeout",
    "timeout",
    "provider_unavailable",
  ]);

/** QC errors — reserved for MT-009. */
export const MotionTransferQcErrorCodeValues = [
  "qc_rejected",
  "qc_human_review_required",
] as const;
export type MotionTransferQcErrorCode =
  (typeof MotionTransferQcErrorCodeValues)[number];

export type MotionTransferErrorCode =
  | MotionTransferValidationErrorCode
  | MotionTransferRoutingErrorCode
  | MotionTransferProviderErrorCode
  | MotionTransferQcErrorCode;

export type MotionTransferErrorLayer =
  | "validation"
  | "routing"
  | "provider"
  | "qc";

export function layerForMotionTransferErrorCode(
  code: MotionTransferErrorCode,
): MotionTransferErrorLayer {
  if (
    (MotionTransferValidationErrorCodeValues as readonly string[]).includes(code)
  ) {
    return "validation";
  }
  if ((MotionTransferRoutingErrorCodeValues as readonly string[]).includes(code)) {
    return "routing";
  }
  if ((MotionTransferProviderErrorCodeValues as readonly string[]).includes(code)) {
    return "provider";
  }
  return "qc";
}

export class MotionTransferDomainError extends Error {
  readonly code: MotionTransferErrorCode;
  readonly publicMessage: string;
  readonly field?: string;
  readonly layer: MotionTransferErrorLayer;

  constructor(
    code: MotionTransferErrorCode,
    publicMessage: string,
    options: { field?: string; diagnostic?: string } = {},
  ) {
    super(options.diagnostic ?? publicMessage);
    this.name = "MotionTransferDomainError";
    this.code = code;
    this.publicMessage = sanitizePublicMessage(publicMessage);
    this.field = options.field;
    this.layer = layerForMotionTransferErrorCode(code);
  }
}

export function isMotionTransferDomainError(
  e: unknown,
): e is MotionTransferDomainError {
  return e instanceof MotionTransferDomainError;
}

/** Strip likely signed URLs / data URLs / long tokens from public messages. */
export function sanitizePublicMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/data:[^;\s]+;base64,\S+/gi, "[redacted-data]")
    .slice(0, 500);
}

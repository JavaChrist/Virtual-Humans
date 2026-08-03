/**
 * Postproduction error taxonomy (VHS-111).
 */

export type PostProductionErrorCode =
  | "invalid_input"
  | "invalid_plan"
  | "missing_asset"
  | "expired_asset"
  | "unsupported_transition"
  | "unsupported_audio_mix"
  | "unsupported_overlay"
  | "codec_incompatible"
  | "duration_mismatch"
  | "merge_failed"
  | "merge_adapter_not_configured"
  | "merge_execution_unavailable"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "cancelled"
  | "output_invalid"
  | "quality_rejected"
  | "needs_review"
  | "export_not_ready"
  | "destination_unsupported"
  | "destination_not_configured"
  | "human_review_invalid"
  | "unknown";

export class PostProductionDomainError extends Error {
  readonly code: PostProductionErrorCode;
  readonly publicMessage: string;

  constructor(code: PostProductionErrorCode, publicMessage: string, diagnostic?: string) {
    super(diagnostic ?? publicMessage);
    this.name = "PostProductionDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isPostProductionDomainError(e: unknown): e is PostProductionDomainError {
  return e instanceof PostProductionDomainError;
}

export type PostProductionValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type PostProductionWarning = {
  code: string;
  message: string;
  sceneId?: string;
};

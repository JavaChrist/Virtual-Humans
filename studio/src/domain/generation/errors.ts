/**
 * Generation Engine error taxonomy (VHS-109).
 * Public messages never include secrets, prompts, or signed URLs.
 */

export const GenerationErrorCodeValues = [
  "invalid_input",
  "adapter_not_found",
  "model_not_supported",
  "unauthorized",
  "quota_exceeded",
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "content_rejected",
  "output_invalid",
  "polling_unsupported",
  "cancellation_unsupported",
  "webhook_invalid",
  "asset_unavailable",
  "idempotency_conflict",
  "cancelled",
  "unknown",
] as const;
export type GenerationErrorCode = (typeof GenerationErrorCodeValues)[number];

export type GenerationError = {
  code: GenerationErrorCode;
  retryable: boolean;
  publicMessage: string;
  internalCode?: string;
  providerId?: string;
  modelId?: string;
};

export class GenerationDomainError extends Error {
  readonly code: GenerationErrorCode;
  readonly publicMessage: string;
  readonly retryable: boolean;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly internalCode?: string;

  constructor(
    code: GenerationErrorCode,
    publicMessage: string,
    options: {
      retryable?: boolean;
      diagnostic?: string;
      providerId?: string;
      modelId?: string;
      internalCode?: string;
    } = {},
  ) {
    super(options.diagnostic ?? publicMessage);
    this.name = "GenerationDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryable = options.retryable ?? defaultRetryable(code);
    this.providerId = options.providerId;
    this.modelId = options.modelId;
    this.internalCode = options.internalCode;
  }

  toGenerationError(): GenerationError {
    return {
      code: this.code,
      retryable: this.retryable,
      publicMessage: this.publicMessage,
      internalCode: this.internalCode,
      providerId: this.providerId,
      modelId: this.modelId,
    };
  }
}

export function defaultRetryable(code: GenerationErrorCode): boolean {
  switch (code) {
    case "rate_limited":
    case "provider_unavailable":
    case "timeout":
      return true;
    default:
      return false;
  }
}

export function isGenerationDomainError(e: unknown): e is GenerationDomainError {
  return e instanceof GenerationDomainError;
}

/**
 * AICCOS error helpers — public-safe (VHS-111C).
 */

import type { AiccosErrorCode, AiccosExportError } from "./contracts";

export class AiccosPipelineError extends Error {
  readonly code: AiccosErrorCode;
  readonly retryable: boolean;
  readonly publicMessage: string;
  readonly httpStatusHint?: number;
  readonly historical?: AiccosExportError["historical"];
  readonly internalCode?: string;

  constructor(
    code: AiccosErrorCode,
    publicMessage: string,
    opts?: {
      retryable?: boolean;
      httpStatusHint?: number;
      historical?: AiccosExportError["historical"];
      internalCode?: string;
      diagnostic?: string;
    }
  ) {
    super(opts?.diagnostic ?? publicMessage);
    this.name = "AiccosPipelineError";
    this.code = code;
    this.retryable = opts?.retryable ?? false;
    this.publicMessage = publicMessage;
    this.httpStatusHint = opts?.httpStatusHint;
    this.historical = opts?.historical;
    this.internalCode = opts?.internalCode;
  }
}

export function isAiccosPipelineError(e: unknown): e is AiccosPipelineError {
  return e instanceof AiccosPipelineError;
}

export function toAiccosExportError(e: unknown): AiccosExportError {
  if (isAiccosPipelineError(e)) {
    return {
      code: e.code,
      retryable: e.retryable,
      publicMessage: e.publicMessage,
      httpStatusHint: e.httpStatusHint,
      historical: e.historical,
      internalCode: e.internalCode,
    };
  }
  if (e instanceof Error && /abort|timeout|timed out/i.test(e.message)) {
    return {
      code: "timeout",
      retryable: true,
      publicMessage: "Délai d'attente AICCOS dépassé.",
      httpStatusHint: 502,
    };
  }
  return {
    code: "unknown",
    retryable: false,
    publicMessage: "Échec de l'export AICCOS.",
    httpStatusHint: 502,
  };
}

/** Map status codes from AICCOS API responses. */
export function mapAiccosHttpStatus(status: number): {
  code: AiccosErrorCode;
  retryable: boolean;
} {
  if (status === 401 || status === 403) {
    return { code: "aiccos_unauthorized", retryable: false };
  }
  if (status === 429) {
    return { code: "aiccos_rate_limited", retryable: true };
  }
  if (status >= 500) {
    return { code: "aiccos_unavailable", retryable: true };
  }
  return { code: "import_creation_failed", retryable: false };
}

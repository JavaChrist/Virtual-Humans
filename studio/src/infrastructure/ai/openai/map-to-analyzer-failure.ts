/**
 * OpenAIAiError → MarketingAnalysisFailure (VHS-117D / shared for Creative VHS-118A).
 * Domain-independent transport taxonomy; never invents retryable from message text.
 */

import {
  MarketingAnalyzerError,
  marketingFailure,
  sanitizeInternalCode,
  type MarketingAnalysisFailure,
} from "@/application/directors/marketing/failures";
import { isOpenAIAiError, type OpenAIAiError } from "./errors";

/** Map OpenAI codes to application codes (canonical table VHS-117D). */
export function mapOpenAIAiErrorToMarketingFailure(
  err: OpenAIAiError
): MarketingAnalysisFailure {
  const internalCode = sanitizeInternalCode(err.internalCode);
  const base = {
    provider: "openai" as const,
    httpStatus: err.httpStatus,
    retryAfterSeconds: err.retryAfterSeconds,
    internalCode,
  };

  switch (err.code) {
    case "rate_limited":
      return marketingFailure("rate_limited", {
        ...base,
        retryable: true,
      });
    case "timeout":
      return marketingFailure("timeout", { ...base, retryable: true });
    case "provider_unavailable":
      return marketingFailure("provider_unavailable", {
        ...base,
        retryable: true,
      });
    case "unauthorized":
      return marketingFailure("unauthorized", { ...base, retryable: false });
    case "forbidden":
      return marketingFailure("forbidden", { ...base, retryable: false });
    case "refused":
    case "content_filtered":
      return marketingFailure("refused", { ...base, retryable: false });
    case "incomplete":
      return marketingFailure("incomplete", {
        ...base,
        retryable: err.retryable,
      });
    case "empty_output":
      return marketingFailure("empty_response", {
        ...base,
        retryable: err.retryable,
      });
    case "invalid_structured_output":
      return marketingFailure("invalid_structured_output", {
        ...base,
        retryable: false,
      });
    case "quota_exceeded":
      return marketingFailure("quota_exceeded", {
        ...base,
        retryable: false,
      });
    case "structured_output_unsupported":
    case "unsupported_model":
    case "invalid_request":
    case "cancelled":
    case "openai_not_configured":
    case "marketing_ai_disabled":
    case "creative_ai_disabled":
    case "script_ai_disabled":
    case "art_ai_disabled":
    case "storyboard_ai_disabled":
    case "paid_ai_disabled":
    case "pricing_unknown":
    case "prompt_injection_detected":
      return marketingFailure("request_failed", {
        ...base,
        retryable: false,
        internalCode: sanitizeInternalCode(err.code) ?? internalCode,
      });
    case "unknown":
    default:
      return marketingFailure("internal_error", {
        ...base,
        retryable: false,
        internalCode: internalCode ?? "openai_unknown",
      });
  }
}

/** Alias — same taxonomy for Creative / Marketing adapters. */
export const mapOpenAIAiErrorToAnalyzerFailure = mapOpenAIAiErrorToMarketingFailure;

export function toMarketingAnalyzerError(
  e: unknown,
  opts?: { metering?: import("@/application/directors/shared/analyzer-metering").AnalyzerMetering }
): MarketingAnalyzerError {
  if (e instanceof MarketingAnalyzerError) {
    if (opts?.metering && !e.metering) {
      return new MarketingAnalyzerError(e.failure, { metering: opts.metering });
    }
    return e;
  }
  if (isOpenAIAiError(e)) {
    return new MarketingAnalyzerError(mapOpenAIAiErrorToMarketingFailure(e), opts);
  }
  return new MarketingAnalyzerError(
    marketingFailure("internal_error", {
      retryable: false,
      internalCode: "adapter_unexpected",
    }),
    opts
  );
}

/** Alias for Creative adapters (same class / contract). */
export const toAnalyzerError = toMarketingAnalyzerError;

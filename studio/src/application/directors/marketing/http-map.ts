/**
 * Pure HTTP mapping for Marketing analysis failures (VHS-117D).
 * No network, no Error serialization, no secrets.
 */

import {
  httpStatusForMarketingFailure,
  MARKETING_RETRY_AFTER_MAX_SECONDS,
  type MarketingAnalysisFailure,
  type MarketingFailureHttpStatus,
} from "./failures";

export type MarketingFailureHttpBody = {
  status: "failed";
  error: {
    code: string;
    retryable: boolean;
    message: string;
  };
};

export type MarketingFailureHttpResponse = {
  status: MarketingFailureHttpStatus;
  body: MarketingFailureHttpBody;
  headers: Record<string, string>;
};

/**
 * Map a serializable failure to HTTP status, JSON body, and safe headers.
 * Retry-After is emitted only for rate_limited when seconds are validated & bounded.
 */
export function mapMarketingFailureToHttp(
  failure: MarketingAnalysisFailure
): MarketingFailureHttpResponse {
  const status = httpStatusForMarketingFailure(failure.code);
  const headers: Record<string, string> = {};

  if (
    failure.code === "rate_limited" &&
    failure.retryAfterSeconds != null &&
    Number.isInteger(failure.retryAfterSeconds) &&
    failure.retryAfterSeconds > 0 &&
    failure.retryAfterSeconds <= MARKETING_RETRY_AFTER_MAX_SECONDS
  ) {
    headers["Retry-After"] = String(failure.retryAfterSeconds);
  }

  return {
    status,
    body: {
      status: "failed",
      error: {
        code: failure.code,
        retryable: failure.retryable,
        message: failure.publicMessage,
      },
    },
    headers,
  };
}

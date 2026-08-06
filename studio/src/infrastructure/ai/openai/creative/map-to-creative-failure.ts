/**
 * OpenAIAiError → Creative analyzer failure (8G-A).
 * Preserves taxonomy codes; Creative public copy; auto-retryable always false.
 */

import {
  MarketingAnalyzerError,
  isMarketingAnalyzerError,
  type MarketingAnalysisFailure,
} from "@/application/directors/marketing/failures";
import {
  creativeFailure,
  withCreativePublicMessage,
} from "@/application/directors/creative/failures";
import { isOpenAIAiError, type OpenAIAiError } from "../errors";
import { mapOpenAIAiErrorToMarketingFailure } from "../map-to-analyzer-failure";

export function mapOpenAIAiErrorToCreativeFailure(
  err: OpenAIAiError
): MarketingAnalysisFailure {
  const mapped = mapOpenAIAiErrorToMarketingFailure(err);
  return withCreativePublicMessage(mapped);
}

export function toCreativeAnalyzerError(
  e: unknown,
  opts?: {
    metering?: import("@/application/directors/shared/analyzer-metering").AnalyzerMetering;
  }
): MarketingAnalyzerError {
  if (isMarketingAnalyzerError(e)) {
    const failure = withCreativePublicMessage(e.failure);
    const metering = opts?.metering ?? e.metering;
    if (
      failure.code === e.failure.code &&
      failure.publicMessage === e.failure.publicMessage &&
      failure.retryable === e.failure.retryable &&
      metering === e.metering
    ) {
      return e;
    }
    return new MarketingAnalyzerError(failure, { metering });
  }
  if (isOpenAIAiError(e)) {
    return new MarketingAnalyzerError(mapOpenAIAiErrorToCreativeFailure(e), opts);
  }
  return new MarketingAnalyzerError(
    creativeFailure("internal_error", { internalCode: "adapter_unexpected" }),
    opts
  );
}

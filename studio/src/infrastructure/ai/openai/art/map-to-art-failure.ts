/**
 * OpenAIAiError → Art analyzer failure (Porte 8P).
 * Preserves taxonomy codes / retryable; Art public copy only.
 */

import {
  MarketingAnalyzerError,
  isMarketingAnalyzerError,
  type MarketingAnalysisFailure,
} from "@/application/directors/marketing/failures";
import {
  artFailure,
  withArtPublicMessage,
} from "@/application/directors/art/failures";
import { isOpenAIAiError, type OpenAIAiError } from "../errors";
import { mapOpenAIAiErrorToMarketingFailure } from "../map-to-analyzer-failure";

export function mapOpenAIAiErrorToArtFailure(
  err: OpenAIAiError
): MarketingAnalysisFailure {
  return withArtPublicMessage(mapOpenAIAiErrorToMarketingFailure(err));
}

export function toArtAnalyzerError(
  e: unknown,
  opts?: {
    metering?: import("@/application/directors/shared/analyzer-metering").AnalyzerMetering;
  }
): MarketingAnalyzerError {
  if (isMarketingAnalyzerError(e)) {
    const failure = withArtPublicMessage(e.failure);
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
    return new MarketingAnalyzerError(mapOpenAIAiErrorToArtFailure(e), opts);
  }
  return new MarketingAnalyzerError(
    artFailure("internal_error", {
      retryable: false,
      internalCode: "adapter_unexpected",
    }),
    opts
  );
}

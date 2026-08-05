/**
 * Build redacted AnalyzerMetering from Responses usage + price book quote.
 * Shared by Marketing / Creative / Script / Art / Storyboard adapters.
 */

import type { AnalyzerMetering } from "@/application/directors/shared/analyzer-metering";
import type { AIUsage } from "./contracts";
import {
  quoteAiUsageCost,
  type AiTokenPricingPort,
} from "./marketing/pricing";

export function buildAnalyzerMetering(input: {
  model: string;
  usage: AIUsage | undefined;
  pricing: AiTokenPricingPort;
}): AnalyzerMetering {
  const { usage } = input;
  const cost = quoteAiUsageCost(input.model, usage, input.pricing);
  return {
    usage: usage
      ? {
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          reasoningTokens: usage.reasoningTokens,
          totalTokens: usage.totalTokens,
        }
      : undefined,
    cost:
      cost.status === "known"
        ? {
            status: "known",
            amountMinor: cost.total.amountMinor,
            currency: "USD",
            pricingVersion: cost.pricingVersion,
          }
        : { status: "unknown", reason: cost.reason },
  };
}

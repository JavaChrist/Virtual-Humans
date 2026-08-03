/**
 * Injectable AI token pricing — no hardcoded OpenAI rates in the adapter (VHS-117A).
 */

import type { EstimateConfidence, Money } from "@/domain/cost";
import { money } from "@/domain/cost";
import type { AIUsage } from "../contracts";

export type AiTokenPriceBook = {
  modelId: string;
  pricingVersion: string;
  currency: "USD";
  /** Price per 1_000_000 input tokens, minor units. */
  inputPerMillionMinor: number;
  cachedInputPerMillionMinor?: number;
  outputPerMillionMinor: number;
  /** If omitted, reasoning tokens are treated as part of output (not double-counted). */
  reasoningBilledSeparately?: boolean;
  reasoningPerMillionMinor?: number;
  confidence: EstimateConfidence;
};

export type AiCostQuote =
  | {
      status: "known";
      total: Money;
      pricingVersion: string;
      confidence: EstimateConfidence;
      assumptions: string[];
    }
  | {
      status: "unknown";
      reason: string;
    };

export type AiTokenPricingPort = {
  getPriceBook(modelId: string): AiTokenPriceBook | null;
};

function tokensToMinor(tokens: number, perMillionMinor: number): number {
  // integer math: (tokens * perMillion) / 1_000_000
  return Math.floor((tokens * perMillionMinor) / 1_000_000);
}

export function quoteAiUsageCost(
  modelId: string,
  usage: AIUsage | undefined,
  pricing: AiTokenPricingPort
): AiCostQuote {
  const book = pricing.getPriceBook(modelId);
  if (!book) {
    return { status: "unknown", reason: "price_book_missing" };
  }
  if (!usage || (usage.inputTokens == null && usage.outputTokens == null)) {
    return { status: "unknown", reason: "usage_incomplete" };
  }

  const input = usage.inputTokens ?? 0;
  const cached = usage.cachedInputTokens ?? 0;
  const nonCachedInput = Math.max(0, input - cached);
  const output = usage.outputTokens ?? 0;
  const reasoning = usage.reasoningTokens ?? 0;

  let minor = 0;
  minor += tokensToMinor(nonCachedInput, book.inputPerMillionMinor);
  if (cached > 0) {
    const cachedRate =
      book.cachedInputPerMillionMinor ?? book.inputPerMillionMinor;
    minor += tokensToMinor(cached, cachedRate);
  }
  minor += tokensToMinor(output, book.outputPerMillionMinor);
  if (book.reasoningBilledSeparately && reasoning > 0) {
    minor += tokensToMinor(
      reasoning,
      book.reasoningPerMillionMinor ?? book.outputPerMillionMinor
    );
  }

  return {
    status: "known",
    total: money(minor, book.currency),
    pricingVersion: book.pricingVersion,
    confidence: book.confidence,
    assumptions: [
      "token_costs_from_injected_price_book",
      ...(book.reasoningBilledSeparately
        ? ["reasoning_billed_separately"]
        : ["reasoning_included_in_output_tokens_when_reported"]),
    ],
  };
}

/** Default: no prices — forces unknown until configured. */
export function createUnknownAiTokenPricing(): AiTokenPricingPort {
  return { getPriceBook: () => null };
}

/**
 * Env-backed price book (optional). Never embeds “current market” defaults.
 * Example:
 *   OPENAI_MARKETING_PRICE_VERSION=manual-2026-08
 *   OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR=200
 *   OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR=800
 */
export function createEnvAiTokenPricing(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>
): AiTokenPricingPort {
  return {
    getPriceBook(modelId) {
      const version = env.OPENAI_MARKETING_PRICE_VERSION?.trim();
      const input = Number(env.OPENAI_MARKETING_PRICE_INPUT_PER_MILLION_MINOR);
      const output = Number(env.OPENAI_MARKETING_PRICE_OUTPUT_PER_MILLION_MINOR);
      if (!version || !Number.isInteger(input) || !Number.isInteger(output)) {
        return null;
      }
      if (input < 0 || output < 0) return null;
      const cachedRaw = env.OPENAI_MARKETING_PRICE_CACHED_INPUT_PER_MILLION_MINOR;
      const cached = cachedRaw != null && cachedRaw !== "" ? Number(cachedRaw) : undefined;
      const book: AiTokenPriceBook = {
        modelId,
        pricingVersion: version,
        currency: "USD",
        inputPerMillionMinor: input,
        outputPerMillionMinor: output,
        confidence: "medium",
      };
      if (cached != null && Number.isInteger(cached) && cached >= 0) {
        book.cachedInputPerMillionMinor = cached;
      }
      return book;
    },
  };
}

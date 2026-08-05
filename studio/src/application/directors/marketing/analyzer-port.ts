/**
 * Injectable analysis port for Marketing Director (VHS-101 / VHS-130 metering).
 * No provider names in this interface.
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingAnalysisCandidate } from "@/domain/marketing";
import type { DirectorRunContext } from "./result";

export type MarketingAnalysisRequest = {
  brief: VideoProjectBrief;
  /** Opaque hints only — never prompts or provider config. */
  locale?: string;
};

/** Redacted token usage — never prompts or raw provider bodies. */
export type MarketingAnalyzerUsage = {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

/**
 * Provider metering attached after a successful HTTP analyze.
 * Never invent amounts: unknown means actual_cost stays null.
 */
export type MarketingAnalyzerMetering = {
  usage?: MarketingAnalyzerUsage;
  cost:
    | { status: "known"; amountMinor: number; currency: "USD"; pricingVersion?: string }
    | { status: "unknown"; reason?: string };
};

export type MarketingAnalyzerOutcome = {
  candidate: MarketingAnalysisCandidate;
  metering?: MarketingAnalyzerMetering;
};

/**
 * Returns an untrusted structured candidate (+ optional metering).
 * Must never return an approved MarketingPlan; Director finalizes.
 */
export interface MarketingAnalyzerPort {
  analyze(
    request: MarketingAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<MarketingAnalyzerOutcome>;
}

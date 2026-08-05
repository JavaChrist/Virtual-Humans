/**
 * Injectable analysis port for Marketing Director (VHS-101 / VHS-130 metering).
 * No provider names in this interface.
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingAnalysisCandidate } from "@/domain/marketing";
import type {
  AnalyzerMetering,
  AnalyzerOutcome,
  AnalyzerUsage,
} from "@/application/directors/shared/analyzer-metering";
import type { DirectorRunContext } from "./result";

export type MarketingAnalysisRequest = {
  brief: VideoProjectBrief;
  /** Opaque hints only — never prompts or provider config. */
  locale?: string;
};

/** @deprecated Prefer AnalyzerUsage — alias kept for Marketing call sites. */
export type MarketingAnalyzerUsage = AnalyzerUsage;

/** @deprecated Prefer AnalyzerMetering — alias kept for Marketing call sites. */
export type MarketingAnalyzerMetering = AnalyzerMetering;

export type MarketingAnalyzerOutcome = AnalyzerOutcome<MarketingAnalysisCandidate>;

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

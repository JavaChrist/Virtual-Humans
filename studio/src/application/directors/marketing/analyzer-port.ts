/**
 * Injectable analysis port for Marketing Director (VHS-101).
 * No provider names in this interface. No production implementation in this increment.
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingAnalysisCandidate } from "@/domain/marketing";
import type { DirectorRunContext } from "./result";

export type MarketingAnalysisRequest = {
  brief: VideoProjectBrief;
  /** Opaque hints only — never prompts or provider config. */
  locale?: string;
};

/**
 * Returns an untrusted structured candidate.
 * Must never return an approved MarketingPlan; Director finalizes.
 */
export interface MarketingAnalyzerPort {
  analyze(
    request: MarketingAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<MarketingAnalysisCandidate>;
}

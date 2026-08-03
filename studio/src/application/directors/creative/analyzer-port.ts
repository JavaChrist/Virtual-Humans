/**
 * Injectable analysis port for Creative Director (VHS-102).
 * No provider names. No production implementation in this increment.
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeAnalysisCandidate } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { DirectorRunContext } from "./result";

export type CreativeAnalysisRequest = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  locale?: string;
};

/**
 * Returns an untrusted structured candidate.
 * Must never return an approved CreativeConcept.
 */
export interface CreativeAnalyzerPort {
  analyze(
    request: CreativeAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<CreativeAnalysisCandidate>;
}

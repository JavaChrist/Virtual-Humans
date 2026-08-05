/**
 * Injectable analysis port for Creative Director (VHS-102 / VHS-130 metering).
 * No provider names in this interface.
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeAnalysisCandidate } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type {
  AnalyzerMetering,
  AnalyzerOutcome,
  AnalyzerUsage,
} from "@/application/directors/shared/analyzer-metering";
import type { DirectorRunContext } from "./result";

export type CreativeAnalysisRequest = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  /** Opaque hints only — never prompts or provider config. */
  locale?: string;
};

/** @deprecated Prefer AnalyzerUsage — alias kept for Creative call sites. */
export type CreativeAnalyzerUsage = AnalyzerUsage;

/** @deprecated Prefer AnalyzerMetering — alias kept for Creative call sites. */
export type CreativeAnalyzerMetering = AnalyzerMetering;

export type CreativeAnalyzerOutcome = AnalyzerOutcome<CreativeAnalysisCandidate>;

/**
 * Returns an untrusted structured candidate (+ optional metering).
 * Must never return an approved CreativeConcept; Director finalizes.
 */
export interface CreativeAnalyzerPort {
  analyze(
    request: CreativeAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<CreativeAnalyzerOutcome>;
}

import type { StoryboardAnalysisCandidate } from "@/domain/storyboard";
import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { DirectorRunContext } from "./result";

export type StoryboardAnalysisRequest = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  visualDirection: VisualDirection;
  locale?: string;
};

/**
 * Injectable analysis port. Candidate is untrusted — no authoritative timing,
 * approvals, prompts, or providers.
 */
export interface StoryboardAnalyzerPort {
  analyze(
    request: StoryboardAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<StoryboardAnalysisCandidate>;
}

import type { PromptAnalysisCandidate } from "@/domain/prompt";
import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { StoryboardProject } from "@/domain/storyboard";
import type { DirectorRunContext } from "./result";

export type PromptAnalysisRequest = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  visualDirection: VisualDirection;
  storyboard: StoryboardProject;
  locale?: string;
};

export interface PromptAnalyzerPort {
  analyze(
    request: PromptAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<PromptAnalysisCandidate>;
}

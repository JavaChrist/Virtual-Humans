import type { ArtAnalysisCandidate } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { CharacterCapabilitiesSnapshot } from "@/domain/art";
import type { DirectorRunContext } from "./result";

export type ArtAnalysisRequest = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  characterCapabilities?: CharacterCapabilitiesSnapshot;
  locale?: string;
};

/**
 * Injectable analysis port. Candidate is untrusted — no metadata, approvals,
 * Runtime paths, or prompts.
 */
export interface ArtAnalyzerPort {
  analyze(
    request: ArtAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<ArtAnalysisCandidate>;
}

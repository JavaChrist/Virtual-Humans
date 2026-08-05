import type { ArtAnalysisCandidate } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { CharacterCapabilitiesSnapshot } from "@/domain/art";
import type {
  AnalyzerMetering,
  AnalyzerOutcome,
  AnalyzerUsage,
} from "@/application/directors/shared/analyzer-metering";
import type { DirectorRunContext } from "./result";

export type ArtAnalysisRequest = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  characterCapabilities?: CharacterCapabilitiesSnapshot;
  locale?: string;
};

export type ArtAnalyzerUsage = AnalyzerUsage;
export type ArtAnalyzerMetering = AnalyzerMetering;
export type ArtAnalyzerOutcome = AnalyzerOutcome<ArtAnalysisCandidate>;

/**
 * Injectable analysis port. Candidate is untrusted — no metadata, approvals,
 * Runtime paths, or prompts.
 */
export interface ArtAnalyzerPort {
  analyze(
    request: ArtAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<ArtAnalyzerOutcome>;
}

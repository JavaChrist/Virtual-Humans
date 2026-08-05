import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { ScriptAnalysisCandidate } from "@/domain/script";
import type {
  AnalyzerMetering,
  AnalyzerOutcome,
  AnalyzerUsage,
} from "@/application/directors/shared/analyzer-metering";
import type { DirectorRunContext } from "./result";

export type ScriptAnalysisRequest = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  locale?: string;
};

export type ScriptAnalyzerUsage = AnalyzerUsage;
export type ScriptAnalyzerMetering = AnalyzerMetering;
export type ScriptAnalyzerOutcome = AnalyzerOutcome<ScriptAnalysisCandidate>;

export interface ScriptAnalyzerPort {
  analyze(
    request: ScriptAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<ScriptAnalyzerOutcome>;
}

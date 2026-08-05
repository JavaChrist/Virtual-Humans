import type {
  MissingInformation,
  StoryboardProject,
  StoryboardValidationIssue,
  StoryboardWarning,
} from "@/domain/storyboard";
import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";

export type {
  DirectorRunContext,
  DirectorRunMode,
} from "@/application/directors/marketing/result";

import type { DirectorRunContext } from "@/application/directors/marketing/result";
import type { MarketingAnalysisFailure } from "@/application/directors/marketing/failures";
import type { StoryboardAnalyzerMetering } from "./analyzer-port";

export type StoryboardDirectorInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  visualDirection: VisualDirection;
};

export type StoryboardDirectorResult =
  | {
      status: "completed";
      storyboard: StoryboardProject;
      warnings: StoryboardWarning[];
      metering?: StoryboardAnalyzerMetering;
    }
  | {
      status: "needs_input";
      missingInformation: MissingInformation[];
      warnings: StoryboardWarning[];
      metering?: StoryboardAnalyzerMetering;
    }
  | {
      status: "invalid";
      errors: StoryboardValidationIssue[];
      metering?: StoryboardAnalyzerMetering;
    }
  | {
      /** Provider/transport failures are not candidate validation failures. */
      status: "provider_failed";
      failure: MarketingAnalysisFailure;
      metering?: StoryboardAnalyzerMetering;
    };

export interface StoryboardDirector {
  run(
    input: StoryboardDirectorInput,
    context: DirectorRunContext,
  ): Promise<StoryboardDirectorResult>;
}

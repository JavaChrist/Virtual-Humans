import type {
  MissingInformation,
  PromptDirectorOutput,
  PromptValidationIssue,
  PromptWarning,
} from "@/domain/prompt";
import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { StoryboardProject } from "@/domain/storyboard";

export type {
  DirectorRunContext,
  DirectorRunMode,
} from "@/application/directors/marketing/result";

import type { DirectorRunContext } from "@/application/directors/marketing/result";

export type PromptDirectorInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  visualDirection: VisualDirection;
  storyboard: StoryboardProject;
};

export type PromptDirectorResult =
  | {
      status: "completed";
      output: PromptDirectorOutput;
      warnings: PromptWarning[];
    }
  | {
      status: "needs_input";
      missingInformation: MissingInformation[];
      warnings: PromptWarning[];
    }
  | {
      status: "invalid";
      errors: PromptValidationIssue[];
    };

export interface PromptDirector {
  run(
    input: PromptDirectorInput,
    context: DirectorRunContext,
  ): Promise<PromptDirectorResult>;
}

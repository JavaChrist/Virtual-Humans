import type {
  CreativeConcept,
  CreativeValidationIssue,
  CreativeWarning,
  MissingInformation,
} from "@/domain/creative";
import type { MarketingAnalysisFailure } from "@/application/directors/marketing/failures";

/** Reuse the canonical run context from Marketing Director to avoid incompatible shapes. */
export type {
  DirectorRunContext,
  DirectorRunMode,
} from "@/application/directors/marketing/result";

import type { DirectorRunContext } from "@/application/directors/marketing/result";
import type { VideoProjectBrief } from "@/domain/brief";
import type { MarketingPlan } from "@/domain/marketing";

export type CreativeDirectorInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
};

export type CreativeDirectorResult =
  | {
      status: "completed";
      concept: CreativeConcept;
      warnings: CreativeWarning[];
    }
  | {
      status: "needs_input";
      missingInformation: MissingInformation[];
      warnings: CreativeWarning[];
    }
  | {
      status: "invalid";
      errors: CreativeValidationIssue[];
    }
  | {
      /** Analyzer/provider failed before a domain candidate existed (VHS-118A). */
      status: "provider_failed";
      failure: MarketingAnalysisFailure;
    };

export interface CreativeDirector {
  run(
    input: CreativeDirectorInput,
    context: DirectorRunContext,
  ): Promise<CreativeDirectorResult>;
}

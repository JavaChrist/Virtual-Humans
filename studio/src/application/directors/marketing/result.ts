import type {
  MarketingPlan,
  MarketingValidationIssue,
  MarketingWarning,
  MissingInformation,
} from "@/domain/marketing";

export type DirectorRunMode = "dry-run" | "execute";

export type DirectorRunContext = {
  correlationId: string;
  mode: DirectorRunMode;
  /** Optional actor id for artifact metadata (defaults to "system"). */
  createdBy?: string;
  /** Optional plan artifact id (generated if absent). */
  planId?: string;
};

export type MarketingDirectorInput = {
  brief: import("@/domain/brief").VideoProjectBrief;
};

export type MarketingDirectorResult =
  | {
      status: "completed";
      plan: MarketingPlan;
      warnings: MarketingWarning[];
    }
  | {
      status: "needs_input";
      missingInformation: MissingInformation[];
      warnings: MarketingWarning[];
    }
  | {
      status: "invalid";
      errors: MarketingValidationIssue[];
    };

export interface MarketingDirector {
  run(
    input: MarketingDirectorInput,
    context: DirectorRunContext,
  ): Promise<MarketingDirectorResult>;
}

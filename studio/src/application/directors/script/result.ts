import type {
  ScriptValidationIssue,
  ScriptWarning,
  MissingInformation,
  VideoScript,
} from "@/domain/script";

export type {
  DirectorRunContext,
  DirectorRunMode,
} from "@/application/directors/marketing/result";

import type { DirectorRunContext } from "@/application/directors/marketing/result";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { MarketingAnalysisFailure } from "@/application/directors/marketing/failures";
import type { ScriptAnalyzerMetering } from "./analyzer-port";

export type ScriptWriterInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
};

export type ScriptWriterResult =
  | {
      status: "completed";
      script: VideoScript;
      warnings: ScriptWarning[];
      metering?: ScriptAnalyzerMetering;
    }
  | {
      status: "needs_input";
      missingInformation: MissingInformation[];
      warnings: ScriptWarning[];
      metering?: ScriptAnalyzerMetering;
    }
  | {
      status: "invalid";
      errors: ScriptValidationIssue[];
      metering?: ScriptAnalyzerMetering;
    }
  | {
      /** Provider/transport failures are not candidate validation failures. */
      status: "provider_failed";
      failure: MarketingAnalysisFailure;
      metering?: ScriptAnalyzerMetering;
    };

export interface ScriptWriter {
  run(input: ScriptWriterInput, context: DirectorRunContext): Promise<ScriptWriterResult>;
}

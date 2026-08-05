import type {
  ArtValidationIssue,
  ArtWarning,
  CharacterCapabilitiesSnapshot,
  MissingInformation,
  VisualDirection,
} from "@/domain/art";
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
import type { ArtAnalyzerMetering } from "./analyzer-port";

export type ArtDirectorInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  characterCapabilities?: CharacterCapabilitiesSnapshot;
};

export type ArtDirectorResult =
  | {
      status: "completed";
      visualDirection: VisualDirection;
      warnings: ArtWarning[];
      metering?: ArtAnalyzerMetering;
    }
  | {
      status: "needs_input";
      missingInformation: MissingInformation[];
      warnings: ArtWarning[];
      metering?: ArtAnalyzerMetering;
    }
  | {
      status: "invalid";
      errors: ArtValidationIssue[];
      metering?: ArtAnalyzerMetering;
    }
  | {
      /** Provider/transport failures are not candidate validation failures. */
      status: "provider_failed";
      failure: MarketingAnalysisFailure;
      metering?: ArtAnalyzerMetering;
    };

export interface ArtDirector {
  run(input: ArtDirectorInput, context: DirectorRunContext): Promise<ArtDirectorResult>;
}

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
    }
  | {
      status: "needs_input";
      missingInformation: MissingInformation[];
      warnings: ArtWarning[];
    }
  | {
      status: "invalid";
      errors: ArtValidationIssue[];
    }
  | {
      /** Provider/transport failures are not candidate validation failures. */
      status: "provider_failed";
      failure: MarketingAnalysisFailure;
    };

export interface ArtDirector {
  run(input: ArtDirectorInput, context: DirectorRunContext): Promise<ArtDirectorResult>;
}

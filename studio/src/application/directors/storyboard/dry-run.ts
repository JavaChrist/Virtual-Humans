import { VisualDirectionSchema, type VisualDirection } from "@/domain/art";
import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import { CreativeConceptSchema, type CreativeConcept } from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import {
  assessStoryboardReadiness,
  type MissingInformation,
  type StoryboardWarning,
} from "@/domain/storyboard";

export type StoryboardDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type StoryboardDryRunResult = {
  executable: boolean;
  providerCalled: false;
  validations: StoryboardDryRunValidation[];
  warnings: StoryboardWarning[];
  missingInformation: MissingInformation[];
};

export function runStoryboardDryRun(
  brief: VideoProjectBrief,
  marketingPlan: MarketingPlan,
  creativeConcept: CreativeConcept,
  videoScript: VideoScript,
  visualDirection: VisualDirection,
): StoryboardDryRunResult {
  const briefParsed = VideoProjectBriefSchema.safeParse(brief);
  if (!briefParsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [{ code: "brief_ok", passed: false, message: "Brief invalide." }],
      warnings: [],
      missingInformation: [
        { code: "brief_invalid", message: "Brief invalide.", required: true },
      ],
    };
  }
  const planParsed = MarketingPlanSchema.safeParse(marketingPlan);
  if (!planParsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [
        { code: "marketing_plan_ok", passed: false, message: "MarketingPlan invalide." },
      ],
      warnings: [],
      missingInformation: [
        {
          code: "marketing_plan_invalid",
          message: "Marketing Plan invalide.",
          required: true,
        },
      ],
    };
  }
  const conceptParsed = CreativeConceptSchema.safeParse(creativeConcept);
  if (!conceptParsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [
        {
          code: "creative_concept_ok",
          passed: false,
          message: "CreativeConcept invalide.",
        },
      ],
      warnings: [],
      missingInformation: [
        {
          code: "creative_concept_invalid",
          message: "Creative Concept invalide.",
          required: true,
        },
      ],
    };
  }
  const scriptParsed = VideoScriptSchema.safeParse(videoScript);
  if (!scriptParsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [
        { code: "video_script_ok", passed: false, message: "VideoScript invalide." },
      ],
      warnings: [],
      missingInformation: [
        {
          code: "video_script_invalid",
          message: "Video Script invalide.",
          required: true,
        },
      ],
    };
  }
  const visualParsed = VisualDirectionSchema.safeParse(visualDirection);
  if (!visualParsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [
        {
          code: "visual_direction_ok",
          passed: false,
          message: "VisualDirection invalide.",
        },
      ],
      warnings: [],
      missingInformation: [
        {
          code: "visual_direction_invalid",
          message: "Visual Direction invalide.",
          required: true,
        },
      ],
    };
  }

  const readiness = assessStoryboardReadiness(
    briefParsed.data,
    planParsed.data,
    conceptParsed.data,
    scriptParsed.data,
    visualParsed.data,
  );

  return {
    executable: readiness.executable,
    providerCalled: false,
    validations: readiness.checks.map((c) => ({
      code: c.code,
      passed: c.passed,
      message: c.message,
    })),
    warnings: readiness.warnings,
    missingInformation: readiness.missingInformation,
  };
}

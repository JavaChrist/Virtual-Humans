import { VisualDirectionSchema, type VisualDirection } from "@/domain/art";
import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import { CreativeConceptSchema, type CreativeConcept } from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import {
  StoryboardProjectSchema,
  type StoryboardProject,
} from "@/domain/storyboard";
import {
  assessPromptReadiness,
  type MissingInformation,
  type PromptWarning,
} from "@/domain/prompt";

export type PromptDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type PromptDryRunResult = {
  executable: boolean;
  providerCalled: false;
  validations: PromptDryRunValidation[];
  warnings: PromptWarning[];
  missingInformation: MissingInformation[];
};

export function runPromptDryRun(
  brief: VideoProjectBrief,
  marketingPlan: MarketingPlan,
  creativeConcept: CreativeConcept,
  videoScript: VideoScript,
  visualDirection: VisualDirection,
  storyboard: StoryboardProject,
): PromptDryRunResult {
  for (const [code, parsed, msg] of [
    ["brief_ok", VideoProjectBriefSchema.safeParse(brief), "Brief invalide."],
    ["marketing_plan_ok", MarketingPlanSchema.safeParse(marketingPlan), "MarketingPlan invalide."],
    [
      "creative_concept_ok",
      CreativeConceptSchema.safeParse(creativeConcept),
      "CreativeConcept invalide.",
    ],
    ["video_script_ok", VideoScriptSchema.safeParse(videoScript), "VideoScript invalide."],
    [
      "visual_direction_ok",
      VisualDirectionSchema.safeParse(visualDirection),
      "VisualDirection invalide.",
    ],
    [
      "storyboard_ok",
      StoryboardProjectSchema.safeParse(storyboard),
      "Storyboard invalide.",
    ],
  ] as const) {
    if (!parsed.success) {
      return {
        executable: false,
        providerCalled: false,
        validations: [{ code, passed: false, message: msg }],
        warnings: [],
        missingInformation: [
          { code: `${code}_failed`, message: msg, required: true },
        ],
      };
    }
  }

  const readiness = assessPromptReadiness(
    VideoProjectBriefSchema.parse(brief),
    MarketingPlanSchema.parse(marketingPlan),
    CreativeConceptSchema.parse(creativeConcept),
    VideoScriptSchema.parse(videoScript),
    VisualDirectionSchema.parse(visualDirection),
    StoryboardProjectSchema.parse(storyboard),
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

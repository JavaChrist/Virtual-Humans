import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import { CreativeConceptSchema, type CreativeConcept } from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import {
  assessScriptReadiness,
  type MissingInformation,
  type ScriptWarning,
} from "@/domain/script";

export type ScriptDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type ScriptDryRunResult = {
  executable: boolean;
  providerCalled: false;
  validations: ScriptDryRunValidation[];
  warnings: ScriptWarning[];
  missingInformation: MissingInformation[];
};

export function runScriptDryRun(
  brief: VideoProjectBrief,
  marketingPlan: MarketingPlan,
  creativeConcept: CreativeConcept,
): ScriptDryRunResult {
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

  const readiness = assessScriptReadiness(
    briefParsed.data,
    planParsed.data,
    conceptParsed.data,
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

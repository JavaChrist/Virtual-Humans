/**
 * Creative dry-run — local readiness only.
 * Never calls a provider and never invents a CreativeConcept.
 */

import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import {
  assessCreativeReadiness,
  type CreativeWarning,
  type MissingInformation,
} from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";

export type CreativeDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type CreativeDryRunResult = {
  executable: boolean;
  providerCalled: false;
  validations: CreativeDryRunValidation[];
  warnings: CreativeWarning[];
  missingInformation: MissingInformation[];
};

export function runCreativeDryRun(
  marketingPlan: MarketingPlan,
  brief: VideoProjectBrief,
): CreativeDryRunResult {
  const briefParsed = VideoProjectBriefSchema.safeParse(brief);
  if (!briefParsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [
        {
          code: "brief_schema",
          passed: false,
          message: briefParsed.error.issues[0]?.message ?? "Brief invalide.",
        },
      ],
      warnings: [],
      missingInformation: [
        {
          code: "brief_invalid",
          message: "Le brief ne passe pas la validation de schéma.",
          required: true,
        },
      ],
    };
  }

  const planParsed = MarketingPlanSchema.safeParse(marketingPlan);
  if (!planParsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [
        {
          code: "marketing_plan_schema",
          passed: false,
          message: planParsed.error.issues[0]?.message ?? "MarketingPlan invalide.",
        },
      ],
      warnings: [],
      missingInformation: [
        {
          code: "marketing_plan_invalid",
          message: "Le Marketing Plan ne passe pas la validation de schéma.",
          required: true,
        },
      ],
    };
  }

  const readiness = assessCreativeReadiness(planParsed.data, briefParsed.data);
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

/**
 * Marketing dry-run — local readiness only.
 * Never calls a provider and never invents a MarketingPlan.
 */

import { VideoProjectBriefSchema } from "@/domain/brief";
import {
  assessMarketingBriefReadiness,
  type MarketingWarning,
  type MissingInformation,
} from "@/domain/marketing";
import type { VideoProjectBrief } from "@/domain/brief";

export type MarketingDryRunValidation = {
  code: string;
  passed: boolean;
  message: string;
};

export type MarketingDryRunResult = {
  executable: boolean;
  providerCalled: false;
  validations: MarketingDryRunValidation[];
  warnings: MarketingWarning[];
  missingInformation: MissingInformation[];
};

/**
 * Validate preparation of a brief for a future marketing analysis.
 */
export function runMarketingDryRun(brief: VideoProjectBrief): MarketingDryRunResult {
  const parsed = VideoProjectBriefSchema.safeParse(brief);
  if (!parsed.success) {
    return {
      executable: false,
      providerCalled: false,
      validations: [
        {
          code: "brief_schema",
          passed: false,
          message: parsed.error.issues[0]?.message ?? "Brief invalide.",
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

  const readiness = assessMarketingBriefReadiness(parsed.data);
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

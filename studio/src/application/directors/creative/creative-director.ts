/**
 * Creative Director orchestration (VHS-102).
 * Owns validation, normalization, marketing conservation, final artifact.
 */

import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import {
  CreativeAnalysisCandidateSchema,
  finalizeCreativeConcept,
  isCreativeDomainError,
  validateCandidateAgainstMarketing,
  type CreativeValidationIssue,
} from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import {
  internalMarketingFailure,
  isMarketingAnalyzerError,
} from "@/application/directors/marketing/failures";
import type { CreativeAnalyzerPort } from "./analyzer-port";
import { runCreativeDryRun } from "./dry-run";
import type {
  CreativeDirector,
  CreativeDirectorInput,
  CreativeDirectorResult,
  DirectorRunContext,
} from "./result";

function newConceptId(): string {
  return `cre_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type CreateCreativeDirectorOptions = {
  analyzer: CreativeAnalyzerPort;
};

export function createCreativeDirector(
  options: CreateCreativeDirectorOptions,
): CreativeDirector {
  const { analyzer } = options;

  return {
    async run(
      input: CreativeDirectorInput,
      context: DirectorRunContext,
    ): Promise<CreativeDirectorResult> {
      const briefIssues: CreativeValidationIssue[] = [];
      const briefParsed = VideoProjectBriefSchema.safeParse(input.brief);
      if (!briefParsed.success) {
        return {
          status: "invalid",
          errors: briefParsed.error.issues.map((i) => ({
            code: "invalid_brief",
            field: i.path.join(".") || undefined,
            message: i.message,
          })),
        };
      }

      const planParsed = MarketingPlanSchema.safeParse(input.marketingPlan);
      if (!planParsed.success) {
        return {
          status: "invalid",
          errors: planParsed.error.issues.map((i) => ({
            code: "invalid_marketing_plan",
            field: i.path.join(".") || undefined,
            message: i.message,
          })),
        };
      }

      const brief: VideoProjectBrief = {
        ...briefParsed.data,
        mediaReferences: briefParsed.data.mediaReferences.map((m) => ({ ...m })),
      };
      const marketingPlan: MarketingPlan = JSON.parse(
        JSON.stringify(planParsed.data),
      ) as MarketingPlan;

      // Ensure caller inputs were not relied upon by mutation
      void briefIssues;

      if (context.mode === "dry-run") {
        const dry = runCreativeDryRun(marketingPlan, brief);
        const schemaFailed = dry.validations.some(
          (v) =>
            (v.code === "marketing_plan_schema" || v.code === "brief_schema") && !v.passed,
        );
        if (schemaFailed) {
          return {
            status: "invalid",
            errors: dry.missingInformation.map((m) => ({
              code: m.code,
              field: m.field,
              message: m.message,
            })),
          };
        }
        const missing = [...dry.missingInformation];
        if (dry.executable) {
          missing.push({
            code: "analysis_not_executed",
            message:
              "Dry-run uniquement : aucune analyse créative n'a été exécutée et aucun concept n'a été produit.",
            required: true,
          });
        }
        return {
          status: "needs_input",
          missingInformation: missing,
          warnings: dry.warnings,
        };
      }

      const dry = runCreativeDryRun(marketingPlan, brief);
      const requiredMissing = dry.missingInformation.filter((m) => m.required);
      if (requiredMissing.length > 0 || !dry.executable) {
        return {
          status: "needs_input",
          missingInformation: requiredMissing.length
            ? requiredMissing
            : dry.missingInformation,
          warnings: dry.warnings,
        };
      }

      let outcome;
      try {
        outcome = await analyzer.analyze(
          { brief, marketingPlan, locale: brief.language },
          context,
        );
      } catch (e) {
        // Provider / transport failure — never collapse into invalid_candidate.
        if (isMarketingAnalyzerError(e)) {
          return {
            status: "provider_failed",
            failure: e.failure,
            metering: e.metering,
          };
        }
        return {
          status: "provider_failed",
          failure: internalMarketingFailure("creative_analyzer_unexpected"),
        };
      }

      const metering = outcome.metering;
      const candidateParsed = CreativeAnalysisCandidateSchema.safeParse(
        outcome.candidate,
      );
      if (!candidateParsed.success) {
        return {
          status: "invalid",
          errors: candidateParsed.error.issues.map((i) => ({
            code: "invalid_candidate",
            field: i.path.join(".") || undefined,
            message: i.message,
          })),
          metering,
        };
      }

      const { issues, warnings } = validateCandidateAgainstMarketing(
        candidateParsed.data,
        marketingPlan,
        brief,
      );
      if (issues.length > 0) {
        const critical = issues.filter((i) =>
          [
            "invariant_violation",
            "unsourced_claim",
            "responsibility_leak",
            "forbidden_reference",
            "technical_leak",
            "incoherent_with_marketing",
            "invalid_candidate",
          ].includes(i.code),
        );
        if (critical.length > 0) {
          return { status: "invalid", errors: critical, metering };
        }
        return {
          status: "needs_input",
          missingInformation: issues.map((i) => ({
            code: i.code,
            field: i.field,
            message: i.message,
            required: true,
          })),
          warnings,
          metering,
        };
      }

      try {
        const concept = finalizeCreativeConcept({
          brief,
          marketingPlan,
          candidate: candidateParsed.data,
          metadata: {
            id: context.planId ?? newConceptId(),
            createdBy: context.createdBy ?? "system",
            correlationId: context.correlationId,
          },
        });
        return {
          status: "completed",
          concept,
          warnings: [...dry.warnings, ...warnings],
          metering,
        };
      } catch (e) {
        if (isCreativeDomainError(e)) {
          return {
            status: "invalid",
            errors: [{ code: e.code, field: e.field, message: e.publicMessage }],
            metering,
          };
        }
        return {
          status: "invalid",
          errors: [
            {
              code: "invalid_concept",
              message:
                e instanceof Error ? e.message : "Finalisation du concept impossible.",
            },
          ],
          metering,
        };
      }
    },
  };
}

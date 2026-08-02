/**
 * Marketing Director orchestration (VHS-101).
 * Owns validation, normalization, invariants, traceability, final artifact.
 * Analyzer port is untrusted and optional for dry-run mode.
 */

import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import {
  MarketingAnalysisCandidateSchema,
  finalizeMarketingPlan,
  isMarketingDomainError,
  validateCandidateAgainstBrief,
  type MarketingValidationIssue,
} from "@/domain/marketing";
import type { MarketingAnalyzerPort } from "./analyzer-port";
import { runMarketingDryRun } from "./dry-run";
import type {
  DirectorRunContext,
  MarketingDirector,
  MarketingDirectorInput,
  MarketingDirectorResult,
} from "./result";

function newPlanId(): string {
  return `mkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function briefSchemaErrors(brief: VideoProjectBrief): MarketingValidationIssue[] {
  const parsed = VideoProjectBriefSchema.safeParse(brief);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => ({
    code: "invalid_brief",
    field: i.path.join(".") || undefined,
    message: i.message,
  }));
}

export type CreateMarketingDirectorOptions = {
  analyzer: MarketingAnalyzerPort;
};

/**
 * Factory — analyzer is injected. No default production analyzer in this increment.
 */
export function createMarketingDirector(
  options: CreateMarketingDirectorOptions,
): MarketingDirector {
  const { analyzer } = options;

  return {
    async run(
      input: MarketingDirectorInput,
      context: DirectorRunContext,
    ): Promise<MarketingDirectorResult> {
      const schemaIssues = briefSchemaErrors(input.brief);
      if (schemaIssues.length > 0) {
        return { status: "invalid", errors: schemaIssues };
      }

      // Freeze-guard: work on a shallow copy so caller brief is never mutated
      const brief: VideoProjectBrief = {
        ...input.brief,
        mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
      };

      if (context.mode === "dry-run") {
        const dry = runMarketingDryRun(brief);
        const schemaFailed = dry.validations.some(
          (v) => v.code === "brief_schema" && !v.passed,
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
              "Dry-run uniquement : aucune analyse marketing n'a été exécutée et aucun plan n'a été produit.",
            required: true,
          });
        }
        return {
          status: "needs_input",
          missingInformation: missing,
          warnings: dry.warnings,
        };
      }

      // execute mode
      const dry = runMarketingDryRun(brief);
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

      let candidate;
      try {
        candidate = await analyzer.analyze(
          { brief, locale: brief.language },
          context,
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Échec de l'analyse marketing.";
        return {
          status: "invalid",
          errors: [{ code: "analyzer_failed", message }],
        };
      }

      const candidateParsed = MarketingAnalysisCandidateSchema.safeParse(candidate);
      if (!candidateParsed.success) {
        return {
          status: "invalid",
          errors: candidateParsed.error.issues.map((i) => ({
            code: "invalid_candidate" as const,
            field: i.path.join(".") || undefined,
            message: i.message,
          })),
        };
      }

      const { issues, warnings } = validateCandidateAgainstBrief(
        candidateParsed.data,
        brief,
      );
      if (issues.length > 0) {
        // Critical invariant failures → invalid; soft gaps already handled by readiness
        const critical = issues.filter((i) =>
          [
            "invariant_violation",
            "unsourced_claim",
            "sensitive_targeting",
            "technical_leak",
            "incoherent_with_brief",
            "invalid_candidate",
          ].includes(i.code),
        );
        if (critical.length > 0) {
          return { status: "invalid", errors: critical };
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
        };
      }

      try {
        const plan = finalizeMarketingPlan({
          brief,
          candidate: candidateParsed.data,
          metadata: {
            id: context.planId ?? newPlanId(),
            createdBy: context.createdBy ?? "system",
            correlationId: context.correlationId,
          },
        });
        return { status: "completed", plan, warnings: [...dry.warnings, ...warnings] };
      } catch (e) {
        if (isMarketingDomainError(e)) {
          return {
            status: "invalid",
            errors: [{ code: e.code, field: e.field, message: e.publicMessage }],
          };
        }
        return {
          status: "invalid",
          errors: [
            {
              code: "invalid_plan",
              message: e instanceof Error ? e.message : "Finalisation du plan impossible.",
            },
          ],
        };
      }
    },
  };
}

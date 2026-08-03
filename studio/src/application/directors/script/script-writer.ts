import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import {
  CreativeConceptSchema,
  type CreativeConcept,
} from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import {
  ScriptAnalysisCandidateSchema,
  finalizeVideoScript,
  isScriptDomainError,
  validateCandidateAgainstSources,
  type ScriptValidationIssue,
  type ScriptWarning,
} from "@/domain/script";
import type { ScriptAnalyzerPort } from "./analyzer-port";
import { isMarketingAnalyzerError } from "@/application/directors/marketing/failures";
import { runScriptDryRun } from "./dry-run";
import type {
  DirectorRunContext,
  ScriptWriter,
  ScriptWriterInput,
  ScriptWriterResult,
} from "./result";

function newScriptId(): string {
  return `scr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type CreateScriptWriterOptions = {
  analyzer: ScriptAnalyzerPort;
};

export function createScriptWriter(options: CreateScriptWriterOptions): ScriptWriter {
  const { analyzer } = options;

  return {
    async run(
      input: ScriptWriterInput,
      context: DirectorRunContext,
    ): Promise<ScriptWriterResult> {
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
      const conceptParsed = CreativeConceptSchema.safeParse(input.creativeConcept);
      if (!conceptParsed.success) {
        return {
          status: "invalid",
          errors: conceptParsed.error.issues.map((i) => ({
            code: "invalid_creative_concept",
            field: i.path.join(".") || undefined,
            message: i.message,
          })),
        };
      }

      const brief: VideoProjectBrief = {
        ...briefParsed.data,
        mediaReferences: briefParsed.data.mediaReferences.map((m) => ({ ...m })),
      };
      const marketingPlan = JSON.parse(JSON.stringify(planParsed.data)) as MarketingPlan;
      const creativeConcept = JSON.parse(
        JSON.stringify(conceptParsed.data),
      ) as CreativeConcept;

      if (context.mode === "dry-run") {
        const dry = runScriptDryRun(brief, marketingPlan, creativeConcept);
        const schemaFailed = dry.validations.some(
          (v) =>
            !v.passed &&
            ["brief_ok", "marketing_plan_ok", "creative_concept_ok"].includes(v.code),
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
              "Dry-run uniquement : aucune rédaction de script n'a été exécutée.",
            required: true,
          });
        }
        return {
          status: "needs_input",
          missingInformation: missing,
          warnings: dry.warnings,
        };
      }

      const dry = runScriptDryRun(brief, marketingPlan, creativeConcept);
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
          {
            brief,
            marketingPlan,
            creativeConcept,
            locale: brief.language,
          },
          context,
        );
      } catch (e) {
        if (isMarketingAnalyzerError(e)) {
          return { status: "provider_failed", failure: e.failure };
        }
        return {
          status: "invalid",
          errors: [
            {
              code: "analyzer_failed",
              message: e instanceof Error ? e.message : "Échec de l'analyse script.",
            },
          ],
        };
      }

      const candidateParsed = ScriptAnalysisCandidateSchema.safeParse(candidate);
      if (!candidateParsed.success) {
        return {
          status: "invalid",
          errors: candidateParsed.error.issues.map((i) => ({
            code: "invalid_candidate",
            field: i.path.join(".") || undefined,
            message: i.message,
          })),
        };
      }

      const { issues, warnings } = validateCandidateAgainstSources(
        candidateParsed.data,
        brief,
        marketingPlan,
        creativeConcept,
      );
      if (issues.length > 0) {
        const critical = issues.filter((i) =>
          [
            "invariant_violation",
            "unsourced_claim",
            "responsibility_leak",
            "technical_leak",
            "incoherent_with_sources",
            "duration_out_of_range",
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
        const script = finalizeVideoScript({
          brief,
          marketingPlan,
          creativeConcept,
          candidate: candidateParsed.data,
          metadata: {
            id: context.planId ?? newScriptId(),
            createdBy: context.createdBy ?? "system",
            correlationId: context.correlationId,
          },
        });

        const allWarnings: ScriptWarning[] = [...dry.warnings, ...warnings];
        if (script.timing.status === "too_short") {
          allWarnings.push({
            code: "timing_too_short",
            message: `Script légèrement court (${script.timing.estimatedTotalSeconds}s / ${script.timing.targetDurationSeconds}s).`,
            field: "timing",
          });
        }

        return { status: "completed", script, warnings: allWarnings };
      } catch (e) {
        if (isScriptDomainError(e)) {
          const err: ScriptValidationIssue = {
            code: e.code,
            field: e.field,
            message: e.publicMessage,
          };
          return { status: "invalid", errors: [err] };
        }
        return {
          status: "invalid",
          errors: [
            {
              code: "invalid_script",
              message: e instanceof Error ? e.message : "Finalisation impossible.",
            },
          ],
        };
      }
    },
  };
}

import { VisualDirectionSchema, type VisualDirection } from "@/domain/art";
import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import {
  CreativeConceptSchema,
  type CreativeConcept,
} from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import {
  StoryboardAnalysisCandidateSchema,
  finalizeStoryboardProject,
  isStoryboardDomainError,
  validateCandidateAgainstSources,
  type StoryboardValidationIssue,
  type StoryboardWarning,
} from "@/domain/storyboard";
import { isMarketingAnalyzerError } from "@/application/directors/marketing/failures";
import type { StoryboardAnalyzerPort } from "./analyzer-port";
import { runStoryboardDryRun } from "./dry-run";
import type {
  DirectorRunContext,
  StoryboardDirector,
  StoryboardDirectorInput,
  StoryboardDirectorResult,
} from "./result";

function newStoryboardId(): string {
  return `sb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type CreateStoryboardDirectorOptions = {
  analyzer: StoryboardAnalyzerPort;
};

export function createStoryboardDirector(
  options: CreateStoryboardDirectorOptions,
): StoryboardDirector {
  const { analyzer } = options;

  return {
    async run(
      input: StoryboardDirectorInput,
      context: DirectorRunContext,
    ): Promise<StoryboardDirectorResult> {
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
      const scriptParsed = VideoScriptSchema.safeParse(input.videoScript);
      if (!scriptParsed.success) {
        return {
          status: "invalid",
          errors: scriptParsed.error.issues.map((i) => ({
            code: "invalid_video_script",
            field: i.path.join(".") || undefined,
            message: i.message,
          })),
        };
      }
      const visualParsed = VisualDirectionSchema.safeParse(input.visualDirection);
      if (!visualParsed.success) {
        return {
          status: "invalid",
          errors: visualParsed.error.issues.map((i) => ({
            code: "invalid_visual_direction",
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
      const videoScript = JSON.parse(JSON.stringify(scriptParsed.data)) as VideoScript;
      const visualDirection = JSON.parse(
        JSON.stringify(visualParsed.data),
      ) as VisualDirection;

      if (context.mode === "dry-run") {
        const dry = runStoryboardDryRun(
          brief,
          marketingPlan,
          creativeConcept,
          videoScript,
          visualDirection,
        );
        const schemaFailed = dry.validations.some(
          (v) =>
            !v.passed &&
            [
              "brief_ok",
              "marketing_plan_ok",
              "creative_concept_ok",
              "video_script_ok",
              "visual_direction_ok",
            ].includes(v.code),
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
            message: "Dry-run uniquement : aucun storyboard n'a été produit.",
            required: true,
          });
        }
        return {
          status: "needs_input",
          missingInformation: missing,
          warnings: dry.warnings,
        };
      }

      const dry = runStoryboardDryRun(
        brief,
        marketingPlan,
        creativeConcept,
        videoScript,
        visualDirection,
      );
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
            videoScript,
            visualDirection,
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
              message:
                e instanceof Error
                  ? e.message.replace(/sk-[a-zA-Z0-9]+/g, "[redacted]")
                  : "Échec de l'analyse storyboard.",
            },
          ],
        };
      }

      const candidateParsed = StoryboardAnalysisCandidateSchema.safeParse(candidate);
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

      const { issues, warnings, missingInformation } = validateCandidateAgainstSources(
        candidateParsed.data,
        brief,
        marketingPlan,
        creativeConcept,
        videoScript,
        visualDirection,
      );

      if (missingInformation.some((m) => m.required)) {
        return {
          status: "needs_input",
          missingInformation: missingInformation.filter((m) => m.required),
          warnings: [...dry.warnings, ...warnings],
        };
      }

      if (issues.length > 0) {
        const critical = issues.filter((i) =>
          [
            "invariant_violation",
            "coverage_violation",
            "continuity_violation",
            "timing_invalid",
            "spoken_reconstruction_failed",
            "responsibility_leak",
            "technical_leak",
            "incoherent_with_sources",
            "invalid_candidate",
            "reference_unavailable",
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
        const storyboard = finalizeStoryboardProject({
          brief,
          marketingPlan,
          creativeConcept,
          videoScript,
          visualDirection,
          candidate: candidateParsed.data,
          metadata: {
            id: context.planId ?? newStoryboardId(),
            createdBy: context.createdBy ?? "system",
            correlationId: context.correlationId,
          },
        });

        const allWarnings: StoryboardWarning[] = [...dry.warnings, ...warnings];
        return { status: "completed", storyboard, warnings: allWarnings };
      } catch (e) {
        if (isStoryboardDomainError(e)) {
          if (e.code === "missing_information") {
            return {
              status: "needs_input",
              missingInformation: [
                {
                  code: e.code,
                  field: e.field,
                  message: e.publicMessage,
                  required: true,
                },
              ],
              warnings: dry.warnings,
            };
          }
          const err: StoryboardValidationIssue = {
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
              code: "invalid_storyboard",
              message: e instanceof Error ? e.message : "Finalisation impossible.",
            },
          ],
        };
      }
    },
  };
}

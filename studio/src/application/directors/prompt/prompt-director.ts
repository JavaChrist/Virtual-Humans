import { VisualDirectionSchema, type VisualDirection } from "@/domain/art";
import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import {
  CreativeConceptSchema,
  type CreativeConcept,
} from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import {
  StoryboardProjectSchema,
  type StoryboardProject,
} from "@/domain/storyboard";
import {
  PromptAnalysisCandidateSchema,
  finalizePromptPackages,
  isPromptDomainError,
  validateCandidateAgainstSources,
  type PromptValidationIssue,
  type PromptWarning,
} from "@/domain/prompt";
import type { PromptAnalyzerPort } from "./analyzer-port";
import { runPromptDryRun } from "./dry-run";
import type {
  DirectorRunContext,
  PromptDirector,
  PromptDirectorInput,
  PromptDirectorResult,
} from "./result";

export type CreatePromptDirectorOptions = {
  analyzer: PromptAnalyzerPort;
};

export function createPromptDirector(
  options: CreatePromptDirectorOptions,
): PromptDirector {
  const { analyzer } = options;

  return {
    async run(
      input: PromptDirectorInput,
      context: DirectorRunContext,
    ): Promise<PromptDirectorResult> {
      const parsers = [
        ["invalid_brief", VideoProjectBriefSchema.safeParse(input.brief)],
        ["invalid_marketing_plan", MarketingPlanSchema.safeParse(input.marketingPlan)],
        ["invalid_creative_concept", CreativeConceptSchema.safeParse(input.creativeConcept)],
        ["invalid_video_script", VideoScriptSchema.safeParse(input.videoScript)],
        ["invalid_visual_direction", VisualDirectionSchema.safeParse(input.visualDirection)],
        ["invalid_storyboard", StoryboardProjectSchema.safeParse(input.storyboard)],
      ] as const;

      for (const [code, parsed] of parsers) {
        if (!parsed.success) {
          return {
            status: "invalid",
            errors: parsed.error.issues.map((i) => ({
              code,
              field: i.path.join(".") || undefined,
              message: i.message,
            })),
          };
        }
      }

      const brief: VideoProjectBrief = {
        ...VideoProjectBriefSchema.parse(input.brief),
        mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
      };
      const marketingPlan = JSON.parse(
        JSON.stringify(MarketingPlanSchema.parse(input.marketingPlan)),
      ) as MarketingPlan;
      const creativeConcept = JSON.parse(
        JSON.stringify(CreativeConceptSchema.parse(input.creativeConcept)),
      ) as CreativeConcept;
      const videoScript = JSON.parse(
        JSON.stringify(VideoScriptSchema.parse(input.videoScript)),
      ) as VideoScript;
      const visualDirection = JSON.parse(
        JSON.stringify(VisualDirectionSchema.parse(input.visualDirection)),
      ) as VisualDirection;
      const storyboard = JSON.parse(
        JSON.stringify(StoryboardProjectSchema.parse(input.storyboard)),
      ) as StoryboardProject;

      if (context.mode === "dry-run") {
        const dry = runPromptDryRun(
          brief,
          marketingPlan,
          creativeConcept,
          videoScript,
          visualDirection,
          storyboard,
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
              "storyboard_ok",
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
            message: "Dry-run uniquement : aucun ScenePackage n'a été produit.",
            required: true,
          });
        }
        return {
          status: "needs_input",
          missingInformation: missing,
          warnings: dry.warnings,
        };
      }

      const dry = runPromptDryRun(
        brief,
        marketingPlan,
        creativeConcept,
        videoScript,
        visualDirection,
        storyboard,
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
            storyboard,
            locale: brief.language,
          },
          context,
        );
      } catch (e) {
        return {
          status: "invalid",
          errors: [
            {
              code: "analyzer_failed",
              message:
                e instanceof Error
                  ? e.message.replace(/sk-[a-zA-Z0-9]+/g, "[redacted]")
                  : "Échec de l'analyse prompt.",
            },
          ],
        };
      }

      const candidateParsed = PromptAnalysisCandidateSchema.safeParse(candidate);
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
        storyboard,
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
            "constraint_contradiction",
            "fidelity_violation",
            "injection_blocked",
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
        const output = finalizePromptPackages({
          brief,
          marketingPlan,
          creativeConcept,
          videoScript,
          visualDirection,
          storyboard,
          candidate: candidateParsed.data,
          metadata: {
            createdBy: context.createdBy ?? "system",
            correlationId: context.correlationId,
            idPrefix: context.planId ?? "pkg",
          },
        });

        const allWarnings: PromptWarning[] = [...dry.warnings, ...warnings];
        return { status: "completed", output, warnings: allWarnings };
      } catch (e) {
        if (isPromptDomainError(e)) {
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
          const err: PromptValidationIssue = {
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
              code: "invalid_package",
              message: e instanceof Error ? e.message : "Finalisation impossible.",
            },
          ],
        };
      }
    },
  };
}

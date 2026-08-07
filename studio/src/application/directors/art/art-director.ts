import {
  ArtAnalysisCandidateSchema,
  finalizeVisualDirection,
  isArtDomainError,
  validateCandidateAgainstSources,
  type ArtValidationIssue,
  type ArtWarning,
} from "@/domain/art";
import { VideoProjectBriefSchema, type VideoProjectBrief } from "@/domain/brief";
import {
  CreativeConceptSchema,
  type CreativeConcept,
} from "@/domain/creative";
import { MarketingPlanSchema, type MarketingPlan } from "@/domain/marketing";
import { VideoScriptSchema, type VideoScript } from "@/domain/script";
import { isMarketingAnalyzerError } from "@/application/directors/marketing/failures";
import { artFailure, withArtPublicMessage } from "@/application/directors/art/failures";
import type { ArtAnalyzerPort } from "./analyzer-port";
import { runArtDryRun } from "./dry-run";
import type {
  ArtDirector,
  ArtDirectorInput,
  ArtDirectorResult,
  DirectorRunContext,
} from "./result";

function newArtId(): string {
  return `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type CreateArtDirectorOptions = {
  analyzer: ArtAnalyzerPort;
};

export function createArtDirector(options: CreateArtDirectorOptions): ArtDirector {
  const { analyzer } = options;

  return {
    async run(
      input: ArtDirectorInput,
      context: DirectorRunContext,
    ): Promise<ArtDirectorResult> {
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

      const brief: VideoProjectBrief = {
        ...briefParsed.data,
        mediaReferences: briefParsed.data.mediaReferences.map((m) => ({ ...m })),
      };
      const marketingPlan = JSON.parse(JSON.stringify(planParsed.data)) as MarketingPlan;
      const creativeConcept = JSON.parse(
        JSON.stringify(conceptParsed.data),
      ) as CreativeConcept;
      const videoScript = JSON.parse(JSON.stringify(scriptParsed.data)) as VideoScript;
      const snapshot = input.characterCapabilities
        ? (JSON.parse(JSON.stringify(input.characterCapabilities)) as typeof input.characterCapabilities)
        : undefined;

      if (context.mode === "dry-run") {
        const dry = runArtDryRun(
          brief,
          marketingPlan,
          creativeConcept,
          videoScript,
          snapshot,
        );
        const schemaFailed = dry.validations.some(
          (v) =>
            !v.passed &&
            [
              "brief_ok",
              "marketing_plan_ok",
              "creative_concept_ok",
              "video_script_ok",
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
            message:
              "Dry-run uniquement : aucune direction visuelle n'a été produite.",
            required: true,
          });
        }
        return {
          status: "needs_input",
          missingInformation: missing,
          warnings: dry.warnings,
        };
      }

      const dry = runArtDryRun(
        brief,
        marketingPlan,
        creativeConcept,
        videoScript,
        snapshot,
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

      let outcome;
      try {
        outcome = await analyzer.analyze(
          {
            brief,
            marketingPlan,
            creativeConcept,
            videoScript,
            characterCapabilities: snapshot,
            locale: brief.language,
          },
          context,
        );
      } catch (e) {
        if (isMarketingAnalyzerError(e)) {
          return {
            status: "provider_failed",
            failure: withArtPublicMessage(e.failure),
            metering: e.metering,
          };
        }
        return {
          status: "provider_failed",
          failure: artFailure("internal_error", {
            retryable: false,
            internalCode: "analyzer_unexpected",
          }),
        };
      }

      const metering = outcome.metering;
      const candidateParsed = ArtAnalysisCandidateSchema.safeParse(
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

      const { issues, warnings, missingInformation } = validateCandidateAgainstSources(
        candidateParsed.data,
        brief,
        marketingPlan,
        creativeConcept,
        videoScript,
        snapshot,
      );

      if (missingInformation.some((m) => m.required)) {
        return {
          status: "needs_input",
          missingInformation: missingInformation.filter((m) => m.required),
          warnings: [...dry.warnings, ...warnings],
          metering,
        };
      }

      if (issues.length > 0) {
        const critical = issues.filter((i) =>
          [
            "invariant_violation",
            "continuity_violation",
            "accessibility_violation",
            "responsibility_leak",
            "technical_leak",
            "incoherent_with_sources",
            "invalid_candidate",
            "asset_unavailable",
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
        const visualDirection = finalizeVisualDirection({
          brief,
          marketingPlan,
          creativeConcept,
          videoScript,
          candidate: candidateParsed.data,
          characterCapabilities: snapshot,
          metadata: {
            id: context.planId ?? newArtId(),
            createdBy: context.createdBy ?? "system",
            correlationId: context.correlationId,
          },
        });

        const allWarnings: ArtWarning[] = [...dry.warnings, ...warnings];
        return { status: "completed", visualDirection, warnings: allWarnings, metering };
      } catch (e) {
        if (isArtDomainError(e)) {
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
              metering,
            };
          }
          const err: ArtValidationIssue = {
            code: e.code,
            field: e.field,
            message: e.publicMessage,
          };
          return { status: "invalid", errors: [err], metering };
        }
        return {
          status: "invalid",
          errors: [
            {
              code: "invalid_direction",
              message: e instanceof Error ? e.message : "Finalisation impossible.",
            },
          ],
          metering,
        };
      }
    },
  };
}

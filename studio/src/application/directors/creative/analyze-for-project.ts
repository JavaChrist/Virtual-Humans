/**
 * AnalyzeCreativeForProject — persisted Creative Director (VHS-118B).
 * Works only from server-loaded active brief + marketing_plan. No browser plan body.
 */

import { createHash, randomUUID } from "node:crypto";
import { VideoProjectBriefSchema } from "@/domain/brief";
import {
  CREATIVE_CONCEPT_SCHEMA_VERSION,
  CreativeConceptSchema,
  type CreativeConcept,
} from "@/domain/creative";
import { MarketingPlanSchema } from "@/domain/marketing";
import {
  httpStatusForMarketingFailure,
  MARKETING_FAILURE_PUBLIC_MESSAGES,
} from "@/application/directors/marketing/failures";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import {
  canExecuteCreativeAi,
  canUseDirectorV2Persistence,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import {
  DEFAULT_OPENAI_CREATIVE_MODEL,
  parseOpenAICreativeConfig,
} from "@/infrastructure/ai/openai/config";
import {
  CREATIVE_ANALYZER_PROMPT_VERSION,
  CREATIVE_CANDIDATE_SCHEMA_VERSION,
  runOpenAICreativeDryRun,
} from "@/infrastructure/ai/openai/creative";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import { createCreativeDirector } from "./creative-director";
import type { CreativeAnalyzerPort } from "./analyzer-port";
import type { DirectorRunContext } from "./result";

export type PublicWarning = { code: string; message: string };

export type CreativeConceptView = {
  revision: number;
  status: "ready" | "absent";
  title?: string;
  logline?: string;
  bigIdea?: string;
  narrativeApproach?: string;
  rhythm?: string;
  emotionalArc?: string;
  warnings: PublicWarning[];
};

export type CreativeProjectAnalysisInput = {
  projectId: string;
  expectedMarketingPlanRevision?: number;
};

export type CreativeProjectDryRunResult = {
  executable: boolean;
  providerCalled: false;
  executionAvailable: boolean;
  briefRevision: number;
  briefArtifactId: string;
  marketingPlanRevision: number;
  marketingPlanArtifactId: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  pricingConfigured: boolean;
  estimatedCostMinor?: number;
  currency?: string;
  confidence?: string;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: PublicWarning[];
  missingInformation: Array<{ code: string; message: string; field?: string }>;
  existingConcept?: CreativeConceptView;
};

export type CreativeProjectAnalysisResult =
  | { status: "completed" | "existing"; concept: CreativeConceptView; directorRunId: string }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | {
      status: "needs_input";
      missingInformation: Array<{ code: string; message: string; field?: string }>;
      warnings: PublicWarning[];
      directorRunId?: string;
    }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 402 | 409 | 422 | 429 | 500 | 502 | 503 | 504;
      retryAfterSeconds?: number;
      provider?: "openai";
      directorRunId?: string;
    };

export type CreativeDirectorRunPort = {
  beginOrGet(input: {
    id: string;
    workspaceId: string;
    projectId: string;
    marketingPlanArtifactId: string;
    marketingPlanRevision: number;
    briefArtifactId: string;
    briefRevision: number;
    modelId: string;
    promptVersion: string;
    schemaVersion: string;
    idempotencyKey: string;
    commandFingerprint: string;
    correlationId: string;
    estimatedCostMinor?: number;
    currency?: string;
  }): Promise<
    | { status: "created"; directorRunId: string; revision: number }
    | {
        status: "existing";
        directorRunId: string;
        revision: number;
        outputArtifactId: string;
      }
    | { status: "already_running"; directorRunId: string; revision: number }
  >;
  reserveBudget(input: {
    reservationId: string;
    workspaceId: string;
    projectId: string;
    directorRunId: string;
    attemptId: string;
    amountMinor: number;
    currency: string;
    correlationId: string;
    ledgerIdempotencyKey: string;
  }): Promise<void>;
  persistConcept(input: {
    workspaceId: string;
    projectId: string;
    directorRunId: string;
    artifactId: string;
    marketingPlanArtifactId: string;
    marketingPlanRevision: number;
    briefArtifactId: string;
    briefRevision: number;
    concept: Record<string, unknown>;
    schemaVersion: string;
    correlationId: string;
    reservationId?: string;
    actualCostMinor?: number;
    costStatus: string;
    usage?: Record<string, unknown>;
    expectedRunRevision: number;
    ledgerIdempotencyKey?: string;
  }): Promise<{ status: "created" | "existing"; artifactId: string; revision: number }>;
  failRun(input: {
    directorRunId: string;
    workspaceId: string;
    expectedRevision: number;
    errorCode: string;
    status: "failed" | "needs_input" | "cancelled";
    reservationId?: string;
    correlationId: string;
  }): Promise<void>;
  loadActiveCreativeConcept(
    projectId: string
  ): Promise<{ revision: number; value: unknown } | null>;
};

export type AnalyzeCreativeForProjectDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  directorRuns: CreativeDirectorRunPort;
  analyzer: CreativeAnalyzerPort;
  pricing?: AiTokenPricingPort;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
};

export type AnalyzeCreativeForProject = {
  dryRun(
    input: CreativeProjectAnalysisInput,
    context: DirectorRunContext
  ): Promise<CreativeProjectDryRunResult>;
  execute(
    input: CreativeProjectAnalysisInput,
    context: DirectorRunContext
  ): Promise<CreativeProjectAnalysisResult>;
};

function failedAnalysis(
  code: string,
  publicMessage: string,
  httpHint: Extract<CreativeProjectAnalysisResult, { status: "failed" }>["httpHint"],
  opts?: Partial<Extract<CreativeProjectAnalysisResult, { status: "failed" }>>
): Extract<CreativeProjectAnalysisResult, { status: "failed" }> {
  return {
    status: "failed",
    code,
    publicMessage,
    httpHint,
    retryable: opts?.retryable ?? false,
    retryAfterSeconds: opts?.retryAfterSeconds,
    provider: opts?.provider,
    directorRunId: opts?.directorRunId,
  };
}

export function mapCreativeConceptView(
  concept: CreativeConcept,
  revision: number,
  warnings: PublicWarning[] = []
): CreativeConceptView {
  return {
    revision,
    status: "ready",
    title: concept.title,
    logline: concept.logline,
    bigIdea: concept.bigIdea,
    narrativeApproach: concept.narrativeApproach,
    rhythm: concept.rhythm,
    emotionalArc: concept.emotionalArc
      .map((x) => `${x.purpose}: ${x.description}`)
      .join(" · "),
    warnings,
  };
}

function mapStoredConcept(
  value: unknown,
  revision: number
): CreativeConceptView | undefined {
  const parsed = CreativeConceptSchema.safeParse(value);
  return parsed.success
    ? mapCreativeConceptView(parsed.data, revision)
    : undefined;
}

async function loadActiveArtifact<T>(
  artifacts: ArtifactRepository,
  projectId: string,
  type: "video_project_brief" | "marketing_plan",
  schema: {
    safeParse(
      value: unknown
    ): { success: true; data: T } | { success: false };
  }
) {
  const active = await artifacts.getActive(projectId, type);
  if (!active) return null;
  const art = await artifacts.load(active.artifactId);
  if (!art) return null;
  const parsed = schema.safeParse(art.value);
  if (!parsed.success) return null;
  return {
    value: parsed.data,
    artifactId: active.artifactId,
    revision: active.revision,
  };
}

function commandFingerprint(input: {
  projectId: string;
  briefArtifactId: string;
  briefRevision: number;
  marketingPlanArtifactId: string;
  marketingPlanRevision: number;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.projectId,
        input.briefArtifactId,
        String(input.briefRevision),
        input.marketingPlanArtifactId,
        String(input.marketingPlanRevision),
        input.model,
        input.promptVersion,
        input.schemaVersion,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 64);
}

function emptyDry(
  partial: Partial<CreativeProjectDryRunResult> & {
    validations: CreativeProjectDryRunResult["validations"];
    missingInformation: CreativeProjectDryRunResult["missingInformation"];
  }
): CreativeProjectDryRunResult {
  return {
    executable: false,
    providerCalled: false,
    executionAvailable: false,
    briefRevision: 0,
    briefArtifactId: "",
    marketingPlanRevision: 0,
    marketingPlanArtifactId: "",
    model: DEFAULT_OPENAI_CREATIVE_MODEL,
    promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
    schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
    pricingConfigured: false,
    warnings: [],
    ...partial,
  };
}

export function createAnalyzeCreativeForProject(
  deps: AnalyzeCreativeForProjectDeps
): AnalyzeCreativeForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const idFactory = deps.idFactory ?? randomUUID;

  return {
    async dryRun(input) {
      if (!canUseDirectorV2Persistence(env)) {
        return emptyDry({
          validations: [
            {
              code: "persistence",
              passed: false,
              message: "Persistance Director désactivée.",
            },
          ],
          missingInformation: [],
        });
      }

      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return emptyDry({
          validations: [
            { code: "project", passed: false, message: "Projet introuvable." },
          ],
          missingInformation: [
            { code: "project_missing", message: "Projet introuvable." },
          ],
        });
      }

      const brief = await loadActiveArtifact(
        deps.artifacts,
        input.projectId,
        "video_project_brief",
        VideoProjectBriefSchema
      );
      const plan = await loadActiveArtifact(
        deps.artifacts,
        input.projectId,
        "marketing_plan",
        MarketingPlanSchema
      );

      if (!brief || !plan) {
        const missingBrief = !brief;
        return emptyDry({
          briefRevision: brief?.revision ?? 0,
          briefArtifactId: brief?.artifactId ?? "",
          marketingPlanRevision: plan?.revision ?? 0,
          marketingPlanArtifactId: plan?.artifactId ?? "",
          validations: [
            {
              code: missingBrief ? "brief" : "marketing_plan",
              passed: false,
              message: missingBrief
                ? "Brief actif introuvable."
                : "Marketing Plan actif introuvable.",
            },
          ],
          missingInformation: [
            {
              code: missingBrief ? "brief_missing" : "marketing_plan_missing",
              message: missingBrief
                ? "Brief actif introuvable."
                : "Marketing Plan actif introuvable.",
            },
          ],
        });
      }

      const aiDry = runOpenAICreativeDryRun(brief.value, plan.value, {
        env,
        pricing: deps.pricing,
      });
      const existing = await deps.directorRuns.loadActiveCreativeConcept(
        input.projectId
      );

      let estimatedCostMinor: number | undefined;
      let currency: string | undefined;
      let confidence: string | undefined;
      if (deps.pricing && aiDry.pricingConfigured) {
        const book = deps.pricing.getPriceBook(aiDry.model);
        if (book) {
          const inTok = aiDry.approximateInputTokens ?? 0;
          estimatedCostMinor =
            Math.floor((inTok * book.inputPerMillionMinor) / 1_000_000) +
            Math.floor(
              (aiDry.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
            );
          currency = book.currency;
          confidence = book.confidence;
        }
      }

      return {
        executable: aiDry.executable,
        providerCalled: false,
        executionAvailable:
          aiDry.executable && canExecuteCreativeAi(env) && aiDry.pricingConfigured,
        briefRevision: brief.revision,
        briefArtifactId: brief.artifactId,
        marketingPlanRevision: plan.revision,
        marketingPlanArtifactId: plan.artifactId,
        model: aiDry.model,
        promptVersion: aiDry.promptVersion,
        schemaVersion: aiDry.schemaVersion,
        pricingConfigured: aiDry.pricingConfigured,
        estimatedCostMinor,
        currency,
        confidence,
        validations: aiDry.validations,
        warnings: aiDry.warnings,
        missingInformation: aiDry.validations
          .filter((v) => !v.passed)
          .map((v) => ({ code: v.code, message: v.message })),
        existingConcept: existing
          ? mapStoredConcept(existing.value, existing.revision)
          : undefined,
      };
    },

    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failedAnalysis(
          "persistence_disabled",
          "Persistance Director désactivée.",
          503
        );
      }
      if (!canExecuteCreativeAi(env) || !isDirectorV2PaidAiEnabled(env)) {
        return failedAnalysis(
          "creative_ai_disabled",
          "Analyse Creative IA désactivée.",
          503
        );
      }

      let config;
      try {
        config = parseOpenAICreativeConfig(env);
      } catch {
        return failedAnalysis(
          "invalid_config",
          "Configuration Creative IA invalide.",
          503
        );
      }
      if (!config.apiKeyPresent) {
        return failedAnalysis(
          "openai_not_configured",
          "OpenAI n’est pas configuré.",
          503
        );
      }

      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failedAnalysis("not_found", "Projet introuvable.", 400);
      }

      const brief = await loadActiveArtifact(
        deps.artifacts,
        input.projectId,
        "video_project_brief",
        VideoProjectBriefSchema
      );
      const plan = await loadActiveArtifact(
        deps.artifacts,
        input.projectId,
        "marketing_plan",
        MarketingPlanSchema
      );
      if (!brief) {
        return failedAnalysis("brief_missing", "Brief actif introuvable.", 422);
      }
      if (!plan) {
        return failedAnalysis(
          "marketing_plan_missing",
          "Marketing Plan actif introuvable.",
          422
        );
      }
      if (
        input.expectedMarketingPlanRevision != null &&
        input.expectedMarketingPlanRevision !== plan.revision
      ) {
        return failedAnalysis(
          "marketing_plan_revision_conflict",
          "Le Marketing Plan a changé depuis la vérification.",
          409
        );
      }

      const aiDry = runOpenAICreativeDryRun(brief.value, plan.value, {
        env,
        pricing: deps.pricing,
      });
      if (!aiDry.executable) {
        return {
          status: "needs_input",
          missingInformation: aiDry.validations
            .filter((v) => !v.passed)
            .map((v) => ({ code: v.code, message: v.message })),
          warnings: aiDry.warnings,
        };
      }
      if (!aiDry.pricingConfigured && config.requireFirmPricing) {
        return failedAnalysis(
          "pricing_unknown",
          "Tarification indisponible.",
          402
        );
      }

      let estimatedCostMinor = 1;
      let currency = "USD";
      const book = deps.pricing?.getPriceBook(config.model);
      if (book) {
        estimatedCostMinor = Math.max(
          1,
          Math.floor(
            ((aiDry.approximateInputTokens ?? 500) * book.inputPerMillionMinor) /
              1_000_000
          ) +
            Math.floor(
              (config.maxOutputTokens * book.outputPerMillionMinor) / 1_000_000
            )
        );
        currency = book.currency;
      } else if (config.requireFirmPricing) {
        return failedAnalysis(
          "pricing_unknown",
          "Tarification indisponible.",
          402
        );
      }

      const idemRaw = [
        "cre",
        input.projectId,
        brief.artifactId,
        String(brief.revision),
        plan.artifactId,
        String(plan.revision),
        config.model,
        CREATIVE_ANALYZER_PROMPT_VERSION,
        CREATIVE_CANDIDATE_SCHEMA_VERSION,
      ].join(":");
      const idempotencyKey =
        idemRaw.length <= 200
          ? idemRaw
          : createHash("sha256").update(idemRaw).digest("hex");

      const begin = await deps.directorRuns.beginOrGet({
        id: idFactory(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        marketingPlanArtifactId: plan.artifactId,
        marketingPlanRevision: plan.revision,
        briefArtifactId: brief.artifactId,
        briefRevision: brief.revision,
        modelId: config.model,
        promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
        schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
        idempotencyKey,
        commandFingerprint: commandFingerprint({
          projectId: input.projectId,
          briefArtifactId: brief.artifactId,
          briefRevision: brief.revision,
          marketingPlanArtifactId: plan.artifactId,
          marketingPlanRevision: plan.revision,
          model: config.model,
          promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
          schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
        }),
        correlationId: context.correlationId,
        estimatedCostMinor,
        currency,
      });

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Une analyse créative est déjà en cours.",
        };
      }

      if (begin.status === "existing") {
        const art = await deps.artifacts.load(begin.outputArtifactId);
        const view = art
          ? mapStoredConcept(art.value, art.revision)
          : undefined;
        if (view) {
          return {
            status: "existing",
            concept: view,
            directorRunId: begin.directorRunId,
          };
        }
      }

      const directorRunId = begin.directorRunId;
      const runRevision = begin.revision;
      const reservationId = idFactory();
      let reserved = false;

      try {
        await deps.directorRuns.reserveBudget({
          reservationId,
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          directorRunId,
          attemptId: "creative-1",
          amountMinor: estimatedCostMinor,
          currency,
          correlationId: context.correlationId,
          ledgerIdempotencyKey: `dir-reserve-${directorRunId}`,
        });
        reserved = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        await deps.directorRuns
          .failRun({
            directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: runRevision + (reserved ? 1 : 0),
            errorCode: "budget_exceeded",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failedAnalysis(
          "budget_exceeded",
          /insufficient/i.test(msg)
            ? MARKETING_FAILURE_PUBLIC_MESSAGES.budget_exceeded
            : "Réservation budget impossible.",
          402,
          { directorRunId }
        );
      }

      const revisionAfterReserve = runRevision + 1;
      const artifactId = idFactory();
      const result = await createCreativeDirector({
        analyzer: deps.analyzer,
      }).run(
        { brief: brief.value, marketingPlan: plan.value },
        {
          ...context,
          mode: "execute",
          planId: artifactId,
          createdBy: "shared-password-user",
        }
      );

      if (result.status === "needs_input") {
        await deps.directorRuns.failRun({
          directorRunId,
          workspaceId: deps.workspaceId,
          expectedRevision: revisionAfterReserve,
          errorCode: "needs_input",
          status: "needs_input",
          reservationId,
          correlationId: context.correlationId,
        });
        return {
          status: "needs_input",
          missingInformation: result.missingInformation,
          warnings: result.warnings,
          directorRunId,
        };
      }

      if (result.status === "provider_failed") {
        await deps.directorRuns.failRun({
          directorRunId,
          workspaceId: deps.workspaceId,
          expectedRevision: revisionAfterReserve,
          errorCode: result.failure.code,
          status: "failed",
          reservationId,
          correlationId: context.correlationId,
        });
        const mapped = httpStatusForMarketingFailure(result.failure.code);
        return failedAnalysis(
          result.failure.code,
          result.failure.publicMessage,
          mapped === 202 ? 500 : mapped,
          {
            retryable: result.failure.retryable,
            retryAfterSeconds: result.failure.retryAfterSeconds,
            provider: result.failure.provider,
            directorRunId,
          }
        );
      }

      if (result.status === "invalid") {
        await deps.directorRuns.failRun({
          directorRunId,
          workspaceId: deps.workspaceId,
          expectedRevision: revisionAfterReserve,
          errorCode: "invalid_candidate",
          status: "failed",
          reservationId,
          correlationId: context.correlationId,
        });
        return failedAnalysis(
          "invalid_candidate",
          result.errors[0]?.message ??
            MARKETING_FAILURE_PUBLIC_MESSAGES.invalid_candidate,
          422,
          { directorRunId }
        );
      }

      try {
        const persisted = await deps.directorRuns.persistConcept({
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          directorRunId,
          artifactId: result.concept.id,
          marketingPlanArtifactId: plan.artifactId,
          marketingPlanRevision: plan.revision,
          briefArtifactId: brief.artifactId,
          briefRevision: brief.revision,
          concept: result.concept as unknown as Record<string, unknown>,
          schemaVersion: CREATIVE_CONCEPT_SCHEMA_VERSION,
          correlationId: context.correlationId,
          reservationId,
          actualCostMinor: estimatedCostMinor,
          costStatus: aiDry.pricingConfigured ? "committed" : "unknown",
          expectedRunRevision: revisionAfterReserve,
          ledgerIdempotencyKey: `dir-commit-${directorRunId}`,
        });
        return {
          status: persisted.status === "existing" ? "existing" : "completed",
          concept: mapCreativeConceptView(
            result.concept,
            persisted.revision,
            result.warnings
          ),
          directorRunId,
        };
      } catch {
        await deps.directorRuns
          .failRun({
            directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: revisionAfterReserve,
            errorCode: "persist_failed",
            status: "failed",
            reservationId,
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failedAnalysis(
          "persist_failed",
          "La persistance du concept a échoué.",
          503,
          { directorRunId }
        );
      }
    },
  };
}

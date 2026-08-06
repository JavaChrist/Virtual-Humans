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
import { httpStatusForMarketingFailure } from "@/application/directors/marketing/failures";
import { CREATIVE_FAILURE_PUBLIC_MESSAGES } from "@/application/directors/creative/failures";
import {
  meteringCostStatusForFail,
  meteringKnownCostMinor,
  meteringUsageRecord,
} from "@/application/directors/shared/analyzer-metering";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import {
  canExecuteCreativeAi,
  canUseDirectorV2Persistence,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import {
  e2eFakeOpenAiConfig,
  isDirectorE2eFakeMode,
  textDirectorExecutionAvailable,
} from "@/infrastructure/e2e/e2e-text-director-gate";
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
import {
  createLogContext,
  logger,
} from "@/infrastructure/observability";
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
  reasoningEffort: string;
  maxOutputTokens: number;
  promptVersion: string;
  schemaVersion: string;
  pricingConfigured: boolean;
  estimatedCostMinor?: number;
  currency?: string;
  confidence?: string;
  /** Domain arc budget for this brief (8H-B single source). */
  durationSeconds?: number;
  maxBeats?: number;
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
    /** Redacted provider usage when tokens were consumed before fail. */
    usage?: Record<string, unknown>;
    /** Known actual cost only — never invent from estimate. */
    actualCostMinor?: number;
    costStatus?: string;
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
): Promise<{
  value: T;
  artifactId: string;
  revision: number;
} | null> {
  const active = await artifacts.getActive(projectId, type);
  if (!active) return null;
  // Stale active pointers must not unblock Creative (brief revise invalidation).
  if (active.stale) return null;
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
    reasoningEffort: "unknown",
    maxOutputTokens: 0,
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

      const e2e = isDirectorE2eFakeMode(env);
      const domainExecutable = e2e ? true : aiDry.executable;
      const e2eCfg = e2e ? e2eFakeOpenAiConfig() : null;
      return {
        executable: domainExecutable,
        providerCalled: false,
        executionAvailable: textDirectorExecutionAvailable({
          env,
          domainExecutable,
          paidPathAvailable: canExecuteCreativeAi(env),
          pricingConfigured: aiDry.pricingConfigured,
        }),
        briefRevision: brief.revision,
        briefArtifactId: brief.artifactId,
        marketingPlanRevision: plan.revision,
        marketingPlanArtifactId: plan.artifactId,
        model: e2eCfg?.model ?? aiDry.model,
        reasoningEffort: e2eCfg?.reasoningEffort ?? aiDry.reasoningEffort,
        maxOutputTokens: e2eCfg?.maxOutputTokens ?? aiDry.maxOutputTokens,
        promptVersion: aiDry.promptVersion,
        schemaVersion: aiDry.schemaVersion,
        pricingConfigured: e2e ? true : aiDry.pricingConfigured,
        estimatedCostMinor,
        currency,
        confidence,
        durationSeconds: aiDry.durationSeconds,
        maxBeats: aiDry.maxBeats,
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
      const e2e = isDirectorE2eFakeMode(env);
      if (!e2e && (!canExecuteCreativeAi(env) || !isDirectorV2PaidAiEnabled(env))) {
        return failedAnalysis(
          "creative_ai_disabled",
          "Analyse Creative IA désactivée.",
          503
        );
      }

      let config;
      if (e2e) {
        config = e2eFakeOpenAiConfig();
      } else {
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
      if (!e2e && !aiDry.executable) {
        return {
          status: "needs_input",
          missingInformation: aiDry.validations
            .filter((v) => !v.passed)
            .map((v) => ({ code: v.code, message: v.message })),
          warnings: aiDry.warnings,
        };
      }
      if (!e2e && !aiDry.pricingConfigured && config.requireFirmPricing) {
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
            ? CREATIVE_FAILURE_PUBLIC_MESSAGES.budget_exceeded
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

      const meteringUsage = meteringUsageRecord(result.metering);
      const meteringKnownCost = meteringKnownCostMinor(result.metering);
      const meteringFailCostStatus = meteringCostStatusForFail(result.metering);

      if (result.status === "needs_input") {
        await deps.directorRuns.failRun({
          directorRunId,
          workspaceId: deps.workspaceId,
          expectedRevision: revisionAfterReserve,
          errorCode: "needs_input",
          status: "needs_input",
          reservationId,
          correlationId: context.correlationId,
          usage: meteringUsage,
          actualCostMinor: meteringKnownCost,
          costStatus: meteringFailCostStatus,
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
          usage: meteringUsage,
          actualCostMinor: meteringKnownCost,
          costStatus: meteringFailCostStatus,
        });
        const mapped = httpStatusForMarketingFailure(result.failure.code);
        return failedAnalysis(
          result.failure.code,
          result.failure.publicMessage,
          mapped === 202 ? 500 : mapped,
          {
            // Creative: never auto-retry (human retry gated separately).
            retryable: false,
            retryAfterSeconds: result.failure.retryAfterSeconds,
            provider: result.failure.provider,
            directorRunId,
          }
        );
      }

      if (result.status === "invalid") {
        // Redacted observability only — never log the candidate payload.
        const corr = context.correlationId;
        logger.info(
          "director.creative.invalid_candidate",
          createLogContext(corr, {
            projectId: input.projectId,
            operation: "director.creative.execute",
          }),
          {
            directorRunId,
            requestIdRedacted:
              corr.length > 12 ? `${corr.slice(0, 8)}…${corr.slice(-4)}` : "[redacted]",
            usage: meteringUsage ?? null,
            actualCostMinor: meteringKnownCost ?? null,
            issues: result.errors.map((e) => ({
              validatorCode: e.code,
              fieldPath: e.field ?? null,
              matchedRule: e.diagnostics?.matchedRule ?? null,
              category: e.diagnostics?.category ?? null,
              matchHash: e.diagnostics?.matchHash ?? null,
              matchLen: e.diagnostics?.matchLen ?? null,
              sourceType: e.diagnostics?.sourceType ?? "candidate_field",
              // Numeric-only arc shape (8H-A) — never beat prose.
              arcLength: e.diagnostics?.arcLength ?? null,
              orders: e.diagnostics?.orders ?? null,
              // 8I-A — numeric capacity / Zod too_big only.
              schemaName: e.diagnostics?.schemaName ?? null,
              zodCode: e.diagnostics?.zodCode ?? null,
              arrayName: e.diagnostics?.arrayName ?? null,
              arrayLength: e.diagnostics?.arrayLength ?? null,
              arrayMax: e.diagnostics?.arrayMax ?? null,
              lengthBeforeEnrichment:
                e.diagnostics?.lengthBeforeEnrichment ?? null,
              lengthAfterEnrichment:
                e.diagnostics?.lengthAfterEnrichment ?? null,
              finalizeStep: e.diagnostics?.finalizeStep ?? null,
            })),
          },
        );
        await deps.directorRuns.failRun({
          directorRunId,
          workspaceId: deps.workspaceId,
          expectedRevision: revisionAfterReserve,
          errorCode: "invalid_candidate",
          status: "failed",
          reservationId,
          correlationId: context.correlationId,
          usage: meteringUsage,
          actualCostMinor: meteringKnownCost,
          costStatus: meteringFailCostStatus,
        });
        return failedAnalysis(
          "invalid_candidate",
          result.errors[0]?.message ??
            CREATIVE_FAILURE_PUBLIC_MESSAGES.invalid_candidate,
          422,
          { directorRunId }
        );
      }

      if (
        meteringKnownCost != null &&
        meteringKnownCost > estimatedCostMinor
      ) {
        await deps.directorRuns.failRun({
          directorRunId,
          workspaceId: deps.workspaceId,
          expectedRevision: revisionAfterReserve,
          errorCode: "budget_exceeded",
          status: "failed",
          reservationId,
          correlationId: context.correlationId,
          usage: meteringUsage,
          actualCostMinor: meteringKnownCost,
          costStatus: "committed",
        });
        return failedAnalysis(
          "budget_exceeded",
          CREATIVE_FAILURE_PUBLIC_MESSAGES.budget_exceeded,
          402,
          { directorRunId }
        );
      }

      try {
        const actualCostMinor = meteringKnownCost ?? estimatedCostMinor;
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
          actualCostMinor,
          costStatus:
            e2e || aiDry.pricingConfigured || meteringKnownCost != null
              ? "committed"
              : "provisional",
          usage: meteringUsage,
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

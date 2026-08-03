/**
 * Project-scoped Marketing analysis (VHS-117B).
 * Dry-run never mutates; execute uses injected ports + fakeable analyzer.
 */

import { createHash, randomUUID } from "node:crypto";
import type { VideoProjectBrief } from "@/domain/brief";
import { VideoProjectBriefSchema } from "@/domain/brief";
import {
  MARKETING_PLAN_SCHEMA_VERSION,
  type MarketingPlan,
} from "@/domain/marketing";
import {
  canExecuteMarketingAi,
  canUseDirectorV2Persistence,
  isDirectorV2MarketingAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import {
  e2eFakeOpenAiConfig,
  isDirectorE2eFakeMode,
  textDirectorExecutionAvailable,
} from "@/infrastructure/e2e/e2e-text-director-gate";
import {
  MARKETING_ANALYZER_PROMPT_VERSION,
  MARKETING_CANDIDATE_SCHEMA_VERSION,
  runOpenAIMarketingDryRun,
  type AiTokenPricingPort,
} from "@/infrastructure/ai/openai/marketing";
import {
  DEFAULT_OPENAI_MARKETING_MODEL,
  parseOpenAIMarketingConfig,
} from "@/infrastructure/ai/openai/config";
import { assessMarketingBriefReadiness } from "@/domain/marketing";
import { createMarketingDirector } from "./marketing-director";
import type { MarketingAnalyzerPort } from "./analyzer-port";
import {
  httpStatusForMarketingFailure,
  MARKETING_FAILURE_PUBLIC_MESSAGES,
} from "./failures";
import type { DirectorRunContext } from "./result";
import type {
  ArtifactRepository,
  ProjectRepository,
} from "@/application/projects/ports";

export type PublicWarning = { code: string; message: string };

export type MarketingPlanView = {
  revision: number;
  status: "ready" | "needs_input" | "running" | "failed" | "absent";
  objective?: string;
  audience?: string;
  mainProblem?: string;
  mainBenefit?: string;
  uniqueSellingPoint?: string;
  emotionalHook?: string;
  callToAction?: string;
  keyMessages?: string[];
  successMetric?: string;
  assumptions?: string[];
  warnings: PublicWarning[];
};

export type MarketingProjectAnalysisInput = {
  projectId: string;
  expectedBriefRevision?: number;
};

export type MarketingProjectDryRunResult = {
  executable: boolean;
  providerCalled: false;
  executionAvailable: boolean;
  briefRevision: number;
  briefArtifactId: string;
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
  existingPlan?: MarketingPlanView;
};

export type MarketingProjectAnalysisResult =
  | {
      status: "completed" | "existing";
      plan: MarketingPlanView;
      directorRunId: string;
    }
  | {
      status: "already_running";
      directorRunId: string;
      publicMessage: string;
    }
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
      httpHint:
        | 400
        | 402
        | 409
        | 422
        | 429
        | 500
        | 502
        | 503
        | 504;
      /** Safe, validated Retry-After seconds when rate-limited. */
      retryAfterSeconds?: number;
      provider?: "openai";
      directorRunId?: string;
    };

function failedAnalysis(
  code: string,
  publicMessage: string,
  httpHint: Extract<
    MarketingProjectAnalysisResult,
    { status: "failed" }
  >["httpHint"],
  opts?: {
    retryable?: boolean;
    retryAfterSeconds?: number;
    provider?: "openai";
    directorRunId?: string;
  }
): Extract<MarketingProjectAnalysisResult, { status: "failed" }> {
  return {
    status: "failed",
    code,
    publicMessage,
    retryable: opts?.retryable ?? false,
    httpHint,
    retryAfterSeconds: opts?.retryAfterSeconds,
    provider: opts?.provider,
    directorRunId: opts?.directorRunId,
  };
}

export type MarketingDirectorRunPort = {
  beginOrGet(input: {
    id: string;
    workspaceId: string;
    projectId: string;
    inputArtifactId: string;
    inputRevision: number;
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
    | { status: "existing"; directorRunId: string; revision: number; outputArtifactId: string }
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
  persistPlan(input: {
    workspaceId: string;
    projectId: string;
    directorRunId: string;
    artifactId: string;
    briefArtifactId: string;
    briefRevision: number;
    plan: Record<string, unknown>;
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
  loadActiveMarketingPlan(
    projectId: string
  ): Promise<{ revision: number; value: unknown } | null>;
};

function buildIdempotencyKey(parts: {
  projectId: string;
  briefRevisionId: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}): string {
  const raw = [
    "mkt",
    parts.projectId,
    parts.briefRevisionId,
    parts.model,
    parts.promptVersion,
    parts.schemaVersion,
  ].join(":");
  return raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
}

function buildFingerprint(parts: {
  projectId: string;
  briefArtifactId: string;
  briefRevision: number;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}): string {
  return createHash("sha256")
    .update(
      [
        parts.projectId,
        parts.briefArtifactId,
        String(parts.briefRevision),
        parts.model,
        parts.promptVersion,
        parts.schemaVersion,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 64);
}

export function mapMarketingPlanView(
  plan: MarketingPlan,
  revision: number,
  warnings: PublicWarning[] = []
): MarketingPlanView {
  return {
    revision,
    status: "ready",
    objective: plan.marketingObjective,
    audience: plan.primaryAudience.label,
    mainProblem: plan.mainProblem,
    mainBenefit: plan.mainBenefit,
    uniqueSellingPoint: plan.uniqueSellingPoint,
    emotionalHook: plan.emotionalHook,
    callToAction: plan.callToAction,
    keyMessages: [...plan.keyMessages],
    successMetric: `${plan.successMetric.kind}: ${plan.successMetric.description}`,
    assumptions: plan.assumptions.map((a) => a.statement),
    warnings,
  };
}

function mapStoredPlan(value: unknown, revision: number): MarketingPlanView | undefined {
  if (!value || typeof value !== "object") return undefined;
  const p = value as Partial<MarketingPlan>;
  if (!p.marketingObjective || !p.primaryAudience || !p.mainBenefit) return undefined;
  try {
    return mapMarketingPlanView(p as MarketingPlan, revision);
  } catch {
    return {
      revision,
      status: "ready",
      objective: String(p.marketingObjective),
      audience:
        typeof p.primaryAudience === "object" && p.primaryAudience
          ? String((p.primaryAudience as { label?: string }).label ?? "")
          : undefined,
      mainBenefit: p.mainBenefit ? String(p.mainBenefit) : undefined,
      warnings: [],
    };
  }
}

export type AnalyzeMarketingForProjectDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  directorRuns: MarketingDirectorRunPort;
  /** Injected analyzer — tests use fake; production wires OpenAI adapter. Never a silent fake in prod. */
  analyzer: MarketingAnalyzerPort;
  pricing?: AiTokenPricingPort;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
};

export type AnalyzeMarketingForProject = {
  dryRun(
    input: MarketingProjectAnalysisInput,
    context: DirectorRunContext
  ): Promise<MarketingProjectDryRunResult>;
  execute(
    input: MarketingProjectAnalysisInput,
    context: DirectorRunContext
  ): Promise<MarketingProjectAnalysisResult>;
};

async function loadActiveBrief(
  artifacts: ArtifactRepository,
  projectId: string
): Promise<{ brief: VideoProjectBrief; artifactId: string; revision: number } | null> {
  const active = await artifacts.getActive(projectId, "video_project_brief");
  if (!active) return null;
  const art = await artifacts.load(active.artifactId);
  if (!art) return null;
  const parsed = VideoProjectBriefSchema.safeParse(art.value);
  if (!parsed.success) return null;
  return {
    brief: parsed.data,
    artifactId: active.artifactId,
    revision: active.revision,
  };
}

export function createAnalyzeMarketingForProject(
  deps: AnalyzeMarketingForProjectDeps
): AnalyzeMarketingForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const idFactory = deps.idFactory ?? (() => randomUUID());

  return {
    async dryRun(input, _context) {
      void _context;
      if (!canUseDirectorV2Persistence(env)) {
        return {
          executable: false,
          providerCalled: false,
          executionAvailable: false,
          briefRevision: 0,
          briefArtifactId: "",
          model: DEFAULT_OPENAI_MARKETING_MODEL,
          promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
          schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
          pricingConfigured: false,
          validations: [
            {
              code: "persistence",
              passed: false,
              message: "Persistance Director désactivée.",
            },
          ],
          warnings: [],
          missingInformation: [],
        };
      }

      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return {
          executable: false,
          providerCalled: false,
          executionAvailable: false,
          briefRevision: 0,
          briefArtifactId: "",
          model: DEFAULT_OPENAI_MARKETING_MODEL,
          promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
          schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
          pricingConfigured: false,
          validations: [
            { code: "project", passed: false, message: "Projet introuvable." },
          ],
          warnings: [],
          missingInformation: [],
        };
      }

      const loaded = await loadActiveBrief(deps.artifacts, input.projectId);
      if (!loaded) {
        return {
          executable: false,
          providerCalled: false,
          executionAvailable: false,
          briefRevision: 0,
          briefArtifactId: "",
          model: DEFAULT_OPENAI_MARKETING_MODEL,
          promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
          schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
          pricingConfigured: false,
          validations: [
            { code: "brief", passed: false, message: "Brief actif introuvable." },
          ],
          warnings: [],
          missingInformation: [
            { code: "brief_missing", message: "Brief actif introuvable." },
          ],
        };
      }

      const aiDry = runOpenAIMarketingDryRun(loaded.brief, {
        env,
        pricing: deps.pricing,
      });

      const existing = await deps.directorRuns.loadActiveMarketingPlan(input.projectId);
      const existingPlan = existing
        ? mapStoredPlan(existing.value, existing.revision)
        : undefined;

      const e2e = isDirectorE2eFakeMode(env);
      const readiness = assessMarketingBriefReadiness(loaded.brief);
      const domainExecutable = e2e ? readiness.executable : aiDry.executable;
      const executionAvailable = textDirectorExecutionAvailable({
        env,
        domainExecutable,
        paidPathAvailable: canExecuteMarketingAi(env),
        pricingConfigured: aiDry.pricingConfigured,
      });

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
        executable: domainExecutable,
        providerCalled: false,
        executionAvailable,
        briefRevision: loaded.revision,
        briefArtifactId: loaded.artifactId,
        model: e2e ? e2eFakeOpenAiConfig().model : aiDry.model,
        promptVersion: aiDry.promptVersion,
        schemaVersion: aiDry.schemaVersion,
        pricingConfigured: e2e ? true : aiDry.pricingConfigured,
        estimatedCostMinor,
        currency,
        confidence,
        validations: aiDry.validations,
        warnings: aiDry.warnings.map((w) => ({ code: w.code, message: w.message })),
        missingInformation: aiDry.validations
          .filter((v) => !v.passed)
          .map((v) => ({ code: v.code, message: v.message })),
        existingPlan,
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
      if (
        !e2e &&
        (!isDirectorV2MarketingAiEnabled(env) || !isDirectorV2PaidAiEnabled(env))
      ) {
        return failedAnalysis(
          "marketing_ai_disabled",
          "Analyse Marketing IA désactivée.",
          503
        );
      }

      let config;
      if (e2e) {
        config = e2eFakeOpenAiConfig();
      } else {
        try {
          config = parseOpenAIMarketingConfig(env);
        } catch {
          return failedAnalysis(
            "invalid_config",
            "Configuration Marketing IA invalide.",
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

      const loaded = await loadActiveBrief(deps.artifacts, input.projectId);
      if (!loaded) {
        return failedAnalysis(
          "brief_missing",
          "Brief actif introuvable.",
          422
        );
      }
      if (
        input.expectedBriefRevision != null &&
        input.expectedBriefRevision !== loaded.revision
      ) {
        return failedAnalysis(
          "brief_revision_conflict",
          "Le brief a changé depuis la vérification.",
          409
        );
      }

      const aiDry = runOpenAIMarketingDryRun(loaded.brief, {
        env,
        pricing: deps.pricing,
      });
      if (e2e) {
        const readiness = assessMarketingBriefReadiness(loaded.brief);
        if (!readiness.executable) {
          return {
            status: "needs_input",
            missingInformation: [
              {
                code: "marketing_readiness",
                message: "Brief Marketing non prêt.",
              },
            ],
            warnings: [],
          };
        }
      } else if (!aiDry.executable) {
        return {
          status: "needs_input",
          missingInformation: aiDry.validations
            .filter((v) => !v.passed)
            .map((v) => ({ code: v.code, message: v.message })),
          warnings: aiDry.warnings.map((w) => ({
            code: w.code,
            message: w.message,
          })),
        };
      }
      if (!e2e && !aiDry.pricingConfigured && config.requireFirmPricing) {
        return failedAnalysis(
          "pricing_unknown",
          "Tarification indisponible pour un appel payant.",
          402
        );
      }

      let estimatedCostMinor = 1; // floor reservation when pricing unknown but allowed
      let currency = "USD";
      if (deps.pricing) {
        const book = deps.pricing.getPriceBook(config.model);
        if (book) {
          const inTok = aiDry.approximateInputTokens ?? 500;
          estimatedCostMinor = Math.max(
            1,
            Math.floor((inTok * book.inputPerMillionMinor) / 1_000_000) +
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
      }

      const idempotencyKey = buildIdempotencyKey({
        projectId: input.projectId,
        briefRevisionId: loaded.brief.id,
        model: config.model,
        promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
        schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
      });
      const fingerprint = buildFingerprint({
        projectId: input.projectId,
        briefArtifactId: loaded.artifactId,
        briefRevision: loaded.revision,
        model: config.model,
        promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
        schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
      });

      const runId = idFactory();
      let begin;
      try {
        begin = await deps.directorRuns.beginOrGet({
          id: runId,
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          inputArtifactId: loaded.artifactId,
          inputRevision: loaded.revision,
          modelId: config.model,
          promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
          schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
          idempotencyKey,
          commandFingerprint: fingerprint,
          correlationId: context.correlationId,
          estimatedCostMinor,
          currency,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (/fingerprint/i.test(msg)) {
          return failedAnalysis(
            "idempotency_conflict",
            MARKETING_FAILURE_PUBLIC_MESSAGES.idempotency_conflict,
            409
          );
        }
        if (/brief_revision/i.test(msg)) {
          return failedAnalysis(
            "brief_revision_conflict",
            "Le brief actif a changé.",
            409
          );
        }
        return failedAnalysis(
          "director_run_failed",
          "Impossible de démarrer l’analyse.",
          503
        );
      }

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Une analyse marketing est déjà en cours.",
        };
      }

      if (begin.status === "existing") {
        const art = await deps.artifacts.load(begin.outputArtifactId);
        const view = art
          ? mapStoredPlan(art.value, art.revision)
          : undefined;
        if (view) {
          return {
            status: "existing",
            plan: view,
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
          attemptId: "marketing-1",
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
          402
        );
      }

      // After reserve, revision bumped once in RPC
      const revisionAfterReserve = runRevision + 1;

      const director = createMarketingDirector({ analyzer: deps.analyzer });
      const artifactId = idFactory();
      const result = await director.run(
        { brief: loaded.brief },
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
          missingInformation: result.missingInformation.map((m) => ({
            code: m.code,
            message: m.message,
            field: m.field,
          })),
          warnings: result.warnings.map((w) => ({
            code: w.code,
            message: w.message,
          })),
          directorRunId,
        };
      }

      if (result.status === "provider_failed") {
        const failure = result.failure;
        await deps.directorRuns.failRun({
          directorRunId,
          workspaceId: deps.workspaceId,
          expectedRevision: revisionAfterReserve,
          errorCode: failure.code,
          status: "failed",
          reservationId,
          correlationId: context.correlationId,
        });
        const httpHint = httpStatusForMarketingFailure(failure.code);
        // provider_failed never uses 202 (reserved for already_running)
        const safeHint =
          httpHint === 202 ? 500 : httpHint;
        return failedAnalysis(
          failure.code,
          failure.publicMessage,
          safeHint,
          {
            retryable: failure.retryable,
            retryAfterSeconds: failure.retryAfterSeconds,
            provider: failure.provider,
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

      // completed
      try {
        const persisted = await deps.directorRuns.persistPlan({
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          directorRunId,
          artifactId,
          briefArtifactId: loaded.artifactId,
          briefRevision: loaded.revision,
          plan: { ...result.plan } as unknown as Record<string, unknown>,
          schemaVersion: MARKETING_PLAN_SCHEMA_VERSION,
          correlationId: context.correlationId,
          reservationId,
          actualCostMinor: estimatedCostMinor,
          // Ledger CHECK refuse "unknown" — en E2E fake (sans price book) on commit synthétique.
          costStatus: e2e || aiDry.pricingConfigured ? "committed" : "provisional",
          expectedRunRevision: revisionAfterReserve,
          ledgerIdempotencyKey: `dir-commit-${directorRunId}`,
        });
        return {
          status: persisted.status === "existing" ? "existing" : "completed",
          plan: mapMarketingPlanView(
            result.plan,
            persisted.revision,
            result.warnings.map((w) => ({ code: w.code, message: w.message }))
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
          "L’analyse a peut‑être été produite mais la persistance a échoué. Réessayez avec la même clé d’idempotence.",
          503,
          { directorRunId }
        );
      }
    },
  };
}

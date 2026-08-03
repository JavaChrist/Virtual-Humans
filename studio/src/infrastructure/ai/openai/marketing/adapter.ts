/**
 * OpenAI MarketingAnalyzerPort adapter (VHS-117A).
 * Returns untrusted MarketingAnalysisCandidate — never finalizes MarketingPlan.
 */

import type {
  MarketingAnalysisRequest,
  MarketingAnalyzerPort,
} from "@/application/directors/marketing";
import type { MarketingAnalysisCandidate } from "@/domain/marketing";
import type { DirectorRunContext } from "@/application/directors/marketing/result";
import {
  canExecuteMarketingAi,
  isDirectorV2MarketingAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import { logger } from "@/infrastructure/observability";
import type { OpenAIResponsesClientPort } from "../contracts";
import {
  parseOpenAIMarketingConfig,
  type OpenAIMarketingConfig,
} from "../config";
import { OpenAIAiError } from "../errors";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { usageConsistencyWarning } from "../usage";
import { toMarketingAnalyzerError } from "./map-to-analyzer-failure";
import { parseMarketingCandidateResponse } from "./parser";
import {
  createEnvAiTokenPricing,
  createUnknownAiTokenPricing,
  quoteAiUsageCost,
  type AiTokenPricingPort,
} from "./pricing";
import {
  MARKETING_ANALYZER_PROMPT_VERSION,
  MARKETING_ANALYZER_SYSTEM_PROMPT,
} from "./prompt";
import { mapMarketingAnalysisRequest } from "./request-mapper";
import {
  MARKETING_CANDIDATE_SCHEMA_VERSION,
  getMarketingCandidateTextFormat,
} from "./response-schema";

export type OpenAIMarketingAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAIMarketingConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
  nowMs?: () => number;
};

export class OpenAIMarketingAnalyzerAdapter implements MarketingAnalyzerPort {
  private readonly client: OpenAIResponsesClientPort;
  private readonly config: OpenAIMarketingConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;
  private readonly nowMs: () => number;

  constructor(deps: OpenAIMarketingAnalyzerDeps) {
    this.client = deps.client;
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAIMarketingConfig(this.env);
    this.pricing =
      deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env)
        : createUnknownAiTokenPricing());
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  async analyze(
    request: MarketingAnalysisRequest,
    context: DirectorRunContext
  ): Promise<MarketingAnalysisCandidate> {
    const started = this.nowMs();
    const logCtx = {
      correlationId: context.correlationId,
      operation: "marketing.ai.request",
      route: "openai.marketing.analyzer",
    };

    logger.info("marketing.ai.request.started", logCtx, {
      model: this.config.model,
      promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
      schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
      mode: context.mode,
    });

    try {
      if (!isDirectorV2MarketingAiEnabled(this.env)) {
        throw new OpenAIAiError("marketing_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) {
        throw new OpenAIAiError("paid_ai_disabled");
      }
      if (!canExecuteMarketingAi(this.env)) {
        throw new OpenAIAiError("marketing_ai_disabled");
      }
      if (!this.config.apiKeyPresent) {
        throw new OpenAIAiError("openai_not_configured");
      }

      const priceBook = this.pricing.getPriceBook(this.config.model);
      if (this.config.requireFirmPricing && !priceBook) {
        throw new OpenAIAiError("pricing_unknown");
      }

      const mapped = mapMarketingAnalysisRequest({
        brief: request.brief,
        locale: request.locale,
      });
      if (mapped.blockingFindings.length > 0) {
        throw new OpenAIAiError("prompt_injection_detected", {
          internalCode: mapped.blockingFindings[0]?.code,
        });
      }

      const safetyIdentifier = deriveSafetyIdentifier({
        workspaceId: this.config.workspaceId,
        secret: this.config.safetyIdentifierSecret,
      });

      const result = await this.client.create(
        {
          model: this.config.model,
          instructions: MARKETING_ANALYZER_SYSTEM_PROMPT,
          input: mapped.userMessage,
          store: false,
          maxOutputTokens: this.config.maxOutputTokens,
          reasoningEffort: this.config.reasoningEffort,
          textFormat: getMarketingCandidateTextFormat(),
          safetyIdentifier,
        },
        {
          correlationId: context.correlationId,
          timeoutMs: this.config.timeoutMs,
        }
      );

      if (result.refusal?.trim()) {
        logger.info("marketing.ai.request.refused", logCtx, {
          model: this.config.model,
          promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
          schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
          durationMs: this.nowMs() - started,
        });
        throw new OpenAIAiError("refused");
      }

      const candidate = parseMarketingCandidateResponse(result);
      const usage = result.usage;
      const consistency = usage ? usageConsistencyWarning(usage) : undefined;
      const cost = quoteAiUsageCost(this.config.model, usage, this.pricing);

      logger.info("marketing.ai.request.completed", logCtx, {
        model: this.config.model,
        promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
        schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
        durationMs: this.nowMs() - started,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens,
        costStatus: cost.status,
        costMinor: cost.status === "known" ? cost.total.amountMinor : undefined,
        usageWarning: consistency,
      });

      return candidate;
    } catch (e) {
      const openaiErr =
        e instanceof OpenAIAiError
          ? e
          : new OpenAIAiError("unknown", { internalCode: "adapter" });
      const analyzerErr = toMarketingAnalyzerError(openaiErr);
      logger.info("marketing.ai.request.failed", logCtx, {
        model: this.config.model,
        promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
        schemaVersion: MARKETING_CANDIDATE_SCHEMA_VERSION,
        durationMs: this.nowMs() - started,
        // Canonical application failure code (preserves rate_limited, etc.)
        failureCode: analyzerErr.failure.code,
        code: analyzerErr.failure.code,
        retryable: analyzerErr.failure.retryable,
        provider: analyzerErr.failure.provider,
        httpStatus: analyzerErr.failure.httpStatus,
      });
      throw analyzerErr;
    }
  }
}

export function createOpenAIMarketingAnalyzerAdapter(
  deps: OpenAIMarketingAnalyzerDeps
): MarketingAnalyzerPort {
  return new OpenAIMarketingAnalyzerAdapter(deps);
}

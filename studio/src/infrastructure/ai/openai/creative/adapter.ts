/**
 * OpenAI CreativeAnalyzerPort adapter (VHS-118A).
 * Returns untrusted CreativeAnalysisCandidate — never finalizes CreativeConcept.
 */

import type {
  CreativeAnalysisRequest,
  CreativeAnalyzerOutcome,
  CreativeAnalyzerPort,
} from "@/application/directors/creative";
import type { DirectorRunContext } from "@/application/directors/creative/result";
import {
  canExecuteCreativeAi,
  isDirectorV2CreativeAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import { logger } from "@/infrastructure/observability";
import type { OpenAIResponsesClientPort } from "../contracts";
import {
  parseOpenAICreativeConfig,
  type OpenAICreativeConfig,
} from "../config";
import { OpenAIAiError } from "../errors";
import { buildAnalyzerMetering } from "../build-analyzer-metering";
import { toAnalyzerError } from "../map-to-analyzer-failure";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { usageConsistencyWarning } from "../usage";
import {
  createEnvAiTokenPricing,
  createUnknownAiTokenPricing,
  type AiTokenPricingPort,
} from "../marketing/pricing";
import { parseCreativeCandidateResponse } from "./parser";
import {
  CREATIVE_ANALYZER_PROMPT_VERSION,
  CREATIVE_ANALYZER_SYSTEM_PROMPT,
} from "./prompt";
import { mapCreativeAnalysisRequest } from "./mapping";
import {
  CREATIVE_CANDIDATE_SCHEMA_VERSION,
  getCreativeCandidateTextFormat,
} from "./schema";

export type OpenAICreativeAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAICreativeConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
  nowMs?: () => number;
};

export class OpenAICreativeAnalyzerAdapter implements CreativeAnalyzerPort {
  private readonly client: OpenAIResponsesClientPort;
  private readonly config: OpenAICreativeConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;
  private readonly nowMs: () => number;

  constructor(deps: OpenAICreativeAnalyzerDeps) {
    this.client = deps.client;
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAICreativeConfig(this.env);
    this.pricing =
      deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env)
        : createUnknownAiTokenPricing());
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  async analyze(
    request: CreativeAnalysisRequest,
    context: DirectorRunContext
  ): Promise<CreativeAnalyzerOutcome> {
    const started = this.nowMs();
    const logCtx = {
      correlationId: context.correlationId,
      operation: "creative.ai.request",
      route: "openai.creative.analyzer",
      projectId: request.brief.projectId,
    };

    logger.info("creative.ai.request.started", logCtx, {
      model: this.config.model,
      promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
      schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
      mode: context.mode,
    });

    try {
      if (!isDirectorV2CreativeAiEnabled(this.env)) {
        throw new OpenAIAiError("creative_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) {
        throw new OpenAIAiError("paid_ai_disabled");
      }
      if (!canExecuteCreativeAi(this.env)) {
        throw new OpenAIAiError("creative_ai_disabled");
      }
      if (!this.config.apiKeyPresent) {
        throw new OpenAIAiError("openai_not_configured");
      }

      const priceBook = this.pricing.getPriceBook(this.config.model);
      if (this.config.requireFirmPricing && !priceBook) {
        throw new OpenAIAiError("pricing_unknown");
      }

      const mapped = mapCreativeAnalysisRequest({
        brief: request.brief,
        marketingPlan: request.marketingPlan,
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
          instructions: CREATIVE_ANALYZER_SYSTEM_PROMPT,
          input: mapped.userMessage,
          store: false,
          maxOutputTokens: this.config.maxOutputTokens,
          reasoningEffort: this.config.reasoningEffort,
          textFormat: getCreativeCandidateTextFormat(),
          safetyIdentifier,
        },
        {
          correlationId: context.correlationId,
          timeoutMs: this.config.timeoutMs,
        }
      );

      if (result.refusal?.trim()) {
        logger.info("creative.ai.request.refused", logCtx, {
          model: this.config.model,
          promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
          schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
          durationMs: this.nowMs() - started,
        });
        throw new OpenAIAiError("refused");
      }

      const usage = result.usage;
      const consistency = usage ? usageConsistencyWarning(usage) : undefined;
      const metering = buildAnalyzerMetering({
        model: this.config.model,
        usage,
        pricing: this.pricing,
      });

      let candidate;
      try {
        candidate = parseCreativeCandidateResponse(result);
      } catch (parseErr) {
        throw toAnalyzerError(parseErr, { metering });
      }

      logger.info("creative.ai.request.completed", logCtx, {
        model: this.config.model,
        promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
        schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
        durationMs: this.nowMs() - started,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens,
        costStatus: metering.cost.status,
        costMinor:
          metering.cost.status === "known"
            ? metering.cost.amountMinor
            : undefined,
        usageWarning: consistency,
      });

      return { candidate, metering };
    } catch (e) {
      const openaiErr =
        e instanceof OpenAIAiError
          ? e
          : new OpenAIAiError("unknown", { internalCode: "adapter" });
      const analyzerErr = toAnalyzerError(openaiErr);
      logger.info("creative.ai.request.failed", logCtx, {
        model: this.config.model,
        promptVersion: CREATIVE_ANALYZER_PROMPT_VERSION,
        schemaVersion: CREATIVE_CANDIDATE_SCHEMA_VERSION,
        durationMs: this.nowMs() - started,
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

export function createOpenAICreativeAnalyzerAdapter(
  deps: OpenAICreativeAnalyzerDeps
): CreativeAnalyzerPort {
  return new OpenAICreativeAnalyzerAdapter(deps);
}

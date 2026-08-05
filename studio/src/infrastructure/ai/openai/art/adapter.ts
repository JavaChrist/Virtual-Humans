import type {
  ArtAnalysisRequest,
  ArtAnalyzerOutcome,
  ArtAnalyzerPort,
} from "@/application/directors/art";
import type { DirectorRunContext } from "@/application/directors/art/result";
import {
  canExecuteArtAi,
  isDirectorV2ArtAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import { logger } from "@/infrastructure/observability";
import type { OpenAIResponsesClientPort } from "../contracts";
import { parseOpenAIArtConfig, type OpenAIArtConfig } from "../config";
import { OpenAIAiError } from "../errors";
import { buildAnalyzerMetering } from "../build-analyzer-metering";
import { toAnalyzerError } from "../map-to-analyzer-failure";
import {
  createEnvAiTokenPricing,
  createUnknownAiTokenPricing,
  type AiTokenPricingPort,
} from "../marketing/pricing";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { usageConsistencyWarning } from "../usage";
import { mapArtAnalysisRequest } from "./mapping";
import { parseArtCandidateResponse } from "./parser";
import {
  ART_ANALYZER_PROMPT_VERSION,
  ART_ANALYZER_SYSTEM_PROMPT,
} from "./prompt";
import {
  getArtCandidateTextFormat,
  ART_CANDIDATE_SCHEMA_VERSION,
} from "./schema";

export type OpenAIArtAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAIArtConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
  nowMs?: () => number;
};

/** One independent Responses request; ArtDirector owns validation and finalization. */
export class OpenAIArtAnalyzerAdapter implements ArtAnalyzerPort {
  private readonly client: OpenAIResponsesClientPort;
  private readonly config: OpenAIArtConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;
  private readonly nowMs: () => number;

  constructor(deps: OpenAIArtAnalyzerDeps) {
    this.client = deps.client;
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAIArtConfig(this.env);
    this.pricing =
      deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env)
        : createUnknownAiTokenPricing());
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  async analyze(
    request: ArtAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<ArtAnalyzerOutcome> {
    const started = this.nowMs();
    const logCtx = {
      correlationId: context.correlationId,
      operation: "art.ai.request",
      route: "openai.art.analyzer",
    };

    logger.info("art.ai.request.started", logCtx, {
      model: this.config.model,
      promptVersion: ART_ANALYZER_PROMPT_VERSION,
      schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
      mode: context.mode,
    });

    try {
      if (!isDirectorV2ArtAiEnabled(this.env) || !canExecuteArtAi(this.env)) {
        throw new OpenAIAiError("art_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) {
        throw new OpenAIAiError("paid_ai_disabled");
      }
      if (!this.config.apiKeyPresent) throw new OpenAIAiError("openai_not_configured");
      if (this.config.requireFirmPricing && !this.pricing.getPriceBook(this.config.model)) {
        throw new OpenAIAiError("pricing_unknown");
      }
      const mapped = mapArtAnalysisRequest(request);
      if (mapped.blockingFindings.length) {
        throw new OpenAIAiError("prompt_injection_detected", {
          internalCode: mapped.blockingFindings[0]?.code,
        });
      }
      const result = await this.client.create(
        {
          model: this.config.model,
          instructions: ART_ANALYZER_SYSTEM_PROMPT,
          input: mapped.userMessage,
          store: false,
          maxOutputTokens: this.config.maxOutputTokens,
          reasoningEffort: this.config.reasoningEffort,
          textFormat: getArtCandidateTextFormat(),
          safetyIdentifier: deriveSafetyIdentifier({
            workspaceId: this.config.workspaceId,
            secret: this.config.safetyIdentifierSecret,
          }),
        },
        { correlationId: context.correlationId, timeoutMs: this.config.timeoutMs },
      );

      if (result.refusal?.trim()) {
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
        candidate = parseArtCandidateResponse(result);
      } catch (parseErr) {
        throw toAnalyzerError(parseErr, { metering });
      }

      logger.info("art.ai.request.completed", logCtx, {
        model: this.config.model,
        promptVersion: ART_ANALYZER_PROMPT_VERSION,
        schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
        durationMs: this.nowMs() - started,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens,
        costStatus: metering.cost.status,
        costMinor:
          metering.cost.status === "known" ? metering.cost.amountMinor : undefined,
        usageWarning: consistency,
      });

      return { candidate, metering };
    } catch (e) {
      const openaiErr =
        e instanceof OpenAIAiError
          ? e
          : new OpenAIAiError("unknown", { internalCode: "adapter" });
      const analyzerErr = toAnalyzerError(openaiErr);
      logger.info("art.ai.request.failed", logCtx, {
        model: this.config.model,
        promptVersion: ART_ANALYZER_PROMPT_VERSION,
        schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
        durationMs: this.nowMs() - started,
        failureCode: analyzerErr.failure.code,
        retryable: analyzerErr.failure.retryable,
      });
      throw analyzerErr;
    }
  }
}

export function createOpenAIArtAnalyzerAdapter(
  deps: OpenAIArtAnalyzerDeps,
): ArtAnalyzerPort {
  return new OpenAIArtAnalyzerAdapter(deps);
}

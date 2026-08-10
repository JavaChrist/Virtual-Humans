import type {
  StoryboardAnalysisRequest,
  StoryboardAnalyzerOutcome,
  StoryboardAnalyzerPort,
} from "@/application/directors/storyboard";
import type { DirectorRunContext } from "@/application/directors/storyboard/result";
import { MarketingAnalyzerError } from "@/application/directors/marketing/failures";
import {
  canExecuteStoryboardAi,
  isDirectorV2StoryboardAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import { logger } from "@/infrastructure/observability";
import type { OpenAIResponsesClientPort } from "../contracts";
import { parseOpenAIStoryboardConfig, type OpenAIStoryboardConfig } from "../config";
import { OpenAIAiError, isOpenAIAiError } from "../errors";
import { buildAnalyzerMetering } from "../build-analyzer-metering";
import { toAnalyzerError } from "../map-to-analyzer-failure";
import {
  createEnvAiTokenPricing,
  createUnknownAiTokenPricing,
  type AiTokenPricingPort,
} from "../marketing/pricing";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { usageConsistencyWarning } from "../usage";
import { mapStoryboardAnalysisRequest } from "./mapping";
import { parseStoryboardCandidateResponse } from "./parser";
import {
  STORYBOARD_ANALYZER_PROMPT_VERSION,
  STORYBOARD_ANALYZER_SYSTEM_PROMPT,
} from "./prompt";
import {
  getStoryboardCandidateTextFormat,
  STORYBOARD_CANDIDATE_SCHEMA_VERSION,
} from "./schema";
import {
  buildStoryboardProviderFailureEvidence,
  inferStoryboardFailureStage,
} from "./provider-failure-evidence";

export type OpenAIStoryboardAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAIStoryboardConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
  nowMs?: () => number;
};

/** One independent Responses request; StoryboardDirector owns validation and authoritative timing. */
export class OpenAIStoryboardAnalyzerAdapter implements StoryboardAnalyzerPort {
  private readonly client: OpenAIResponsesClientPort;
  private readonly config: OpenAIStoryboardConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;
  private readonly nowMs: () => number;

  constructor(deps: OpenAIStoryboardAnalyzerDeps) {
    this.client = deps.client;
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAIStoryboardConfig(this.env);
    this.pricing =
      deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env)
        : createUnknownAiTokenPricing());
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  async analyze(
    request: StoryboardAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<StoryboardAnalyzerOutcome> {
    const started = this.nowMs();
    const logCtx = {
      correlationId: context.correlationId,
      operation: "storyboard.ai.request",
      route: "openai.storyboard.analyzer",
    };

    logger.info("storyboard.ai.request.started", logCtx, {
      model: this.config.model,
      promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
      schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
      mode: context.mode,
    });

    let networkAttempts = 0;
    try {
      if (!isDirectorV2StoryboardAiEnabled(this.env) || !canExecuteStoryboardAi(this.env)) {
        throw new OpenAIAiError("storyboard_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) {
        throw new OpenAIAiError("paid_ai_disabled");
      }
      if (!this.config.apiKeyPresent) throw new OpenAIAiError("openai_not_configured");
      if (this.config.requireFirmPricing && !this.pricing.getPriceBook(this.config.model)) {
        throw new OpenAIAiError("pricing_unknown");
      }
      const mapped = mapStoryboardAnalysisRequest(request);
      if (mapped.blockingFindings.length) {
        throw new OpenAIAiError("prompt_injection_detected", {
          internalCode: mapped.blockingFindings[0]?.code,
        });
      }
      networkAttempts = 1;
      const result = await this.client.create(
        {
          model: this.config.model,
          instructions: STORYBOARD_ANALYZER_SYSTEM_PROMPT,
          input: mapped.userMessage,
          store: false,
          maxOutputTokens: this.config.maxOutputTokens,
          reasoningEffort: this.config.reasoningEffort,
          textFormat: getStoryboardCandidateTextFormat(),
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
        candidate = parseStoryboardCandidateResponse(result);
      } catch (parseErr) {
        throw toAnalyzerError(parseErr, {
          metering,
          failureStage: "candidate_parse",
          networkAttempts,
          durationMs: this.nowMs() - started,
          usagePresent: Boolean(usage),
        });
      }

      logger.info("storyboard.ai.request.completed", logCtx, {
        model: this.config.model,
        promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
        schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
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
      const durationMs = this.nowMs() - started;
      const openaiErr = isOpenAIAiError(e) ? e : undefined;
      const stage = openaiErr
        ? inferStoryboardFailureStage(openaiErr, networkAttempts)
        : e instanceof MarketingAnalyzerError
          ? (e.failure.providerMetadata?.failureStage ?? "candidate_parse")
          : "request_build";
      const analyzerErr =
        e instanceof MarketingAnalyzerError
          ? toAnalyzerError(e, {
              metering: e.metering,
              failureStage: stage,
              networkAttempts,
              durationMs,
              usagePresent: Boolean(e.failure.providerMetadata?.usagePresent),
            })
          : toAnalyzerError(openaiErr ?? e, {
              failureStage: stage,
              networkAttempts,
              durationMs,
              usagePresent: false,
            });
      const evidence = buildStoryboardProviderFailureEvidence({
        stage: analyzerErr.failure.providerMetadata?.failureStage ?? stage,
        vhsFailureCode: analyzerErr.failure.code,
        openaiErr,
        durationMs,
        networkAttempts,
        usagePresent: analyzerErr.failure.providerMetadata?.usagePresent,
      });
      logger.info("storyboard.ai.request.failed", logCtx, {
        model: this.config.model,
        promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
        schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
        durationMs: evidence.durationMs,
        failureCode: analyzerErr.failure.code,
        retryable: analyzerErr.failure.retryable,
        httpStatus: analyzerErr.failure.httpStatus,
        internalCode: analyzerErr.failure.internalCode,
        openaiCode: openaiErr?.code,
        providerErrorCode: evidence.providerErrorCode,
        providerErrorType: evidence.providerErrorType,
        providerRequestId: evidence.providerRequestId,
        failureStage: evidence.stage,
        networkAttempts: evidence.networkAttempts,
        usagePresent: evidence.usagePresent,
      });
      throw analyzerErr;
    }
  }
}

export function createOpenAIStoryboardAnalyzerAdapter(
  deps: OpenAIStoryboardAnalyzerDeps,
): StoryboardAnalyzerPort {
  return new OpenAIStoryboardAnalyzerAdapter(deps);
}

import type {
  ScriptAnalysisRequest,
  ScriptAnalyzerOutcome,
  ScriptAnalyzerPort,
} from "@/application/directors/script";
import type { DirectorRunContext } from "@/application/directors/script/result";
import {
  canExecuteScriptAi,
  isDirectorV2PaidAiEnabled,
  isDirectorV2ScriptAiEnabled,
} from "@/infrastructure/config/feature-flags";
import { logger } from "@/infrastructure/observability";
import type { OpenAIResponsesClientPort } from "../contracts";
import { parseOpenAIScriptConfig, type OpenAIScriptConfig } from "../config";
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
import { mapScriptAnalysisRequest } from "./mapping";
import { parseScriptCandidateResponse } from "./parser";
import {
  SCRIPT_ANALYZER_PROMPT_VERSION,
  SCRIPT_ANALYZER_SYSTEM_PROMPT,
} from "./prompt";
import {
  getScriptCandidateTextFormat,
  SCRIPT_CANDIDATE_SCHEMA_VERSION,
} from "./schema";

export type OpenAIScriptAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAIScriptConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
  nowMs?: () => number;
};

/** One independent Responses request; candidate timing is ignored by ScriptWriter. */
export class OpenAIScriptAnalyzerAdapter implements ScriptAnalyzerPort {
  private readonly client: OpenAIResponsesClientPort;
  private readonly config: OpenAIScriptConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;
  private readonly nowMs: () => number;

  constructor(deps: OpenAIScriptAnalyzerDeps) {
    this.client = deps.client;
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAIScriptConfig(this.env);
    this.pricing =
      deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env)
        : createUnknownAiTokenPricing());
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  async analyze(
    request: ScriptAnalysisRequest,
    context: DirectorRunContext,
  ): Promise<ScriptAnalyzerOutcome> {
    const started = this.nowMs();
    const logCtx = {
      correlationId: context.correlationId,
      operation: "script.ai.request",
      route: "openai.script.analyzer",
    };

    logger.info("script.ai.request.started", logCtx, {
      model: this.config.model,
      promptVersion: SCRIPT_ANALYZER_PROMPT_VERSION,
      schemaVersion: SCRIPT_CANDIDATE_SCHEMA_VERSION,
      mode: context.mode,
    });

    try {
      if (!isDirectorV2ScriptAiEnabled(this.env) || !canExecuteScriptAi(this.env)) {
        throw new OpenAIAiError("script_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) {
        throw new OpenAIAiError("paid_ai_disabled");
      }
      if (!this.config.apiKeyPresent) throw new OpenAIAiError("openai_not_configured");
      if (this.config.requireFirmPricing && !this.pricing.getPriceBook(this.config.model)) {
        throw new OpenAIAiError("pricing_unknown");
      }
      const mapped = mapScriptAnalysisRequest(request);
      if (mapped.blockingFindings.length) {
        throw new OpenAIAiError("prompt_injection_detected", {
          internalCode: mapped.blockingFindings[0]?.code,
        });
      }
      const result = await this.client.create(
        {
          model: this.config.model,
          instructions: SCRIPT_ANALYZER_SYSTEM_PROMPT,
          input: mapped.userMessage,
          store: false,
          maxOutputTokens: this.config.maxOutputTokens,
          reasoningEffort: this.config.reasoningEffort,
          textFormat: getScriptCandidateTextFormat(),
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
        candidate = parseScriptCandidateResponse(result);
      } catch (parseErr) {
        throw toAnalyzerError(parseErr, { metering });
      }

      logger.info("script.ai.request.completed", logCtx, {
        model: this.config.model,
        promptVersion: SCRIPT_ANALYZER_PROMPT_VERSION,
        schemaVersion: SCRIPT_CANDIDATE_SCHEMA_VERSION,
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
      logger.info("script.ai.request.failed", logCtx, {
        model: this.config.model,
        promptVersion: SCRIPT_ANALYZER_PROMPT_VERSION,
        schemaVersion: SCRIPT_CANDIDATE_SCHEMA_VERSION,
        durationMs: this.nowMs() - started,
        failureCode: analyzerErr.failure.code,
        retryable: analyzerErr.failure.retryable,
      });
      throw analyzerErr;
    }
  }
}

export function createOpenAIScriptAnalyzerAdapter(
  deps: OpenAIScriptAnalyzerDeps,
): ScriptAnalyzerPort {
  return new OpenAIScriptAnalyzerAdapter(deps);
}

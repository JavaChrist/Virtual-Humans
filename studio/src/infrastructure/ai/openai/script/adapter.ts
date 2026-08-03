import type { ScriptAnalysisRequest, ScriptAnalyzerPort } from "@/application/directors/script";
import type { DirectorRunContext } from "@/application/directors/script/result";
import type { ScriptAnalysisCandidate } from "@/domain/script";
import {
  canExecuteScriptAi,
  isDirectorV2PaidAiEnabled,
  isDirectorV2ScriptAiEnabled,
} from "@/infrastructure/config/feature-flags";
import type { OpenAIResponsesClientPort } from "../contracts";
import { parseOpenAIScriptConfig, type OpenAIScriptConfig } from "../config";
import { OpenAIAiError } from "../errors";
import { toAnalyzerError } from "../map-to-analyzer-failure";
import { createEnvAiTokenPricing, createUnknownAiTokenPricing, type AiTokenPricingPort } from "../marketing/pricing";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { mapScriptAnalysisRequest } from "./mapping";
import { parseScriptCandidateResponse } from "./parser";
import { SCRIPT_ANALYZER_SYSTEM_PROMPT } from "./prompt";
import { getScriptCandidateTextFormat } from "./schema";

export type OpenAIScriptAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAIScriptConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
};

/** One independent Responses request; candidate timing is ignored by ScriptWriter. */
export class OpenAIScriptAnalyzerAdapter implements ScriptAnalyzerPort {
  private readonly config: OpenAIScriptConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;

  constructor(private readonly deps: OpenAIScriptAnalyzerDeps) {
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAIScriptConfig(this.env);
    this.pricing = deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env) : createUnknownAiTokenPricing());
  }

  async analyze(request: ScriptAnalysisRequest, context: DirectorRunContext): Promise<ScriptAnalysisCandidate> {
    try {
      if (!isDirectorV2ScriptAiEnabled(this.env) || !canExecuteScriptAi(this.env)) {
        throw new OpenAIAiError("script_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) throw new OpenAIAiError("paid_ai_disabled");
      if (!this.config.apiKeyPresent) throw new OpenAIAiError("openai_not_configured");
      if (this.config.requireFirmPricing && !this.pricing.getPriceBook(this.config.model)) {
        throw new OpenAIAiError("pricing_unknown");
      }
      const mapped = mapScriptAnalysisRequest(request);
      if (mapped.blockingFindings.length) {
        throw new OpenAIAiError("prompt_injection_detected", { internalCode: mapped.blockingFindings[0]?.code });
      }
      const result = await this.deps.client.create({
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
      }, { correlationId: context.correlationId, timeoutMs: this.config.timeoutMs });
      return parseScriptCandidateResponse(result);
    } catch (error) {
      throw toAnalyzerError(error instanceof OpenAIAiError
        ? error : new OpenAIAiError("unknown", { internalCode: "adapter" }));
    }
  }
}

export function createOpenAIScriptAnalyzerAdapter(deps: OpenAIScriptAnalyzerDeps): ScriptAnalyzerPort {
  return new OpenAIScriptAnalyzerAdapter(deps);
}

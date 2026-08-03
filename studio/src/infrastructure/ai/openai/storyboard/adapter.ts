import type { StoryboardAnalysisRequest, StoryboardAnalyzerPort } from "@/application/directors/storyboard";
import type { DirectorRunContext } from "@/application/directors/storyboard/result";
import type { StoryboardAnalysisCandidate } from "@/domain/storyboard";
import {
  canExecuteStoryboardAi,
  isDirectorV2StoryboardAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import type { OpenAIResponsesClientPort } from "../contracts";
import { parseOpenAIStoryboardConfig, type OpenAIStoryboardConfig } from "../config";
import { OpenAIAiError } from "../errors";
import { toAnalyzerError } from "../map-to-analyzer-failure";
import { createEnvAiTokenPricing, createUnknownAiTokenPricing, type AiTokenPricingPort } from "../marketing/pricing";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { mapStoryboardAnalysisRequest } from "./mapping";
import { parseStoryboardCandidateResponse } from "./parser";
import { STORYBOARD_ANALYZER_SYSTEM_PROMPT } from "./prompt";
import { getStoryboardCandidateTextFormat } from "./schema";

export type OpenAIStoryboardAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAIStoryboardConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
};

/** One independent Responses request; StoryboardDirector owns validation and authoritative timing. */
export class OpenAIStoryboardAnalyzerAdapter implements StoryboardAnalyzerPort {
  private readonly config: OpenAIStoryboardConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;

  constructor(private readonly deps: OpenAIStoryboardAnalyzerDeps) {
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAIStoryboardConfig(this.env);
    this.pricing = deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env) : createUnknownAiTokenPricing());
  }

  async analyze(request: StoryboardAnalysisRequest, context: DirectorRunContext): Promise<StoryboardAnalysisCandidate> {
    try {
      if (!isDirectorV2StoryboardAiEnabled(this.env) || !canExecuteStoryboardAi(this.env)) {
        throw new OpenAIAiError("storyboard_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) throw new OpenAIAiError("paid_ai_disabled");
      if (!this.config.apiKeyPresent) throw new OpenAIAiError("openai_not_configured");
      if (this.config.requireFirmPricing && !this.pricing.getPriceBook(this.config.model)) {
        throw new OpenAIAiError("pricing_unknown");
      }
      const mapped = mapStoryboardAnalysisRequest(request);
      if (mapped.blockingFindings.length) {
        throw new OpenAIAiError("prompt_injection_detected", { internalCode: mapped.blockingFindings[0]?.code });
      }
      const result = await this.deps.client.create({
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
      }, { correlationId: context.correlationId, timeoutMs: this.config.timeoutMs });
      return parseStoryboardCandidateResponse(result);
    } catch (error) {
      throw toAnalyzerError(error instanceof OpenAIAiError
        ? error : new OpenAIAiError("unknown", { internalCode: "adapter" }));
    }
  }
}

export function createOpenAIStoryboardAnalyzerAdapter(deps: OpenAIStoryboardAnalyzerDeps): StoryboardAnalyzerPort {
  return new OpenAIStoryboardAnalyzerAdapter(deps);
}

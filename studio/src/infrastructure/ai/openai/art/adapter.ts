import type { ArtAnalysisRequest, ArtAnalyzerPort } from "@/application/directors/art";
import type { DirectorRunContext } from "@/application/directors/art/result";
import type { ArtAnalysisCandidate } from "@/domain/art";
import {
  canExecuteArtAi,
  isDirectorV2ArtAiEnabled,
  isDirectorV2PaidAiEnabled,
} from "@/infrastructure/config/feature-flags";
import type { OpenAIResponsesClientPort } from "../contracts";
import { parseOpenAIArtConfig, type OpenAIArtConfig } from "../config";
import { OpenAIAiError } from "../errors";
import { toAnalyzerError } from "../map-to-analyzer-failure";
import { createEnvAiTokenPricing, createUnknownAiTokenPricing, type AiTokenPricingPort } from "../marketing/pricing";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { mapArtAnalysisRequest } from "./mapping";
import { parseArtCandidateResponse } from "./parser";
import { ART_ANALYZER_SYSTEM_PROMPT } from "./prompt";
import { getArtCandidateTextFormat } from "./schema";

export type OpenAIArtAnalyzerDeps = {
  client: OpenAIResponsesClientPort;
  config?: OpenAIArtConfig;
  env?: Record<string, string | undefined>;
  pricing?: AiTokenPricingPort;
};

/** One independent Responses request; ArtDirector owns validation and finalization. */
export class OpenAIArtAnalyzerAdapter implements ArtAnalyzerPort {
  private readonly config: OpenAIArtConfig;
  private readonly env: Record<string, string | undefined>;
  private readonly pricing: AiTokenPricingPort;

  constructor(private readonly deps: OpenAIArtAnalyzerDeps) {
    this.env = deps.env ?? (process.env as Record<string, string | undefined>);
    this.config = deps.config ?? parseOpenAIArtConfig(this.env);
    this.pricing = deps.pricing ??
      (createEnvAiTokenPricing(this.env).getPriceBook(this.config.model)
        ? createEnvAiTokenPricing(this.env) : createUnknownAiTokenPricing());
  }

  async analyze(request: ArtAnalysisRequest, context: DirectorRunContext): Promise<ArtAnalysisCandidate> {
    try {
      if (!isDirectorV2ArtAiEnabled(this.env) || !canExecuteArtAi(this.env)) {
        throw new OpenAIAiError("art_ai_disabled");
      }
      if (!isDirectorV2PaidAiEnabled(this.env)) throw new OpenAIAiError("paid_ai_disabled");
      if (!this.config.apiKeyPresent) throw new OpenAIAiError("openai_not_configured");
      if (this.config.requireFirmPricing && !this.pricing.getPriceBook(this.config.model)) {
        throw new OpenAIAiError("pricing_unknown");
      }
      const mapped = mapArtAnalysisRequest(request);
      if (mapped.blockingFindings.length) {
        throw new OpenAIAiError("prompt_injection_detected", { internalCode: mapped.blockingFindings[0]?.code });
      }
      const result = await this.deps.client.create({
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
      }, { correlationId: context.correlationId, timeoutMs: this.config.timeoutMs });
      return parseArtCandidateResponse(result);
    } catch (error) {
      throw toAnalyzerError(error instanceof OpenAIAiError
        ? error : new OpenAIAiError("unknown", { internalCode: "adapter" }));
    }
  }
}

export function createOpenAIArtAnalyzerAdapter(deps: OpenAIArtAnalyzerDeps): ArtAnalyzerPort {
  return new OpenAIArtAnalyzerAdapter(deps);
}

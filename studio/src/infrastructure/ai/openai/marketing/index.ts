/**
 * OpenAI Marketing analyzer adapter (VHS-117A).
 */

export {
  OpenAIMarketingAnalyzerAdapter,
  createOpenAIMarketingAnalyzerAdapter,
  type OpenAIMarketingAnalyzerDeps,
} from "./adapter";
export {
  runOpenAIMarketingDryRun,
  type OpenAIMarketingDryRunResult,
  type OpenAIMarketingDryRunDeps,
} from "./dry-run";
export {
  mapMarketingAnalysisRequest,
  approximateTokenCount,
  type MarketingAnalyzerUserPayload,
} from "./request-mapper";
export {
  MARKETING_ANALYZER_PROMPT_VERSION,
  MARKETING_ANALYZER_SYSTEM_PROMPT,
  assertPromptSafeForLogs,
} from "./prompt";
export {
  MARKETING_CANDIDATE_SCHEMA_NAME,
  MARKETING_CANDIDATE_SCHEMA_VERSION,
  getMarketingCandidateJsonSchema,
  getMarketingCandidateTextFormat,
  marketingCandidateSchemaContract,
} from "./response-schema";
export { parseMarketingCandidateResponse } from "./parser";
export {
  createEnvAiTokenPricing,
  createUnknownAiTokenPricing,
  quoteAiUsageCost,
  type AiTokenPricingPort,
  type AiTokenPriceBook,
  type AiCostQuote,
} from "./pricing";
export {
  mapOpenAIAiErrorToMarketingFailure,
  toMarketingAnalyzerError,
} from "./map-to-analyzer-failure";

/**
 * Re-export shared OpenAI → analyzer failure mapping (VHS-117D / VHS-118A).
 */

export {
  mapOpenAIAiErrorToMarketingFailure,
  mapOpenAIAiErrorToAnalyzerFailure,
  toMarketingAnalyzerError,
  toAnalyzerError,
} from "../map-to-analyzer-failure";

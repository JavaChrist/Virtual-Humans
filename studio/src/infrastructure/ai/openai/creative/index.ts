/**
 * OpenAI Creative analyzer adapter (VHS-118A).
 */

export {
  OpenAICreativeAnalyzerAdapter,
  createOpenAICreativeAnalyzerAdapter,
  type OpenAICreativeAnalyzerDeps,
} from "./adapter";
export {
  runOpenAICreativeDryRun,
  type OpenAICreativeDryRunResult,
  type OpenAICreativeDryRunDeps,
} from "./dry-run";
export {
  mapCreativeAnalysisRequest,
  approximateCreativeTokenCount,
  type CreativeBriefPayload,
  type CreativeMarketingPayload,
} from "./mapping";
export {
  CREATIVE_ANALYZER_PROMPT_VERSION,
  CREATIVE_ANALYZER_SYSTEM_PROMPT,
  assertCreativePromptSafeForLogs,
} from "./prompt";
export {
  CREATIVE_CANDIDATE_SCHEMA_NAME,
  CREATIVE_CANDIDATE_SCHEMA_VERSION,
  applyEmotionalArcMaxBeats,
  getCreativeCandidateJsonSchema,
  getCreativeCandidateTextFormat,
  creativeCandidateSchemaContract,
} from "./schema";
export { parseCreativeCandidateResponse } from "./parser";

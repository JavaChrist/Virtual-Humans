/**
 * Strict JSON Schema for MarketingAnalysisCandidate (VHS-117A).
 */

import { z } from "zod";
import { MarketingAnalysisCandidateSchema } from "@/domain/marketing";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const MARKETING_CANDIDATE_SCHEMA_NAME = "marketing_analysis_candidate";
export const MARKETING_CANDIDATE_SCHEMA_VERSION = "1.0.0";

/** Zod → OpenAI-strict JSON Schema (cached). */
let cached: Record<string, unknown> | null = null;

export function getMarketingCandidateJsonSchema(): Record<string, unknown> {
  if (cached) return cached;
  const zodJson = z.toJSONSchema(MarketingAnalysisCandidateSchema, {
    target: "draft-7",
  }) as Record<string, unknown>;
  cached = toOpenAIStrictJsonSchema(zodJson);
  return cached;
}

export function getMarketingCandidateTextFormat() {
  return {
    type: "json_schema" as const,
    name: MARKETING_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema: getMarketingCandidateJsonSchema(),
  };
}

/** Contract helpers for tests. */
export function marketingCandidateSchemaContract() {
  const schema = getMarketingCandidateJsonSchema();
  return {
    name: MARKETING_CANDIDATE_SCHEMA_NAME,
    version: MARKETING_CANDIDATE_SCHEMA_VERSION,
    schema,
    additionalPropertiesFalse: schema.additionalProperties === false,
    required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
  };
}

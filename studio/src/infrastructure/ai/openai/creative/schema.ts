/**
 * Strict JSON Schema for CreativeAnalysisCandidate (VHS-118A).
 */

import { z } from "zod";
import { CreativeAnalysisCandidateSchema } from "@/domain/creative";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const CREATIVE_CANDIDATE_SCHEMA_NAME = "creative-analysis-candidate-v1";
export const CREATIVE_CANDIDATE_SCHEMA_VERSION = "1.0.0";

let cached: Record<string, unknown> | null = null;

export function getCreativeCandidateJsonSchema(): Record<string, unknown> {
  if (cached) return cached;
  const zodJson = z.toJSONSchema(CreativeAnalysisCandidateSchema, {
    target: "draft-7",
  }) as Record<string, unknown>;
  cached = toOpenAIStrictJsonSchema(zodJson);
  return cached;
}

export function getCreativeCandidateTextFormat() {
  return {
    type: "json_schema" as const,
    name: CREATIVE_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema: getCreativeCandidateJsonSchema(),
  };
}

export function creativeCandidateSchemaContract() {
  const schema = getCreativeCandidateJsonSchema();
  return {
    name: CREATIVE_CANDIDATE_SCHEMA_NAME,
    version: CREATIVE_CANDIDATE_SCHEMA_VERSION,
    schema,
    additionalPropertiesFalse: schema.additionalProperties === false,
    required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
  };
}

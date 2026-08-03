import { z } from "zod";
import { StoryboardAnalysisCandidateSchema } from "@/domain/storyboard";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const STORYBOARD_CANDIDATE_SCHEMA_NAME = "storyboard-analysis-candidate-v1";
export const STORYBOARD_CANDIDATE_SCHEMA_VERSION = "1.0.0";

let cached: Record<string, unknown> | null = null;

export function getStoryboardCandidateJsonSchema(): Record<string, unknown> {
  if (cached) return cached;
  cached = toOpenAIStrictJsonSchema(
    z.toJSONSchema(StoryboardAnalysisCandidateSchema, { target: "draft-7" }) as Record<string, unknown>
  );
  return cached;
}

export function getStoryboardCandidateTextFormat() {
  return {
    type: "json_schema" as const,
    name: STORYBOARD_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema: getStoryboardCandidateJsonSchema(),
  };
}

export function storyboardCandidateSchemaContract() {
  const schema = getStoryboardCandidateJsonSchema();
  return {
    name: STORYBOARD_CANDIDATE_SCHEMA_NAME,
    version: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
    schema,
    additionalPropertiesFalse: schema.additionalProperties === false,
    required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
  };
}

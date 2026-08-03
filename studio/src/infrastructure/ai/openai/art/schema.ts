import { z } from "zod";
import { ArtAnalysisCandidateSchema } from "@/domain/art";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const ART_CANDIDATE_SCHEMA_NAME = "art-analysis-candidate-v1";
export const ART_CANDIDATE_SCHEMA_VERSION = "1.0.0";

let cached: Record<string, unknown> | null = null;

export function getArtCandidateJsonSchema(): Record<string, unknown> {
  if (cached) return cached;
  cached = toOpenAIStrictJsonSchema(
    z.toJSONSchema(ArtAnalysisCandidateSchema, { target: "draft-7" }) as Record<string, unknown>
  );
  return cached;
}

export function getArtCandidateTextFormat() {
  return {
    type: "json_schema" as const,
    name: ART_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema: getArtCandidateJsonSchema(),
  };
}

export function artCandidateSchemaContract() {
  const schema = getArtCandidateJsonSchema();
  return {
    name: ART_CANDIDATE_SCHEMA_NAME,
    version: ART_CANDIDATE_SCHEMA_VERSION,
    schema,
    additionalPropertiesFalse: schema.additionalProperties === false,
    required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
  };
}

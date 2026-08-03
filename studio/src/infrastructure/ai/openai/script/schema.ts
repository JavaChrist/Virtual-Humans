import { z } from "zod";
import { ScriptAnalysisCandidateSchema } from "@/domain/script";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const SCRIPT_CANDIDATE_SCHEMA_NAME = "script-analysis-candidate-v1";
export const SCRIPT_CANDIDATE_SCHEMA_VERSION = "1.0.0";

let cached: Record<string, unknown> | null = null;

export function getScriptCandidateJsonSchema(): Record<string, unknown> {
  if (cached) return cached;
  cached = toOpenAIStrictJsonSchema(
    z.toJSONSchema(ScriptAnalysisCandidateSchema, { target: "draft-7" }) as Record<string, unknown>
  );
  return cached;
}

export function getScriptCandidateTextFormat() {
  return {
    type: "json_schema" as const,
    name: SCRIPT_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema: getScriptCandidateJsonSchema(),
  };
}

export function scriptCandidateSchemaContract() {
  const schema = getScriptCandidateJsonSchema();
  return {
    name: SCRIPT_CANDIDATE_SCHEMA_NAME,
    version: SCRIPT_CANDIDATE_SCHEMA_VERSION,
    schema,
    additionalPropertiesFalse: schema.additionalProperties === false,
    required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
  };
}

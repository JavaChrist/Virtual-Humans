/**
 * Strict JSON Schema for Creative analyzer candidate (VHS-118A / 8H-A).
 * Schema 1.1.0: emotionalArc beats omit derived `order`.
 */

import { z } from "zod";
import {
  CREATIVE_FIELD_LIMITS,
  CreativeAnalyzerCandidateSchema,
  resolveCreativeArcBeatBudget,
} from "@/domain/creative";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const CREATIVE_CANDIDATE_SCHEMA_NAME = "creative-analysis-candidate-v1_1";
export const CREATIVE_CANDIDATE_SCHEMA_VERSION = "1.1.0";

let cached: Record<string, unknown> | null = null;

export function getCreativeCandidateJsonSchema(): Record<string, unknown> {
  if (cached) return cached;
  const zodJson = z.toJSONSchema(CreativeAnalyzerCandidateSchema, {
    target: "draft-7",
  }) as Record<string, unknown>;
  cached = toOpenAIStrictJsonSchema(zodJson);
  return cached;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Cap emotionalArc.maxItems for the brief duration (still ≥ beatsMin).
 * Does not mutate the cached base schema.
 */
export function applyEmotionalArcMaxBeats(
  schema: Record<string, unknown>,
  maxBeats: number,
): Record<string, unknown> {
  const capped = Math.max(
    CREATIVE_FIELD_LIMITS.beatsMin,
    Math.min(maxBeats, CREATIVE_FIELD_LIMITS.beatsMax),
  );
  const next = cloneJson(schema);
  const props = next.properties as Record<string, unknown> | undefined;
  const arc = props?.emotionalArc as Record<string, unknown> | undefined;
  if (arc && typeof arc === "object") {
    arc.maxItems = capped;
    arc.minItems = CREATIVE_FIELD_LIMITS.beatsMin;
  }
  return next;
}

export function getCreativeCandidateTextFormat(opts?: {
  /** Prefer passing the one-shot budget.maxBeats from resolveCreativeArcBeatBudget. */
  maxBeats?: number;
  /** Convenience: derives maxBeats via the same domain resolver (tests / callers). */
  durationSeconds?: number;
}) {
  const base = getCreativeCandidateJsonSchema();
  const maxBeats =
    opts?.maxBeats ??
    (opts?.durationSeconds != null
      ? resolveCreativeArcBeatBudget(opts.durationSeconds).maxBeats
      : undefined);
  const schema =
    maxBeats != null ? applyEmotionalArcMaxBeats(base, maxBeats) : base;
  return {
    type: "json_schema" as const,
    name: CREATIVE_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema,
  };
}

export function creativeCandidateSchemaContract() {
  const schema = getCreativeCandidateJsonSchema();
  const props = (schema.properties ?? {}) as Record<string, unknown>;
  const arc = props.emotionalArc as Record<string, unknown> | undefined;
  const arcItems = arc?.items as Record<string, unknown> | undefined;
  const arcItemProps = (arcItems?.properties ?? {}) as Record<string, unknown>;
  return {
    name: CREATIVE_CANDIDATE_SCHEMA_NAME,
    version: CREATIVE_CANDIDATE_SCHEMA_VERSION,
    schema,
    additionalPropertiesFalse: schema.additionalProperties === false,
    required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
    emotionalArcBeatHasOrder: Object.prototype.hasOwnProperty.call(
      arcItemProps,
      "order",
    ),
  };
}

/**
 * Strict JSON Schema for Creative analyzer candidate (8I-B / v1.2.0).
 * Schema 1.2.0: no beat.order; dynamic array maxItems from run capacities.
 */

import { z } from "zod";
import {
  CREATIVE_FIELD_LIMITS,
  candidateCapsFromRun,
  createCreativeAnalyzerCandidateSchema,
  resolveCreativeArcBeatBudget,
  resolveCreativeRunCapacities,
  type CreativeRunCapacities,
} from "@/domain/creative";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const CREATIVE_CANDIDATE_SCHEMA_NAME = "creative-analysis-candidate-v1_2";
export const CREATIVE_CANDIDATE_SCHEMA_VERSION = "1.2.0";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Cap emotionalArc.maxItems for the brief duration (still ≥ beatsMin).
 * Does not mutate the input schema.
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

function applyArrayMaxItems(
  schema: Record<string, unknown>,
  caps: CreativeRunCapacities,
): Record<string, unknown> {
  const next = cloneJson(schema);
  const props = next.properties as Record<string, unknown> | undefined;
  if (!props) return next;
  const set = (key: string, maxItems: number) => {
    const node = props[key] as Record<string, unknown> | undefined;
    if (node && typeof node === "object") {
      node.maxItems = maxItems;
    }
  };
  set("assumptions", caps.assumptions.candidateMax);
  set("constraints", caps.constraints.candidateMax);
  set("referenceKeywords", caps.referenceKeywords.candidateMax);
  set("claimedEvidence", caps.evidence.candidateMax);
  set("emotionalArc", caps.emotionalArc.maxBeats);
  return next;
}

/** Base JSON schema from Zod factory at ceiling maxima (structure only). */
export function getCreativeCandidateJsonSchema(): Record<string, unknown> {
  const zodJson = z.toJSONSchema(
    createCreativeAnalyzerCandidateSchema({
      assumptionsMax: CREATIVE_FIELD_LIMITS.assumptionsMax,
      constraintsMax: CREATIVE_FIELD_LIMITS.constraintsMax,
      beatsMax: CREATIVE_FIELD_LIMITS.beatsMax,
    }),
    { target: "draft-7" },
  ) as Record<string, unknown>;
  return toOpenAIStrictJsonSchema(zodJson);
}

export function getCreativeCandidateTextFormat(opts?: {
  maxBeats?: number;
  durationSeconds?: number;
  capacities?: CreativeRunCapacities;
}) {
  const base = getCreativeCandidateJsonSchema();
  let schema = base;
  if (opts?.capacities) {
    schema = applyArrayMaxItems(base, opts.capacities);
  } else {
    const maxBeats =
      opts?.maxBeats ??
      (opts?.durationSeconds != null
        ? resolveCreativeArcBeatBudget(opts.durationSeconds).maxBeats
        : undefined);
    if (maxBeats != null) {
      schema = applyEmotionalArcMaxBeats(base, maxBeats);
    }
  }
  return {
    type: "json_schema" as const,
    name: CREATIVE_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema,
  };
}

/** Preferred entry: capacities from brief+plan (single source). */
export function getCreativeCandidateTextFormatForRun(
  capacities: CreativeRunCapacities,
) {
  return getCreativeCandidateTextFormat({ capacities });
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

export function zodAnalyzerSchemaForCapacities(capacities: CreativeRunCapacities) {
  return createCreativeAnalyzerCandidateSchema(candidateCapsFromRun(capacities));
}

export { resolveCreativeRunCapacities };

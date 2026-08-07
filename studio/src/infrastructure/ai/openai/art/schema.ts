/**
 * Strict JSON Schema for Art analyzer candidate.
 *
 * - 1.0.0 / art-analysis-candidate-v1 — static schema (Porte 8O).
 * - 1.1.0 / art-analysis-candidate-v1_1 — Porte 8R: dynamic enums for
 *   Script segment IDs (+ optional Character asset IDs).
 */

import { z } from "zod";
import { ArtAnalysisCandidateSchema } from "@/domain/art";
import { toOpenAIStrictJsonSchema } from "../structured-output";

export const ART_CANDIDATE_SCHEMA_NAME = "art-analysis-candidate-v1_1";
export const ART_CANDIDATE_SCHEMA_VERSION = "1.1.0";

export type ArtCandidateSchemaContext = {
  /** Authoritative VideoScript.segments[].id values for this run. */
  scriptSegmentIds: readonly string[];
  characterId?: string;
  outfitIds?: readonly string[];
  expressionIds?: readonly string[];
  poseIds?: readonly string[];
  referenceIds?: readonly string[];
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueNonEmpty(ids: readonly string[] | undefined): string[] {
  if (!ids?.length) return [];
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function setStringEnum(node: Record<string, unknown> | undefined, values: string[]): void {
  if (!node || values.length === 0) return;
  node.type = "string";
  node.enum = values;
  delete node.minLength;
  delete node.maxLength;
  delete node.pattern;
}

function segmentItemProps(schema: Record<string, unknown>): Record<string, unknown> | undefined {
  const props = schema.properties as Record<string, unknown> | undefined;
  const segments = props?.segments as Record<string, unknown> | undefined;
  const items = segments?.items as Record<string, unknown> | undefined;
  return items?.properties as Record<string, unknown> | undefined;
}

function continuityItemProps(schema: Record<string, unknown>): Record<string, unknown> | undefined {
  const props = schema.properties as Record<string, unknown> | undefined;
  const rules = props?.continuityRules as Record<string, unknown> | undefined;
  const items = rules?.items as Record<string, unknown> | undefined;
  return items?.properties as Record<string, unknown> | undefined;
}

/**
 * Apply run-scoped enums for upstream Script segment IDs and Character assets.
 * Does not mutate the input schema.
 */
export function applyArtCandidateUpstreamEnums(
  schema: Record<string, unknown>,
  ctx: ArtCandidateSchemaContext,
): Record<string, unknown> {
  const next = cloneJson(schema);
  const scriptIds = uniqueNonEmpty(ctx.scriptSegmentIds);
  if (scriptIds.length === 0) {
    throw new Error("Art candidate schema requires non-empty scriptSegmentIds.");
  }

  const segProps = segmentItemProps(next);
  if (segProps) {
    setStringEnum(segProps.id as Record<string, unknown> | undefined, scriptIds);
    setStringEnum(segProps.scriptSegmentId as Record<string, unknown> | undefined, scriptIds);

    const character = segProps.character as Record<string, unknown> | undefined;
    // OpenAI-strict optional object is often anyOf[{...},{type:null}]
    const charVariants = Array.isArray(character?.anyOf)
      ? (character!.anyOf as Record<string, unknown>[])
      : character
        ? [character]
        : [];
    for (const variant of charVariants) {
      if (variant.type === "null") continue;
      const charProps = variant.properties as Record<string, unknown> | undefined;
      if (!charProps) continue;
      if (ctx.characterId) {
        setStringEnum(charProps.characterId as Record<string, unknown> | undefined, [
          ctx.characterId,
        ]);
      }
      const outfits = uniqueNonEmpty(ctx.outfitIds);
      const expressions = uniqueNonEmpty(ctx.expressionIds);
      const poses = uniqueNonEmpty(ctx.poseIds);
      const references = uniqueNonEmpty(ctx.referenceIds);
      // Optional nullable fields may be anyOf — set enum on string branch when present as plain string.
      if (outfits.length) setOptionalStringEnum(charProps, "outfitId", outfits);
      if (expressions.length) setOptionalStringEnum(charProps, "expressionId", expressions);
      if (poses.length) setOptionalStringEnum(charProps, "poseId", poses);
      if (references.length) setOptionalStringEnum(charProps, "referenceId", references);
    }
  }

  const ruleProps = continuityItemProps(next);
  if (ruleProps) {
    const applies = ruleProps.appliesToSegmentIds as Record<string, unknown> | undefined;
    const appliesItems = applies?.items as Record<string, unknown> | undefined;
    setStringEnum(appliesItems, scriptIds);
  }

  return next;
}

function setOptionalStringEnum(
  props: Record<string, unknown>,
  key: string,
  values: string[],
): void {
  const node = props[key] as Record<string, unknown> | undefined;
  if (!node) return;
  if (Array.isArray(node.anyOf)) {
    for (const branch of node.anyOf as Record<string, unknown>[]) {
      if (branch.type === "null") continue;
      setStringEnum(branch, values);
    }
    return;
  }
  setStringEnum(node, values);
}

let cachedBase: Record<string, unknown> | null = null;

/** Base static structure from Zod (no run-scoped enums). */
export function getArtCandidateJsonSchema(): Record<string, unknown> {
  if (cachedBase) return cachedBase;
  cachedBase = toOpenAIStrictJsonSchema(
    z.toJSONSchema(ArtAnalysisCandidateSchema, { target: "draft-7" }) as Record<
      string,
      unknown
    >,
  );
  return cachedBase;
}

export function getArtCandidateJsonSchemaForRun(
  ctx: ArtCandidateSchemaContext,
): Record<string, unknown> {
  return applyArtCandidateUpstreamEnums(getArtCandidateJsonSchema(), ctx);
}

export function getArtCandidateTextFormat(ctx?: ArtCandidateSchemaContext) {
  const schema = ctx
    ? getArtCandidateJsonSchemaForRun(ctx)
    : getArtCandidateJsonSchema();
  return {
    type: "json_schema" as const,
    name: ART_CANDIDATE_SCHEMA_NAME,
    strict: true as const,
    schema,
  };
}

export function artCandidateSchemaContract(ctx?: ArtCandidateSchemaContext) {
  const schema = ctx
    ? getArtCandidateJsonSchemaForRun(ctx)
    : getArtCandidateJsonSchema();
  return {
    name: ART_CANDIDATE_SCHEMA_NAME,
    version: ART_CANDIDATE_SCHEMA_VERSION,
    schema,
    additionalPropertiesFalse: schema.additionalProperties === false,
    required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
  };
}

export function artCandidateSchemaContextFromSources(input: {
  scriptSegmentIds: readonly string[];
  characterId?: string;
  outfitIds?: readonly string[];
  expressionIds?: readonly string[];
  poseIds?: readonly string[];
  referenceIds?: readonly string[];
}): ArtCandidateSchemaContext {
  return {
    scriptSegmentIds: uniqueNonEmpty(input.scriptSegmentIds),
    ...(input.characterId ? { characterId: input.characterId } : {}),
    ...(input.outfitIds ? { outfitIds: uniqueNonEmpty(input.outfitIds) } : {}),
    ...(input.expressionIds
      ? { expressionIds: uniqueNonEmpty(input.expressionIds) }
      : {}),
    ...(input.poseIds ? { poseIds: uniqueNonEmpty(input.poseIds) } : {}),
    ...(input.referenceIds
      ? { referenceIds: uniqueNonEmpty(input.referenceIds) }
      : {}),
  };
}

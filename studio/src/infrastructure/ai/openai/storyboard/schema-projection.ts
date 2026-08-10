/**
 * Inspect OpenAI-strict Storyboard JSON Schema projection (local, no provider).
 * Used by dry-run guards and RETRY2-PREP parity checks.
 */
import { getStoryboardCandidateJsonSchema } from "./schema";

export type StoryboardSchemaProjectionReport = {
  structuredSchemaOneOfCount: number;
  structuredSchemaAnyOfCount: number;
  /** Stable label for smoke/dry-run gates. */
  structuredSchemaProjection: "anyOf-compatible" | "invalid";
  rootType: string | null;
  rootAdditionalPropertiesFalse: boolean;
  spokenContentHasAnyOf: boolean;
  spokenContentVariantCount: number;
  spokenContentKindLiterals: string[];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function countKeyword(node: unknown, key: string): number {
  if (!node || typeof node !== "object") return 0;
  if (Array.isArray(node)) {
    return node.reduce((n: number, child) => n + countKeyword(child, key), 0);
  }
  const obj = node as Record<string, unknown>;
  let n = Object.prototype.hasOwnProperty.call(obj, key) ? 1 : 0;
  for (const child of Object.values(obj)) n += countKeyword(child, key);
  return n;
}

function extractSpokenContent(schema: Record<string, unknown>): Record<string, unknown> | null {
  const props = schema.properties;
  if (!isPlainObject(props)) return null;
  const scenes = props.scenes;
  if (!isPlainObject(scenes)) return null;
  const items = scenes.items;
  if (!isPlainObject(items)) return null;
  const itemProps = items.properties;
  if (!isPlainObject(itemProps)) return null;
  const spoken = itemProps.spokenContent;
  return isPlainObject(spoken) ? spoken : null;
}

function kindLiteralsFromUnion(spoken: Record<string, unknown>): string[] {
  const branches = Array.isArray(spoken.anyOf)
    ? spoken.anyOf
    : Array.isArray(spoken.oneOf)
      ? spoken.oneOf
      : [];
  const kinds: string[] = [];
  for (const branch of branches) {
    if (!isPlainObject(branch)) continue;
    const bProps = branch.properties;
    if (!isPlainObject(bProps)) continue;
    const kind = bProps.kind;
    if (!isPlainObject(kind)) continue;
    if (typeof kind.const === "string") kinds.push(kind.const);
    else if (Array.isArray(kind.enum)) {
      for (const v of kind.enum) if (typeof v === "string") kinds.push(v);
    }
  }
  return [...new Set(kinds)].sort();
}

/** Inspect the exact schema object sent as text.format.schema. */
export function inspectStoryboardStructuredSchemaProjection(
  schema: Record<string, unknown> = getStoryboardCandidateJsonSchema(),
): StoryboardSchemaProjectionReport {
  const oneOf = countKeyword(schema, "oneOf");
  const anyOf = countKeyword(schema, "anyOf");
  const spoken = extractSpokenContent(schema);
  const kinds = spoken ? kindLiteralsFromUnion(spoken) : [];
  const spokenHasAnyOf = Boolean(spoken && Array.isArray(spoken.anyOf));
  const rootOk =
    schema.type === "object" &&
    schema.additionalProperties === false &&
    !Array.isArray(schema.anyOf) &&
    !Array.isArray(schema.oneOf);
  const variantsOk =
    spokenHasAnyOf &&
    kinds.includes("dialogue") &&
    kinds.includes("voice_over") &&
    kinds.includes("none");
  const compatible = oneOf === 0 && rootOk && variantsOk;

  return {
    structuredSchemaOneOfCount: oneOf,
    structuredSchemaAnyOfCount: anyOf,
    structuredSchemaProjection: compatible ? "anyOf-compatible" : "invalid",
    rootType: typeof schema.type === "string" ? schema.type : null,
    rootAdditionalPropertiesFalse: schema.additionalProperties === false,
    spokenContentHasAnyOf: spokenHasAnyOf,
    spokenContentVariantCount: kinds.length,
    spokenContentKindLiterals: kinds,
  };
}

/** Constant readiness flag for dry-run / smoke gates (logging + evidence capture). */
export const STORYBOARD_PROVIDER_ERROR_METADATA_CAPTURE = "ready" as const;

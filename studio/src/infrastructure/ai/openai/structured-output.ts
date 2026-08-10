/**
 * Convert Zod JSON Schema → OpenAI strict Structured Outputs shape (VHS-117A).
 * Optional fields become required + nullable (OpenAI strict requirement).
 *
 * OpenAI strict Structured Outputs rejects `oneOf` (Zod discriminatedUnion).
 * Convert nested `oneOf` → `anyOf` (supported); root must remain a plain object.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function makeNullable(schema: Record<string, unknown>): Record<string, unknown> {
  // Avoid double-wrapping
  if (Array.isArray(schema.type) && schema.type.includes("null")) {
    return schema;
  }
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const hasNull = schema.anyOf.some(
      (x) => isPlainObject(x) && x.type === "null"
    );
    if (hasNull) return schema;
  }
  const { ...rest } = schema;
  return { anyOf: [rest, { type: "null" }] };
}

/**
 * Recursively enforce:
 * - additionalProperties: false on objects
 * - all properties listed in required
 * - optional props → nullable + required
 * - oneOf → anyOf (OpenAI strict)
 */
export function toOpenAIStrictJsonSchema(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const clone = structuredClone(schema);
  delete clone.$schema;
  delete clone.$id;
  delete clone.definitions;
  delete clone.$defs;

  function walk(node: unknown): unknown {
    if (!isPlainObject(node)) return node;

    if (node.$ref) {
      throw new Error("JSON Schema $ref is not supported for OpenAI strict mode");
    }

    // OpenAI strict: oneOf not permitted — anyOf is the supported union form.
    if (Array.isArray(node.oneOf)) {
      const rest = { ...node };
      delete rest.oneOf;
      const existingAnyOf = Array.isArray(rest.anyOf) ? rest.anyOf : [];
      return walk({
        ...rest,
        anyOf: [...existingAnyOf, ...node.oneOf],
      });
    }

    if (node.type === "object" || node.properties) {
      const props = isPlainObject(node.properties)
        ? (node.properties as Record<string, unknown>)
        : {};
      const required = new Set(
        Array.isArray(node.required)
          ? node.required.filter((x): x is string => typeof x === "string")
          : []
      );
      const nextProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        let child = walk(value);
        if (!required.has(key) && isPlainObject(child)) {
          child = makeNullable(child);
        }
        nextProps[key] = child;
        required.add(key);
      }
      return {
        ...node,
        type: "object",
        properties: nextProps,
        required: [...required].sort(),
        additionalProperties: false,
      };
    }

    if (node.type === "array" && node.items != null) {
      return { ...node, items: walk(node.items) };
    }

    if (Array.isArray(node.anyOf)) {
      return { ...node, anyOf: node.anyOf.map(walk) };
    }

    return node;
  }

  const out = walk(clone);
  if (!isPlainObject(out)) {
    throw new Error("Root JSON Schema must be an object");
  }
  if (Array.isArray(out.anyOf) || Array.isArray(out.oneOf)) {
    throw new Error("Root JSON Schema must be an object (not a union)");
  }
  return out;
}

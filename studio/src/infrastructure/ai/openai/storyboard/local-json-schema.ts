/**
 * Minimal local JSON Schema validator for OpenAI-strict Storyboard projection.
 * No network; subset sufficient for spokenContent / object parity checks.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export type LocalSchemaIssue = { path: string; message: string };

export function validateAgainstLocalJsonSchema(
  schema: unknown,
  data: unknown,
  path = "root",
): LocalSchemaIssue[] {
  if (!isPlainObject(schema)) {
    return [{ path, message: "schema_not_object" }];
  }

  if (Array.isArray(schema.anyOf)) {
    const branchIssues: LocalSchemaIssue[][] = [];
    for (const branch of schema.anyOf) {
      const issues = validateAgainstLocalJsonSchema(branch, data, path);
      if (issues.length === 0) return [];
      branchIssues.push(issues);
    }
    return [
      {
        path,
        message: `anyOf_no_match (${branchIssues.length} branches)`,
      },
    ];
  }

  if (Array.isArray(schema.oneOf)) {
    return [{ path, message: "oneOf_forbidden_in_openai_strict" }];
  }

  if (schema.const !== undefined) {
    return Object.is(data, schema.const)
      ? []
      : [{ path, message: `const_mismatch expected=${String(schema.const)}` }];
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.some((v) => Object.is(v, data))
      ? []
      : [{ path, message: "enum_mismatch" }];
  }

  if (schema.type === "null") {
    return data === null ? [] : [{ path, message: "expected_null" }];
  }

  if (schema.type === "string") {
    if (typeof data !== "string") return [{ path, message: "expected_string" }];
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      return [{ path, message: "minLength" }];
    }
    if (typeof schema.maxLength === "number" && data.length > schema.maxLength) {
      return [{ path, message: "maxLength" }];
    }
    return [];
  }

  if (schema.type === "number" || schema.type === "integer") {
    if (typeof data !== "number" || !Number.isFinite(data)) {
      return [{ path, message: "expected_number" }];
    }
    if (schema.type === "integer" && !Number.isInteger(data)) {
      return [{ path, message: "expected_integer" }];
    }
    return [];
  }

  if (schema.type === "boolean") {
    return typeof data === "boolean" ? [] : [{ path, message: "expected_boolean" }];
  }

  if (schema.type === "array") {
    if (!Array.isArray(data)) return [{ path, message: "expected_array" }];
    const itemSchema = schema.items;
    const issues: LocalSchemaIssue[] = [];
    if (itemSchema) {
      data.forEach((item, i) => {
        issues.push(
          ...validateAgainstLocalJsonSchema(itemSchema, item, `${path}[${i}]`),
        );
      });
    }
    return issues;
  }

  if (schema.type === "object" || schema.properties) {
    if (!isPlainObject(data)) return [{ path, message: "expected_object" }];
    const props = isPlainObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((k): k is string => typeof k === "string")
      : [];
    const issues: LocalSchemaIssue[] = [];
    for (const key of required) {
      if (!(key in data)) issues.push({ path: `${path}.${key}`, message: "required" });
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in props)) {
          issues.push({ path: `${path}.${key}`, message: "additionalProperties" });
        }
      }
    }
    for (const [key, childSchema] of Object.entries(props)) {
      if (key in data) {
        issues.push(
          ...validateAgainstLocalJsonSchema(childSchema, data[key], `${path}.${key}`),
        );
      }
    }
    return issues;
  }

  return [];
}

/**
 * Fill OpenAI-strict required nullable fields with `null` (wire shape).
 * Domain Zod often omits optionals; the projected schema requires them present.
 */
export function fillOpenAIStrictNullables(
  schema: unknown,
  data: unknown,
): unknown {
  if (!isPlainObject(schema)) return data;
  if (Array.isArray(schema.anyOf)) {
    // Prefer first matching branch after fill attempts.
    for (const branch of schema.anyOf) {
      const filled = fillOpenAIStrictNullables(branch, data);
      if (validateAgainstLocalJsonSchema(branch, filled).length === 0) return filled;
    }
    return data;
  }
  if (schema.type === "array" && Array.isArray(data) && schema.items) {
    return data.map((item) => fillOpenAIStrictNullables(schema.items, item));
  }
  if ((schema.type === "object" || schema.properties) && isPlainObject(data)) {
    const props = isPlainObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((k): k is string => typeof k === "string")
      : [];
    const out: Record<string, unknown> = { ...data };
    for (const key of required) {
      if (!(key in out) && key in props) {
        const propSchema = props[key];
        if (
          isPlainObject(propSchema) &&
          Array.isArray(propSchema.anyOf) &&
          propSchema.anyOf.some(
            (b) => isPlainObject(b) && b.type === "null",
          )
        ) {
          out[key] = null;
        }
      }
    }
    for (const [key, childSchema] of Object.entries(props)) {
      if (key in out) {
        out[key] = fillOpenAIStrictNullables(childSchema, out[key]);
      }
    }
    return out;
  }
  return data;
}

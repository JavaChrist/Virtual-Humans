/**
 * OpenAI strict Structured Outputs rejects `oneOf` (Zod discriminatedUnion).
 * toOpenAIStrictJsonSchema must convert nested oneOf → anyOf.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { toOpenAIStrictJsonSchema } from "../structured-output";
import { getStoryboardCandidateJsonSchema } from "../storyboard/schema";

function countKeyword(node: unknown, key: string): number {
  if (!node || typeof node !== "object") return 0;
  if (Array.isArray(node)) {
    return node.reduce((n, child) => n + countKeyword(child, key), 0);
  }
  const obj = node as Record<string, unknown>;
  let n = Object.prototype.hasOwnProperty.call(obj, key) ? 1 : 0;
  for (const child of Object.values(obj)) n += countKeyword(child, key);
  return n;
}

test("discriminatedUnion oneOf is rewritten to anyOf", () => {
  const zodJson = z.toJSONSchema(
    z.object({
      spoken: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("dialogue"), text: z.string() }),
        z.object({ kind: z.literal("none") }),
      ]),
    }),
    { target: "draft-7" },
  ) as Record<string, unknown>;

  assert.ok(countKeyword(zodJson, "oneOf") >= 1);
  const strict = toOpenAIStrictJsonSchema(zodJson);
  assert.equal(countKeyword(strict, "oneOf"), 0);
  assert.ok(countKeyword(strict, "anyOf") >= 1);
  assert.equal(strict.type, "object");
  assert.equal(strict.additionalProperties, false);
});

test("Storyboard candidate schema has no oneOf after strict transform", () => {
  const schema = getStoryboardCandidateJsonSchema();
  assert.equal(countKeyword(schema, "oneOf"), 0);
  const spoken = (
    (schema.properties as Record<string, unknown>).scenes as {
      items?: { properties?: { spokenContent?: Record<string, unknown> } };
    }
  )?.items?.properties?.spokenContent;
  assert.ok(spoken);
  assert.equal(spoken.oneOf, undefined);
  assert.ok(Array.isArray(spoken.anyOf));
});

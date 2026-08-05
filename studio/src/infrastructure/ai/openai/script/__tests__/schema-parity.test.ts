/**
 * Parité JSON Schema OpenAI-strict ↔ Zod Script (7F-A) — local, no provider.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeValidScriptCandidate } from "@/domain/script/__tests__/fixtures";
import { ScriptAnalysisCandidateSchema } from "@/domain/script";
import {
  getScriptCandidateJsonSchema,
  getScriptCandidateTextFormat,
  scriptCandidateSchemaContract,
} from "../schema";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isNullUnion(schema: Record<string, unknown>): boolean {
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (!Array.isArray(schema.anyOf)) return false;
  return schema.anyOf.some(
    (x) => isPlainObject(x) && x.type === "null",
  );
}

test("textFormat — strict true + json_schema name", () => {
  const fmt = getScriptCandidateTextFormat();
  assert.equal(fmt.type, "json_schema");
  assert.equal(fmt.strict, true);
  assert.equal(fmt.name, "script-analysis-candidate-v1");
});

test("OpenAI schema — additionalProperties false + required optionals", () => {
  const c = scriptCandidateSchemaContract();
  assert.equal(c.additionalPropertiesFalse, true);
  for (const key of [
    "adaptationNote",
    "assumptions",
    "claimedEvidence",
    "notes",
  ]) {
    assert.ok(c.required.includes(key), `required missing ${key}`);
    const props = (c.schema.properties ?? {}) as Record<string, unknown>;
    assert.ok(isPlainObject(props[key]), `property ${key}`);
    assert.equal(isNullUnion(props[key] as Record<string, unknown>), true);
  }
});

test("Zod accepte null OpenAI-strict sur optionnels racine (cause 7E)", () => {
  const withNulls = {
    ...makeValidScriptCandidate(),
    adaptationNote: null,
    assumptions: null,
    claimedEvidence: null,
    notes: null,
  };
  const parsed = ScriptAnalysisCandidateSchema.safeParse(withNulls);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.adaptationNote, undefined);
  assert.equal(parsed.data.assumptions, undefined);
  assert.equal(parsed.data.claimedEvidence, undefined);
  assert.equal(parsed.data.notes, undefined);
});

test("Zod accepte null sur optionnels imbriqués assumption/evidence", () => {
  const parsed = ScriptAnalysisCandidateSchema.safeParse({
    ...makeValidScriptCandidate(),
    assumptions: [
      {
        id: "a1",
        statement: "Le public urbain valorise surtout le gain de temps.",
        status: "explicit",
        justification: null,
        affectsFields: null,
      },
    ],
    claimedEvidence: [
      {
        field: "hookText",
        source: "brief",
        sourcePath: null,
        summary: "Accroche alignée au brief produit.",
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("contrat métier non assoupli — inferred sans justification échoue", () => {
  const parsed = ScriptAnalysisCandidateSchema.safeParse({
    ...makeValidScriptCandidate(),
    assumptions: [
      {
        id: "a-bad",
        statement: "Hypothèse sans justification",
        status: "inferred",
        justification: null,
      },
    ],
  });
  assert.equal(parsed.success, false);
});

test("enums / bornes alignés entre JSON Schema et Zod", () => {
  const schema = getScriptCandidateJsonSchema();
  const props = schema.properties as Record<string, unknown>;
  const segments = props.segments as Record<string, unknown>;
  assert.ok(typeof segments.minItems === "number" || Array.isArray(segments.minItems));
  assert.equal(
    ScriptAnalysisCandidateSchema.safeParse({
      ...makeValidScriptCandidate(),
      segments: [],
    }).success,
    false,
  );
  assert.equal(
    ScriptAnalysisCandidateSchema.safeParse({
      ...makeValidScriptCandidate(),
      title: "",
    }).success,
    false,
  );
});

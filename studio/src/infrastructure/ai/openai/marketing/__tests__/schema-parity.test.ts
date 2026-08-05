/**
 * Parité JSON Schema OpenAI-strict ↔ Zod Marketing (7F-A) — local, no provider.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeValidCandidate } from "@/domain/marketing/__tests__/fixtures";
import { MarketingAnalysisCandidateSchema } from "@/domain/marketing";
import {
  getMarketingCandidateJsonSchema,
  getMarketingCandidateTextFormat,
  marketingCandidateSchemaContract,
} from "../response-schema";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isNullUnion(schema: Record<string, unknown>): boolean {
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (!Array.isArray(schema.anyOf)) return false;
  return schema.anyOf.some(
    (x) => isPlainObject(x) && x.type === "null"
  );
}

test("textFormat — strict true + json_schema name", () => {
  const fmt = getMarketingCandidateTextFormat();
  assert.equal(fmt.type, "json_schema");
  assert.equal(fmt.strict, true);
  assert.equal(fmt.name, "marketing_analysis_candidate");
});

test("OpenAI schema — additionalProperties false + required optionals", () => {
  const c = marketingCandidateSchemaContract();
  assert.equal(c.additionalPropertiesFalse, true);
  for (const key of [
    "secondaryAudience",
    "secondaryBenefits",
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
    ...makeValidCandidate(),
    secondaryAudience: null,
    secondaryBenefits: null,
    assumptions: null,
    claimedEvidence: null,
    notes: null,
  };
  const parsed = MarketingAnalysisCandidateSchema.safeParse(withNulls);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.secondaryAudience, undefined);
  assert.equal(parsed.data.secondaryBenefits, undefined);
  assert.equal(parsed.data.assumptions, undefined);
  assert.equal(parsed.data.claimedEvidence, undefined);
  assert.equal(parsed.data.notes, undefined);
});

test("Zod accepte null sur optionnels imbriqués assumption/evidence", () => {
  const parsed = MarketingAnalysisCandidateSchema.safeParse({
    ...makeValidCandidate(),
    assumptions: [
      {
        id: "a1",
        statement: "Les navetteurs valorisent surtout le gain de temps.",
        status: "explicit",
        justification: null,
        affectsFields: null,
      },
    ],
    claimedEvidence: [
      {
        field: "mainBenefit",
        source: "brief",
        sourcePath: null,
        summary: "Benefice aligne au brief produit.",
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("contrat métier non assoupli — inferred sans justification échoue", () => {
  const parsed = MarketingAnalysisCandidateSchema.safeParse({
    ...makeValidCandidate(),
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
  const schema = getMarketingCandidateJsonSchema();
  const props = schema.properties as Record<string, unknown>;
  const objective = props.marketingObjective as Record<string, unknown>;
  assert.ok(Array.isArray(objective.enum));
  assert.ok((objective.enum as string[]).includes("conversion"));
  assert.equal(
    MarketingAnalysisCandidateSchema.safeParse({
      ...makeValidCandidate(),
      marketingObjective: "not-an-objective",
    }).success,
    false
  );
  assert.equal(
    MarketingAnalysisCandidateSchema.safeParse({
      ...makeValidCandidate(),
      keyMessages: [],
    }).success,
    false
  );
});

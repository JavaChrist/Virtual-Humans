/**
 * Parité JSON Schema OpenAI-strict ↔ Zod Creative (8B) — local, no provider.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeValidCreativeCandidate } from "@/domain/creative/__tests__/fixtures";
import {
  CreativeAnalysisCandidateSchema,
  CreativeAnalyzerCandidateSchema,
  normalizeCreativeCandidate,
} from "@/domain/creative";
import {
  applyEmotionalArcMaxBeats,
  getCreativeCandidateJsonSchema,
  getCreativeCandidateTextFormat,
  creativeCandidateSchemaContract,
  CREATIVE_CANDIDATE_SCHEMA_NAME,
  CREATIVE_CANDIDATE_SCHEMA_VERSION,
} from "../schema";

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

test("textFormat — strict true + json_schema name v1_2", () => {
  const fmt = getCreativeCandidateTextFormat();
  assert.equal(fmt.type, "json_schema");
  assert.equal(fmt.strict, true);
  assert.equal(fmt.name, CREATIVE_CANDIDATE_SCHEMA_NAME);
  assert.equal(CREATIVE_CANDIDATE_SCHEMA_VERSION, "1.2.0");
  assert.equal(fmt.name, "creative-analysis-candidate-v1_2");
});

test("OpenAI schema 1.2.0 — beats sans propriété order", () => {
  const c = creativeCandidateSchemaContract();
  assert.equal(c.emotionalArcBeatHasOrder, false);
});

test("textFormat duration 30s — maxItems emotionalArc = 5", () => {
  const fmt = getCreativeCandidateTextFormat({ durationSeconds: 30 });
  const props = (fmt.schema.properties ?? {}) as Record<string, unknown>;
  const arc = props.emotionalArc as Record<string, unknown>;
  assert.equal(arc.maxItems, 5);
  assert.equal(arc.minItems, 2);
});

test("applyEmotionalArcMaxBeats ne mute pas le cache", () => {
  const base = getCreativeCandidateJsonSchema();
  const before = JSON.stringify(base);
  applyEmotionalArcMaxBeats(base, 3);
  assert.equal(JSON.stringify(getCreativeCandidateJsonSchema()), before);
});

test("OpenAI schema — additionalProperties false + required optionals", () => {
  const c = creativeCandidateSchemaContract();
  assert.equal(c.additionalPropertiesFalse, true);
  for (const key of [
    "proofDevice",
    "constraints",
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

test("Zod analyzer accepte null OpenAI-strict sur optionnels racine", () => {
  const base = makeValidCreativeCandidate();
  const withNulls = {
    title: base.title,
    logline: base.logline,
    bigIdea: base.bigIdea,
    narrativeApproach: base.narrativeApproach,
    emotionalArc: base.emotionalArc.map(
      ({ purpose, emotion, description }) => ({
        purpose,
        emotion,
        description,
      }),
    ),
    openingDevice: base.openingDevice,
    endingDevice: base.endingDevice,
    rhythm: base.rhythm,
    referenceKeywords: base.referenceKeywords,
    proofDevice: null,
    constraints: null,
    assumptions: null,
    claimedEvidence: null,
    notes: null,
  };
  const parsed = CreativeAnalyzerCandidateSchema.safeParse(withNulls);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  const normalized = normalizeCreativeCandidate(parsed.data);
  assert.equal(normalized.proofDevice, undefined);
  assert.equal(normalized.constraints, undefined);
  assert.equal(normalized.assumptions, undefined);
  assert.equal(normalized.claimedEvidence, undefined);
  assert.equal(normalized.notes, undefined);
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse(normalized).success,
    true,
  );
});

test("Zod accepte null sur optionnels imbriqués assumption/evidence", () => {
  const parsed = CreativeAnalysisCandidateSchema.safeParse({
    ...makeValidCreativeCandidate(),
    assumptions: [
      {
        id: "a1",
        statement: "Le contraste attente/départ reste lisible en 30 secondes.",
        status: "explicit",
        justification: null,
        affectsFields: null,
      },
    ],
    claimedEvidence: [
      {
        field: "bigIdea",
        source: "marketing_plan",
        sourcePath: null,
        summary: "Grande idée alignée au plan marketing.",
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("contrat métier non assoupli — inferred sans justification échoue", () => {
  const parsed = CreativeAnalysisCandidateSchema.safeParse({
    ...makeValidCreativeCandidate(),
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
  const schema = getCreativeCandidateJsonSchema();
  const props = schema.properties as Record<string, unknown>;
  const narrative = props.narrativeApproach as Record<string, unknown>;
  assert.ok(Array.isArray(narrative.enum));
  assert.ok((narrative.enum as string[]).includes("problem_solution"));
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      narrativeApproach: "not-an-approach",
    }).success,
    false
  );
  assert.equal(
    CreativeAnalysisCandidateSchema.safeParse({
      ...makeValidCreativeCandidate(),
      emotionalArc: [],
    }).success,
    false
  );
});

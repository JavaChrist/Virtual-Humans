/**
 * Parité JSON Schema OpenAI-strict ↔ Zod Storyboard (7F-A) — local, no provider.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  makeStoryboardChain,
  makeValidStoryboardCandidate,
} from "@/domain/storyboard/__tests__/fixtures";
import { StoryboardAnalysisCandidateSchema } from "@/domain/storyboard";
import {
  getStoryboardCandidateJsonSchema,
  getStoryboardCandidateTextFormat,
  storyboardCandidateSchemaContract,
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
  const fmt = getStoryboardCandidateTextFormat();
  assert.equal(fmt.type, "json_schema");
  assert.equal(fmt.strict, true);
  assert.equal(fmt.name, "storyboard-analysis-candidate-v1");
});

test("OpenAI schema — no oneOf (OpenAI strict rejects Zod discriminatedUnion)", () => {
  const schema = getStoryboardCandidateJsonSchema();
  const raw = JSON.stringify(schema);
  assert.equal(raw.includes('"oneOf"'), false);
  assert.equal(raw.includes('"spokenContent"'), true);
});

test("OpenAI schema — additionalProperties false + required optionals", () => {
  const c = storyboardCandidateSchemaContract();
  assert.equal(c.additionalPropertiesFalse, true);
  for (const key of [
    "intentionalBreaks",
    "assumptions",
    "claimedEvidence",
    "claimedTotalDurationSeconds",
    "notes",
    "sceneCountJustification",
  ]) {
    assert.ok(c.required.includes(key), `required missing ${key}`);
    const props = (c.schema.properties ?? {}) as Record<string, unknown>;
    assert.ok(isPlainObject(props[key]), `property ${key}`);
    assert.equal(isNullUnion(props[key] as Record<string, unknown>), true);
  }
});

test("Zod accepte null OpenAI-strict sur optionnels racine (cause 7E)", () => {
  const chain = makeStoryboardChain();
  const withNulls = {
    ...makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection),
    intentionalBreaks: null,
    assumptions: null,
    claimedEvidence: null,
    claimedTotalDurationSeconds: null,
    notes: null,
    sceneCountJustification: null,
  };
  const parsed = StoryboardAnalysisCandidateSchema.safeParse(withNulls);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.intentionalBreaks, undefined);
  assert.equal(parsed.data.assumptions, undefined);
  assert.equal(parsed.data.claimedEvidence, undefined);
  assert.equal(parsed.data.claimedTotalDurationSeconds, undefined);
  assert.equal(parsed.data.notes, undefined);
  assert.equal(parsed.data.sceneCountJustification, undefined);
});

test("Zod accepte null sur optionnels imbriqués assumption/evidence", () => {
  const chain = makeStoryboardChain();
  const parsed = StoryboardAnalysisCandidateSchema.safeParse({
    ...makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection),
    assumptions: [
      {
        id: "a1",
        statement: "Une scène par segment suffit pour ce format court.",
        status: "explicit",
        justification: null,
        affectsFields: null,
      },
    ],
    claimedEvidence: [
      {
        field: "title",
        source: "video_script",
        sourcePath: null,
        summary: "Titre aligné au script.",
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("contrat métier non assoupli — purpose scène invalide échoue", () => {
  const chain = makeStoryboardChain();
  const base = makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection);
  const parsed = StoryboardAnalysisCandidateSchema.safeParse({
    ...base,
    scenes: [{ ...base.scenes[0]!, purpose: "not-a-purpose" as never }],
  });
  assert.equal(parsed.success, false);
});

test("enums / bornes alignés entre JSON Schema et Zod", () => {
  const schema = getStoryboardCandidateJsonSchema();
  const props = schema.properties as Record<string, unknown>;
  const scenes = props.scenes as Record<string, unknown>;
  assert.ok(typeof scenes.minItems === "number" || Array.isArray(scenes.minItems));
  const chain = makeStoryboardChain();
  assert.equal(
    StoryboardAnalysisCandidateSchema.safeParse({
      ...makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection),
      scenes: [],
    }).success,
    false,
  );
  assert.equal(
    StoryboardAnalysisCandidateSchema.safeParse({
      ...makeValidStoryboardCandidate(chain.videoScript, chain.visualDirection),
      title: "",
    }).success,
    false,
  );
});

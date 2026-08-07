/**
 * Parité JSON Schema OpenAI-strict ↔ Zod Art (7F-A) — local, no provider.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeValidArtCandidate } from "@/domain/art/__tests__/fixtures";
import { ArtAnalysisCandidateSchema } from "@/domain/art";
import {
  getArtCandidateJsonSchema,
  getArtCandidateTextFormat,
  artCandidateSchemaContract,
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
  const fmt = getArtCandidateTextFormat({
    scriptSegmentIds: ["seg-1", "seg-2", "seg-3", "seg-4"],
  });
  assert.equal(fmt.type, "json_schema");
  assert.equal(fmt.strict, true);
  assert.equal(fmt.name, "art-analysis-candidate-v1_1");
});

test("OpenAI schema — additionalProperties false + required optionals", () => {
  const c = artCandidateSchemaContract();
  assert.equal(c.additionalPropertiesFalse, true);
  for (const key of ["assumptions", "claimedEvidence", "notes"]) {
    assert.ok(c.required.includes(key), `required missing ${key}`);
    const props = (c.schema.properties ?? {}) as Record<string, unknown>;
    assert.ok(isPlainObject(props[key]), `property ${key}`);
    assert.equal(isNullUnion(props[key] as Record<string, unknown>), true);
  }
});

test("Zod accepte null OpenAI-strict sur optionnels racine (cause 7E)", () => {
  const segmentIds = ["seg-1", "seg-2", "seg-3", "seg-4"];
  const withNulls = {
    ...makeValidArtCandidate(segmentIds),
    assumptions: null,
    claimedEvidence: null,
    notes: null,
  };
  const parsed = ArtAnalysisCandidateSchema.safeParse(withNulls);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.assumptions, undefined);
  assert.equal(parsed.data.claimedEvidence, undefined);
  assert.equal(parsed.data.notes, undefined);
});

test("Zod accepte null sur optionnels imbriqués assumption/evidence", () => {
  const segmentIds = ["seg-1", "seg-2", "seg-3", "seg-4"];
  const parsed = ArtAnalysisCandidateSchema.safeParse({
    ...makeValidArtCandidate(segmentIds),
    assumptions: [
      {
        id: "a1",
        statement: "Lumière naturelle renforce le réalisme urbain.",
        status: "explicit",
        justification: null,
        affectsFields: null,
      },
    ],
    claimedEvidence: [
      {
        field: "globalStyle.mood",
        source: "video_script",
        sourcePath: null,
        summary: "Ambiance alignée au script.",
      },
    ],
  });
  assert.equal(parsed.success, true);
});

test("contrat métier non assoupli — hex palette invalide échoue", () => {
  const segmentIds = ["seg-1", "seg-2", "seg-3", "seg-4"];
  const parsed = ArtAnalysisCandidateSchema.safeParse({
    ...makeValidArtCandidate(segmentIds),
    palette: [{ name: "bad", hex: "not-hex", role: "primary" }],
  });
  assert.equal(parsed.success, false);
});

test("enums / bornes alignés entre JSON Schema et Zod", () => {
  const schema = getArtCandidateJsonSchema();
  const props = schema.properties as Record<string, unknown>;
  const globalStyle = props.globalStyle as Record<string, unknown>;
  const style = (globalStyle.properties as Record<string, unknown>).style as Record<string, unknown>;
  assert.ok(Array.isArray(style.enum));
  const segmentIds = ["seg-1", "seg-2", "seg-3", "seg-4"];
  assert.equal(
    ArtAnalysisCandidateSchema.safeParse({
      ...makeValidArtCandidate(segmentIds),
      globalStyle: {
        ...makeValidArtCandidate(segmentIds).globalStyle,
        style: "not-a-style",
      },
    }).success,
    false,
  );
  assert.equal(
    ArtAnalysisCandidateSchema.safeParse({
      ...makeValidArtCandidate(segmentIds),
      palette: [],
    }).success,
    false,
  );
});

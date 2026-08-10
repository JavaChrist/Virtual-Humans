/**
 * Porte 8R — dynamic Art JSON Schema enums + contract version (local, no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ART_ANALYZER_PROMPT_VERSION,
  ART_CANDIDATE_SCHEMA_NAME,
  ART_CANDIDATE_SCHEMA_VERSION,
  applyArtCandidateUpstreamEnums,
  artCandidateSchemaContextFromSources,
  getArtCandidateJsonSchema,
  getArtCandidateJsonSchemaForRun,
  getArtCandidateTextFormat,
} from "../../art";

function dig(schema: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined {
  let cur: unknown = schema;
  for (const p of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur && typeof cur === "object" ? (cur as Record<string, unknown>) : undefined;
}

test("contrat Art v3 / schema 1.1.0", () => {
  assert.equal(ART_ANALYZER_PROMPT_VERSION, "art-analyzer-v3");
  assert.equal(ART_CANDIDATE_SCHEMA_VERSION, "1.1.0");
  assert.equal(ART_CANDIDATE_SCHEMA_NAME, "art-analysis-candidate-v1_1");
  const fmt = getArtCandidateTextFormat({
    scriptSegmentIds: ["segment-1", "segment-2"],
  });
  assert.equal(fmt.name, "art-analysis-candidate-v1_1");
  assert.equal(fmt.strict, true);
});

test("enum/schema contient exactement les IDs Script actifs", () => {
  const ids = ["segment-1", "segment-2", "segment-3", "segment-4", "segment-5"];
  const schema = getArtCandidateJsonSchemaForRun({ scriptSegmentIds: ids });
  const scriptSeg = dig(schema, ["properties", "segments", "items", "properties", "scriptSegmentId"]);
  const segId = dig(schema, ["properties", "segments", "items", "properties", "id"]);
  const applies = dig(schema, [
    "properties",
    "continuityRules",
    "items",
    "properties",
    "appliesToSegmentIds",
    "items",
  ]);
  assert.deepEqual(scriptSeg?.enum, ids);
  assert.deepEqual(segId?.enum, ids);
  assert.deepEqual(applies?.enum, ids);
  assert.equal((scriptSeg?.enum as string[]).includes("vd-1"), false);
  assert.equal((applies?.enum as string[]).includes("seg-1"), false);
});

test("changement de Script rev → nouveau set d'enums", () => {
  const a = getArtCandidateJsonSchemaForRun({
    scriptSegmentIds: ["seg-1", "seg-2"],
  });
  const b = getArtCandidateJsonSchemaForRun({
    scriptSegmentIds: ["seg-1-rev2", "seg-2-rev2"],
  });
  const enumA = dig(a, ["properties", "segments", "items", "properties", "scriptSegmentId"])?.enum;
  const enumB = dig(b, ["properties", "segments", "items", "properties", "scriptSegmentId"])?.enum;
  assert.deepEqual(enumA, ["seg-1", "seg-2"]);
  assert.deepEqual(enumB, ["seg-1-rev2", "seg-2-rev2"]);
});

test("base schema sans contexte reste sans enum Script (structure seule)", () => {
  const base = getArtCandidateJsonSchema();
  const scriptSeg = dig(base, ["properties", "segments", "items", "properties", "scriptSegmentId"]);
  assert.equal(scriptSeg?.enum, undefined);
});

test("applyArtCandidateUpstreamEnums ne mute pas l'entrée", () => {
  const base = getArtCandidateJsonSchema();
  const before = JSON.stringify(base);
  applyArtCandidateUpstreamEnums(base, { scriptSegmentIds: ["a", "b"] });
  assert.equal(JSON.stringify(base), before);
});

test("character asset enums optionnels lorsque snapshot fourni", () => {
  const schema = getArtCandidateJsonSchemaForRun(
    artCandidateSchemaContextFromSources({
      scriptSegmentIds: ["segment-1"],
      characterId: "Tom SDK v1.0.0",
      outfitIds: ["outfit-casual"],
      expressionIds: ["expression:smile"],
      poseIds: ["pose:talking"],
      referenceIds: ["ref-a"],
    }),
  );
  const char = dig(schema, ["properties", "segments", "items", "properties", "character"]);
  assert.ok(char);
  // character is often anyOf[object|null] under strict conversion
  const objectBranch = Array.isArray(char?.anyOf)
    ? (char!.anyOf as Record<string, unknown>[]).find((b) => b.type !== "null")
    : char;
  const props = objectBranch?.properties as Record<string, unknown> | undefined;
  assert.ok(props);
  const outfit = props.outfitId as Record<string, unknown>;
  const outfitEnum = Array.isArray(outfit.anyOf)
    ? (outfit.anyOf as Record<string, unknown>[]).find((b) => b.type !== "null")?.enum
    : outfit.enum;
  assert.deepEqual(outfitEnum, ["outfit-casual"]);
});

test("prompt v3 interdit l'invention d'IDs (garde-fou textuel)", async () => {
  const { ART_ANALYZER_SYSTEM_PROMPT } = await import("../prompt");
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /ALLOWED_SCRIPT_SEGMENT_IDS|VIDEO_SCRIPT\.segments/);
  assert.match(ART_ANALYZER_SYSTEM_PROMPT, /Never invent segment identifiers/i);
  assert.doesNotMatch(ART_ANALYZER_SYSTEM_PROMPT, /\bsegment-1\b/);
});

/**
 * Phase 10F-RETRY2-PREP — OpenAI schema projection + Zod parity (local only).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SceneSpokenContentSchema,
  StoryboardAnalysisCandidateSchema,
} from "@/domain/storyboard";
import {
  makeStoryboardChain,
  makeValidStoryboardCandidate,
} from "@/domain/storyboard/__tests__/fixtures";
import { getStoryboardCandidateJsonSchema } from "../schema";
import { inspectStoryboardStructuredSchemaProjection } from "../schema-projection";
import {
  fillOpenAIStrictNullables,
  validateAgainstLocalJsonSchema,
} from "../local-json-schema";

test("projected schema: oneOf=0, anyOf at spokenContent, strict root", () => {
  const schema = getStoryboardCandidateJsonSchema();
  const report = inspectStoryboardStructuredSchemaProjection(schema);
  assert.equal(report.structuredSchemaOneOfCount, 0);
  assert.ok(report.structuredSchemaAnyOfCount >= 1);
  assert.equal(report.structuredSchemaProjection, "anyOf-compatible");
  assert.equal(report.rootType, "object");
  assert.equal(report.rootAdditionalPropertiesFalse, true);
  assert.equal(report.spokenContentHasAnyOf, true);
  assert.deepEqual(report.spokenContentKindLiterals, [
    "dialogue",
    "none",
    "voice_over",
  ]);
  assert.equal(report.spokenContentVariantCount, 3);
});

test("spokenContent variants: Zod ↔ projected schema parity both ways", () => {
  const schema = getStoryboardCandidateJsonSchema();
  const spokenSchema = (
    (schema.properties as Record<string, unknown>).scenes as {
      items: { properties: { spokenContent: Record<string, unknown> } };
    }
  ).items.properties.spokenContent;

  const validDomain = [
    { kind: "dialogue" as const, sourceText: "Bonjour" },
    { kind: "voice_over" as const, sourceText: "Narration" },
    { kind: "none" as const },
  ];
  for (const sample of validDomain) {
    assert.equal(SceneSpokenContentSchema.safeParse(sample).success, true);
    const wire = fillOpenAIStrictNullables(spokenSchema, sample);
    assert.equal(
      validateAgainstLocalJsonSchema(spokenSchema, wire).length,
      0,
      `projected should accept ${sample.kind}: ${JSON.stringify(wire)}`,
    );
  }

  // OpenAI wire must reject hybrids / extras (strict additionalProperties).
  const projectedRejects = [
    { kind: "dialogue", sourceText: "Hi" }, // missing required characterId null
    { kind: "voice_over", sourceText: "x", characterId: "c1" },
    { kind: "none", sourceText: "oops" },
    { kind: "dialogue", sourceText: "Hi", characterId: null, extra: true },
    { kind: "whisper", sourceText: "nope" },
  ];
  for (const sample of projectedRejects) {
    const projIssues = validateAgainstLocalJsonSchema(spokenSchema, sample);
    assert.ok(
      projIssues.length > 0,
      `projected should reject ${JSON.stringify(sample)}`,
    );
  }
  assert.equal(SceneSpokenContentSchema.safeParse({ kind: "dialogue" }).success, false);
  assert.equal(
    SceneSpokenContentSchema.safeParse({ kind: "whisper", sourceText: "nope" }).success,
    false,
  );
});

test("simulated OpenAI candidate revalidated by Zod (discriminator preserved)", () => {
  const chain = makeStoryboardChain();
  const candidate = makeValidStoryboardCandidate(
    chain.videoScript,
    chain.visualDirection,
  );
  const schema = getStoryboardCandidateJsonSchema();
  const wire = fillOpenAIStrictNullables(schema, candidate);
  assert.equal(
    validateAgainstLocalJsonSchema(schema, wire).length,
    0,
    JSON.stringify(validateAgainstLocalJsonSchema(schema, wire).slice(0, 5)),
  );
  const zod = StoryboardAnalysisCandidateSchema.safeParse(candidate);
  assert.equal(zod.success, true);
  if (!zod.success) return;
  for (const scene of zod.data.scenes) {
    assert.ok(
      scene.spokenContent.kind === "dialogue" ||
        scene.spokenContent.kind === "voice_over" ||
        scene.spokenContent.kind === "none",
    );
  }

  // Wire hybrid (none + sourceText) must fail OpenAI strict — Zod would strip silently.
  const hybrid = structuredClone(wire) as Record<string, unknown>;
  const scenes = hybrid.scenes as Array<Record<string, unknown>>;
  scenes[0]!.spokenContent = {
    kind: "none",
    sourceText: "illegal",
  };
  assert.ok(validateAgainstLocalJsonSchema(schema, hybrid).length > 0);
  assert.equal(
    SceneSpokenContentSchema.safeParse({ kind: "none", sourceText: "illegal" })
      .success,
    true,
    "Zod strips unknown keys — OpenAI projection must stay stricter",
  );

  // Domain Zod still rejects unknown discriminators (no silent hybrid kind).
  const badKind = structuredClone(candidate) as Record<string, unknown>;
  (badKind.scenes as Array<Record<string, unknown>>)[0]!.spokenContent = {
    kind: "whisper",
    sourceText: "nope",
  };
  assert.equal(StoryboardAnalysisCandidateSchema.safeParse(badKind).success, false);
});

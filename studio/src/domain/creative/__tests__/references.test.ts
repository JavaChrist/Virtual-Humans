import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeReferenceKeywords } from "../normalization";
import { validateReferenceKeywords } from "../validation";

test("mots-clés génériques valides", () => {
  const issues = validateReferenceKeywords(["premium", "minimal", "warm"]);
  assert.equal(issues.length, 0);
});

test("artiste vivant / imitation / provider refusés", () => {
  assert.ok(validateReferenceKeywords(["in the style of beyonce"]).length > 0);
  assert.ok(validateReferenceKeywords(["openai"]).length > 0);
  assert.ok(validateReferenceKeywords(["cinematic-gpt"]).length > 0);
});

test("déduplication et normalisation", () => {
  assert.deepEqual(normalizeReferenceKeywords(["Warm", "warm", "ENERGETIC", "unknown"]), [
    "warm",
    "energetic",
  ]);
});

/**
 * Prompt version participates in Marketing idempotency keys (Porte 7G-B).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { MARKETING_ANALYZER_PROMPT_VERSION } from "@/infrastructure/ai/openai/marketing/prompt";

function buildIdempotencyKey(parts: {
  projectId: string;
  briefRevisionId: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}): string {
  const raw = [
    "mkt",
    parts.projectId,
    parts.briefRevisionId,
    parts.model,
    parts.promptVersion,
    parts.schemaVersion,
  ].join(":");
  return raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
}

test("marketing-analyzer-v2 is the live prompt version", () => {
  assert.equal(MARKETING_ANALYZER_PROMPT_VERSION, "marketing-analyzer-v2");
});

test("idempotency key changes when prompt version changes v1 → v2", () => {
  const base = {
    projectId: "859fde04-5bb0-449a-928f-606616f8b252",
    briefRevisionId: "d8aaca88-bd54-41ab-b9e5-7b654059a4ad",
    model: "gpt-5.6",
    schemaVersion: "1.0.0",
  };
  const k1 = buildIdempotencyKey({ ...base, promptVersion: "marketing-analyzer-v1" });
  const k2 = buildIdempotencyKey({
    ...base,
    promptVersion: MARKETING_ANALYZER_PROMPT_VERSION,
  });
  assert.notEqual(k1, k2);
  assert.match(k2, /marketing-analyzer-v2/);
});

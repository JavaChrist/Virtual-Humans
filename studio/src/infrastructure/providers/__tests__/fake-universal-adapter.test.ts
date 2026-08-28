import assert from "node:assert/strict";
import { test } from "node:test";
import { createUniversalFakeAdapter } from "../fake-universal-adapter";
import type { CanonicalGenerationInput } from "@/domain/generation";

test("fake adapter — métadonnées internes, aucun dataUrl ni URL signée", async () => {
  const adapter = createUniversalFakeAdapter("openai");
  const result = await adapter.submit(
    {
      action: "image",
      modelId: "e2e-fake-deterministic",
    } as CanonicalGenerationInput,
    {
      requestedAt: "2026-08-27T00:00:00.000Z",
      idempotencyKey: "k1",
      correlationId: "corr-fake-adapter",
      timeoutMs: 1_000,
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(result.output?.source.kind, "internal");
  if (result.output?.source.kind === "internal") {
    assert.match(result.output.source.storagePath, /^e2e-fake\/openai\/image\//);
  }
  assert.doesNotMatch(JSON.stringify(result), /dataUrl|data:image|X-Amz-Signature/i);
});

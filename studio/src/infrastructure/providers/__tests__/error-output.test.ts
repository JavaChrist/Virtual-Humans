import assert from "node:assert/strict";
import { test } from "node:test";
import { GenerationDomainError } from "@/domain/generation";
import { mapProviderError } from "../error-mapping";
import { mapCompletedMedia } from "../output-mapping";

test("mapping erreurs HTTP / timeout / abort / unknown non retryable", () => {
  assert.equal(
    mapProviderError(new Error("OpenAI image error (401): no"), { providerId: "openai" })
      .code,
    "unauthorized",
  );
  assert.equal(
    mapProviderError(new Error("rate limit"), { providerId: "fal" }).retryable,
    true,
  );
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.equal(mapProviderError(abort, { providerId: "fal" }).code, "cancelled");
  const unk = mapProviderError(new Error("weird"), { providerId: "fal" });
  assert.equal(unk.code, "unknown");
  assert.equal(unk.retryable, false);
});

test("aucune clé / URL / data-url dans message public", () => {
  const err = mapProviderError(
    new Error("fail sk-abc123Bearer token https://cdn.example/x?sig=1 data:image/png;base64,AAAA"),
    { providerId: "openai" },
  );
  assert.equal(err.publicMessage.includes("sk-"), false);
  assert.equal(err.publicMessage.includes("https://"), false);
  if (err.internalCode) {
    assert.equal(/sk-[a-z0-9]+/i.test(err.internalCode), false);
  }
});

test("sortie image/vidéo/audio — invalide sans média", () => {
  const img = mapCompletedMedia({
    id: "1",
    kind: "image",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,xx",
  });
  assert.equal(img.source.kind, "inline_data_url");
  assert.throws(
    () =>
      mapCompletedMedia({
        id: "2",
        kind: "video",
        mimeType: "video/mp4",
        temporaryUrl: "https://x.com/v.mp4",
      }),
    GenerationDomainError,
  );
});

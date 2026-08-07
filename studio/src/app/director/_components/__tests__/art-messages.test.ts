import assert from "node:assert/strict";
import { test } from "node:test";
import { messageFromArtApiError } from "../art-messages";
import { ART_FAILURE_PUBLIC_MESSAGES } from "@/application/directors/art/failures";

test("Art UI — timeout message Art explicite", () => {
  assert.equal(
    messageFromArtApiError({ error: { code: "timeout" } }),
    ART_FAILURE_PUBLIC_MESSAGES.timeout
  );
  assert.match(
    messageFromArtApiError({ error: { code: "timeout" } }),
    /direction art/i
  );
});

test("Art UI — internal_error ne dit jamais analyse marketing", () => {
  const msg = messageFromArtApiError({ error: { code: "internal_error" } });
  assert.equal(msg, ART_FAILURE_PUBLIC_MESSAGES.internal_error);
  assert.doesNotMatch(msg, /analyse marketing/i);
  assert.match(msg, /direction art/i);
});

test("Art UI — message marketing fuité est remplacé", () => {
  const msg = messageFromArtApiError({
    error: { message: "Erreur interne pendant l’analyse marketing." },
  });
  assert.equal(msg, ART_FAILURE_PUBLIC_MESSAGES.internal_error);
  assert.doesNotMatch(msg, /analyse marketing/i);
});

test("Art UI — string error / fallback", () => {
  assert.equal(
    messageFromArtApiError({ error: "Ancien format" }),
    "Ancien format"
  );
  assert.equal(messageFromArtApiError(null), "Direction art impossible.");
});

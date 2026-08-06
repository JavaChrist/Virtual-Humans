import assert from "node:assert/strict";
import { test } from "node:test";
import { messageFromCreativeApiError } from "../creative-messages";
import { CREATIVE_FAILURE_PUBLIC_MESSAGES } from "@/application/directors/creative/failures";

test("messages Creative — jamais le libellé marketing", () => {
  for (const code of Object.keys(CREATIVE_FAILURE_PUBLIC_MESSAGES)) {
    const msg = messageFromCreativeApiError({ error: { code } });
    assert.match(msg, /créative|créatif|Budget insuffisant/i);
    assert.equal(/marketing/i.test(msg), false);
  }
  assert.equal(
    messageFromCreativeApiError({
      error: { code: "internal_error" },
    }),
    CREATIVE_FAILURE_PUBLIC_MESSAGES.internal_error,
  );
});

test("messages Creative — alignement Marketing (message > code > string)", () => {
  assert.match(
    messageFromCreativeApiError({
      error: {
        code: "invalid_candidate",
        message: "Concept créatif invalide: tableau « assumptions » trop grand (13/12).",
      },
    }),
    /assumptions/,
  );
  assert.equal(
    messageFromCreativeApiError({ error: "Ancien format" }),
    "Ancien format",
  );
  assert.equal(
    messageFromCreativeApiError({ code: "timeout" }),
    CREATIVE_FAILURE_PUBLIC_MESSAGES.timeout,
  );
  assert.equal(messageFromCreativeApiError(null), "Analyse créative impossible.");
});

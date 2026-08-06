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

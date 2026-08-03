import assert from "node:assert/strict";
import { test } from "node:test";
import { messageFromMarketingApiError } from "../marketing-messages";
import { MARKETING_FAILURE_PUBLIC_MESSAGES } from "@/application/directors/marketing/failures";

test("message rate_limited — safe public copy, pas OpenAI", () => {
  const msg = messageFromMarketingApiError({
    status: "failed",
    error: {
      code: "rate_limited",
      retryable: true,
      message: MARKETING_FAILURE_PUBLIC_MESSAGES.rate_limited,
    },
  });
  assert.equal(msg, MARKETING_FAILURE_PUBLIC_MESSAGES.rate_limited);
  assert.equal(msg.includes("OpenAI"), false);
  assert.equal(msg.includes("429"), false);
});

test("fallback code → message public ; string legacy supportée", () => {
  assert.equal(
    messageFromMarketingApiError({ error: { code: "timeout" } }),
    MARKETING_FAILURE_PUBLIC_MESSAGES.timeout
  );
  assert.equal(
    messageFromMarketingApiError({ error: "Ancien format" }),
    "Ancien format"
  );
  assert.equal(
    messageFromMarketingApiError(null),
    "Analyse impossible."
  );
});

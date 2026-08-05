/**
 * Extraction Responses API — fixtures locales (7F-A).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { extractOutputText } from "../extract-output-text";
import { createFetchOpenAIResponsesClient } from "../responses-client";
import { parseMarketingCandidateResponse } from "../marketing/parser";
import {
  candidateJson,
  fixtureConcatenatedOutputText,
  fixtureDoubleEncodedJson,
  fixtureIncomplete,
  fixtureInvalidJson,
  fixtureMessageOutputText,
  fixtureNestedNullOptionals,
  fixtureOpenAiNullOptionals,
  fixtureRefusalInMessage,
  fixtureRootOutputText,
} from "./fixtures/responses-api-variants";
import { OpenAIAiError } from "../errors";
import { normalizeAIUsage } from "../usage";

function toResult(payload: Record<string, unknown>) {
  const { outputText, refusal } = extractOutputText(payload);
  const statusRaw =
    typeof payload.status === "string" ? payload.status : "completed";
  let status: "completed" | "incomplete" | "failed" | "cancelled" = "completed";
  if (statusRaw === "incomplete") status = "incomplete";
  else if (statusRaw === "failed") status = "failed";
  else if (statusRaw === "cancelled") status = "cancelled";
  const incomplete =
    payload.incomplete_details &&
    typeof payload.incomplete_details === "object"
      ? (payload.incomplete_details as { reason?: string }).reason
      : undefined;
  return {
    id: typeof payload.id === "string" ? payload.id : undefined,
    status,
    outputText,
    refusal,
    incompleteReason: incomplete,
    usage: normalizeAIUsage(payload.usage),
  };
}

test("extraction — output_text racine", () => {
  const { outputText, refusal } = extractOutputText(
    fixtureRootOutputText() as unknown as Record<string, unknown>
  );
  assert.ok(outputText?.includes("marketingObjective"));
  assert.equal(refusal, undefined);
});

test("extraction — message output_text (ignore reasoning)", () => {
  const { outputText } = extractOutputText(
    fixtureMessageOutputText() as unknown as Record<string, unknown>
  );
  assert.equal(outputText, candidateJson());
});

test("extraction — concaténation de blocs output_text", () => {
  const { outputText } = extractOutputText(
    fixtureConcatenatedOutputText() as unknown as Record<string, unknown>
  );
  assert.equal(outputText, candidateJson());
});

test("extraction — refusal dans message", () => {
  const { outputText, refusal } = extractOutputText(
    fixtureRefusalInMessage() as unknown as Record<string, unknown>
  );
  assert.equal(outputText, undefined);
  assert.equal(refusal, "policy_refusal_fixture");
});

test("parser — null optionals OpenAI-strict → succès (cause racine 7E)", () => {
  const result = toResult(
    fixtureOpenAiNullOptionals() as unknown as Record<string, unknown>
  );
  const candidate = parseMarketingCandidateResponse(result);
  assert.equal(candidate.marketingObjective, "conversion");
  assert.equal(candidate.notes, undefined);
  assert.equal(candidate.secondaryAudience, undefined);
});

test("parser — null optionals imbriqués → succès", () => {
  const result = toResult(
    fixtureNestedNullOptionals() as unknown as Record<string, unknown>
  );
  const candidate = parseMarketingCandidateResponse(result);
  assert.equal(candidate.assumptions?.[0]?.justification, undefined);
  assert.equal(candidate.claimedEvidence?.[0]?.sourcePath, undefined);
});

test("parser — json invalide → json_parse + obs redacted", () => {
  const result = toResult(
    fixtureInvalidJson() as unknown as Record<string, unknown>
  );
  try {
    parseMarketingCandidateResponse(result);
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof OpenAIAiError);
    assert.equal(e.internalCode, "json_parse");
    assert.equal(e.structuredOutputObs?.category, "json_parse");
    assert.equal(e.structuredOutputObs?.responseStatus, "completed");
    assert.ok(!JSON.stringify(e.structuredOutputObs).includes("RideCloud"));
  }
});

test("parser — JSON doublement encodé → json_string_encoded (pas de 2e parse)", () => {
  const result = toResult(
    fixtureDoubleEncodedJson() as unknown as Record<string, unknown>
  );
  try {
    parseMarketingCandidateResponse(result);
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof OpenAIAiError);
    assert.equal(e.internalCode, "json_string_encoded");
    assert.equal(e.structuredOutputObs?.category, "json_parse");
  }
});

test("parser — incomplete conserve incomplete_reason + usage", () => {
  const result = toResult(
    fixtureIncomplete() as unknown as Record<string, unknown>
  );
  try {
    parseMarketingCandidateResponse(result);
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof OpenAIAiError);
    assert.equal(e.code, "incomplete");
    assert.equal(e.structuredOutputObs?.incompleteReason, "max_output_tokens");
    assert.equal(e.structuredOutputObs?.usage?.inputTokens, 50);
  }
});

test("client fetch — mappe fixture message vers parser succès", async () => {
  const payload = fixtureMessageOutputText();
  const client = createFetchOpenAIResponsesClient({
    apiKey: "sk-test",
    fetchImpl: async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });
  const result = await client.create(
    {
      model: "gpt-5.6",
      instructions: "x",
      input: "y",
      store: false,
      maxOutputTokens: 100,
      textFormat: {
        type: "json_schema",
        name: "marketing_analysis_candidate",
        strict: true,
        schema: { type: "object", properties: {}, additionalProperties: false },
      },
    },
    { correlationId: "corr-extract", timeoutMs: 5_000 }
  );
  const candidate = parseMarketingCandidateResponse(result);
  assert.equal(candidate.marketingObjective, "conversion");
});

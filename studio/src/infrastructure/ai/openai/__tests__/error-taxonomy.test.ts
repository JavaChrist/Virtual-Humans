/**
 * VHS-117D — OpenAI error taxonomy + Retry-After (fakes only).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mapAbortError,
  mapOpenAIHttpError,
  OpenAIAiError,
  parseRetryAfterSeconds,
} from "../errors";
import { createFetchOpenAIResponsesClient } from "../responses-client";
import { mapOpenAIAiErrorToMarketingFailure } from "../marketing/map-to-analyzer-failure";
import { MarketingAnalyzerError } from "@/application/directors/marketing/failures";
import { createOpenAIMarketingAnalyzerAdapter } from "../marketing/adapter";
import { parseOpenAIMarketingConfig } from "../config";
import { makeBrief } from "@/domain/marketing/__tests__/fixtures";

const enabledEnv = {
  DIRECTOR_V2_MARKETING_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test-key",
  OPENAI_MARKETING_MODEL: "gpt-5.6-terra",
};

test("HTTP 429 → rate_limited retryable + Retry-After valide", () => {
  const err = mapOpenAIHttpError(429, "rate_limit_exceeded", {
    retryAfterHeader: "42",
  });
  assert.equal(err.code, "rate_limited");
  assert.equal(err.retryable, true);
  assert.equal(err.httpStatus, 429);
  assert.equal(err.retryAfterSeconds, 42);
  const mapped = mapOpenAIAiErrorToMarketingFailure(err);
  assert.equal(mapped.code, "rate_limited");
  assert.equal(mapped.retryable, true);
  assert.equal(mapped.retryAfterSeconds, 42);
  assert.equal(mapped.provider, "openai");
});

test("Retry-After invalide ou excessif ignoré", () => {
  assert.equal(parseRetryAfterSeconds("abc"), undefined);
  assert.equal(parseRetryAfterSeconds("0"), undefined);
  assert.equal(parseRetryAfterSeconds("-1"), undefined);
  assert.equal(parseRetryAfterSeconds("99999"), undefined);
  assert.equal(parseRetryAfterSeconds("Wed, 21 Oct 2015 07:28:00 GMT"), undefined);
  const err = mapOpenAIHttpError(429, undefined, {
    retryAfterHeader: "99999",
  });
  assert.equal(err.code, "rate_limited");
  assert.equal(err.retryAfterSeconds, undefined);
});

test("timeout → timeout retryable", () => {
  const timeout = mapAbortError(
    Object.assign(new Error("timeout"), { name: "AbortError" })
  );
  assert.equal(timeout.code, "timeout");
  assert.equal(timeout.retryable, true);
  assert.equal(mapOpenAIAiErrorToMarketingFailure(timeout).code, "timeout");
});

test("Node undici abort(Error('timeout')) → timeout (not internal_error)", () => {
  // Real Node fetch rejection shape after controller.abort(new Error("timeout")).
  const nodeTimeout = mapAbortError(new Error("timeout"));
  assert.equal(nodeTimeout.code, "timeout");
  assert.equal(nodeTimeout.retryable, true);
  assert.equal(mapOpenAIAiErrorToMarketingFailure(nodeTimeout).code, "timeout");
  assert.notEqual(
    mapOpenAIAiErrorToMarketingFailure(nodeTimeout).code,
    "internal_error"
  );
});

test("unknown transport stays internal_error", () => {
  const unknown = mapAbortError(new Error("ECONNRESET"));
  assert.equal(unknown.code, "unknown");
  assert.equal(mapOpenAIAiErrorToMarketingFailure(unknown).code, "internal_error");
});

test("401 → unauthorized non retryable ; 403 → forbidden", () => {
  const u = mapOpenAIHttpError(401);
  assert.equal(u.code, "unauthorized");
  assert.equal(u.retryable, false);
  assert.equal(mapOpenAIAiErrorToMarketingFailure(u).code, "unauthorized");

  const f = mapOpenAIHttpError(403);
  assert.equal(f.code, "forbidden");
  assert.equal(f.retryable, false);
  assert.equal(mapOpenAIAiErrorToMarketingFailure(f).code, "forbidden");
});

test("5xx → provider_unavailable retryable", () => {
  const err = mapOpenAIHttpError(503);
  assert.equal(err.code, "provider_unavailable");
  assert.equal(err.retryable, true);
  assert.equal(
    mapOpenAIAiErrorToMarketingFailure(err).code,
    "provider_unavailable"
  );
});

test("400 invalid_json_schema → structured_output_unsupported → request_failed", () => {
  const err = mapOpenAIHttpError(400, "invalid_json_schema", {
    providerErrorType: "invalid_request_error",
    providerRequestId: "req_diag_schema",
  });
  assert.equal(err.code, "structured_output_unsupported");
  assert.equal(err.httpStatus, 400);
  assert.equal(err.providerObs?.providerRequestId, "req_diag_schema");
  const mapped = mapOpenAIAiErrorToMarketingFailure(err);
  assert.equal(mapped.code, "request_failed");
  assert.equal(mapped.retryable, false);
  assert.equal(mapped.httpStatus, 400);
});

test("400 invalid_request_error (generic) → invalid_request → request_failed", () => {
  const err = mapOpenAIHttpError(400, "invalid_request_error", {
    providerErrorType: "invalid_request_error",
  });
  assert.equal(err.code, "invalid_request");
  assert.equal(mapOpenAIAiErrorToMarketingFailure(err).code, "request_failed");
});

test("refused / incomplete / empty / invalid_structured_output mapping", () => {
  assert.equal(
    mapOpenAIAiErrorToMarketingFailure(new OpenAIAiError("refused")).code,
    "refused"
  );
  const incomplete = new OpenAIAiError("incomplete");
  assert.equal(incomplete.retryable, false);
  assert.equal(
    mapOpenAIAiErrorToMarketingFailure(incomplete).code,
    "incomplete"
  );
  assert.equal(
    mapOpenAIAiErrorToMarketingFailure(incomplete).retryable,
    false
  );
  assert.equal(
    mapOpenAIAiErrorToMarketingFailure(new OpenAIAiError("empty_output")).code,
    "empty_response"
  );
  assert.equal(
    mapOpenAIAiErrorToMarketingFailure(
      new OpenAIAiError("invalid_structured_output")
    ).code,
    "invalid_structured_output"
  );
});

test("responses client propage Retry-After 429 sans fuite body", async () => {
  const client = createFetchOpenAIResponsesClient({
    apiKey: "sk-test",
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "sk-secret" } }), {
        status: 429,
        headers: { "Retry-After": "15" },
      }),
  });
  await assert.rejects(
    () =>
      client.create(
        {
          model: "m",
          instructions: "i",
          input: "u",
          store: false,
          maxOutputTokens: 100,
          textFormat: {
            type: "json_schema",
            name: "t",
            strict: true,
            schema: { type: "object", properties: {}, additionalProperties: false },
          },
        },
        { correlationId: "c", timeoutMs: 1000 }
      ),
    (e: unknown) => {
      assert.ok(e instanceof OpenAIAiError);
      assert.equal(e.code, "rate_limited");
      assert.equal(e.retryAfterSeconds, 15);
      assert.equal(e.message.includes("sk-secret"), false);
      assert.equal(JSON.stringify(e).includes("sk-secret"), false);
      return true;
    }
  );
});

test("adapter — 429 → MarketingAnalyzerError rate_limited, un seul appel", async () => {
  let calls = 0;
  const adapter = createOpenAIMarketingAnalyzerAdapter({
    client: {
      async create() {
        calls += 1;
        throw mapOpenAIHttpError(429, "rate_limit_exceeded", {
          retryAfterHeader: "30",
        });
      },
    },
    env: enabledEnv,
    config: parseOpenAIMarketingConfig(enabledEnv),
  });
  await assert.rejects(
    () =>
      adapter.analyze(
        { brief: makeBrief() },
        { correlationId: "corr-rl", mode: "execute" }
      ),
    (e: unknown) => {
      assert.ok(e instanceof MarketingAnalyzerError);
      assert.equal(e.failure.code, "rate_limited");
      assert.equal(e.failure.retryable, true);
      assert.equal(e.failure.retryAfterSeconds, 30);
      assert.equal(e.failure.publicMessage.includes("OpenAI"), false);
      assert.equal(JSON.stringify(e.failure).includes("sk-"), false);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test("aucune donnée sensible dans erreurs mappées", () => {
  const err = new OpenAIAiError("rate_limited", {
    internalCode: "http_429",
    httpStatus: 429,
  });
  const f = mapOpenAIAiErrorToMarketingFailure(err);
  const blob = JSON.stringify(f);
  assert.equal(blob.includes("Authorization"), false);
  assert.equal(blob.includes("sk-"), false);
  assert.equal(blob.includes("prompt"), false);
  assert.equal(f.publicMessage.includes("OpenAI"), false);
});

test("VHS-128 — 429 rate_limit_exceeded ≠ insufficient_quota", () => {
  const rl = mapOpenAIHttpError(429, "rate_limit_exceeded", {
    retryAfterHeader: "10",
    providerRequestId: "req_abc123",
    rateLimitRemainingRequests: "0",
  });
  assert.equal(rl.code, "rate_limited");
  assert.equal(rl.retryable, true);
  assert.equal(rl.providerObs?.providerRequestId, "req_abc123");
  assert.equal(mapOpenAIAiErrorToMarketingFailure(rl).code, "rate_limited");

  const quota = mapOpenAIHttpError(429, "insufficient_quota", {
    providerErrorType: "insufficient_quota",
  });
  assert.equal(quota.code, "quota_exceeded");
  assert.equal(quota.retryable, false);
  assert.equal(mapOpenAIAiErrorToMarketingFailure(quota).code, "quota_exceeded");
  assert.equal(mapOpenAIAiErrorToMarketingFailure(quota).retryable, false);
});

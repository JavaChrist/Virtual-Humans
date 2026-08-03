import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_OPENAI_MARKETING_MODEL,
  openAIMarketingConfigSnapshot,
  parseOpenAIMarketingConfig,
} from "../config";
import { OpenAIAiError } from "../errors";
import { createFetchOpenAIResponsesClient } from "../responses-client";
import { deriveSafetyIdentifier } from "../safety-identifier";
import { toOpenAIStrictJsonSchema } from "../structured-output";
import { normalizeAIUsage, usageConsistencyWarning } from "../usage";

test("config — defaults + no key exposure", () => {
  const cfg = parseOpenAIMarketingConfig({
    OPENAI_API_KEY: "sk-test-secret-value-not-in-snapshot",
  });
  assert.equal(cfg.model, DEFAULT_OPENAI_MARKETING_MODEL);
  assert.equal(cfg.reasoningEffort, "low");
  assert.equal(cfg.maxOutputTokens, 4096);
  const snap = openAIMarketingConfigSnapshot(cfg);
  assert.equal(snap.apiKeyPresent, true);
  assert.equal(JSON.stringify(snap).includes("sk-test"), false);
});

test("config — invalid effort / tokens / model", () => {
  assert.throws(
    () =>
      parseOpenAIMarketingConfig({
        OPENAI_MARKETING_REASONING_EFFORT: "turbo",
      }),
    OpenAIAiError
  );
  assert.throws(
    () =>
      parseOpenAIMarketingConfig({
        OPENAI_MARKETING_MAX_OUTPUT_TOKENS: "10",
      }),
    OpenAIAiError
  );
  assert.throws(
    () =>
      parseOpenAIMarketingConfig({
        OPENAI_MARKETING_MODEL: "bad model!",
      }),
    OpenAIAiError
  );
});

test("usage — never invents missing fields", () => {
  assert.equal(normalizeAIUsage(null), undefined);
  const u = normalizeAIUsage({
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    input_tokens_details: { cached_tokens: 2 },
    output_tokens_details: { reasoning_tokens: 1 },
  });
  assert.deepEqual(u, {
    inputTokens: 10,
    cachedInputTokens: 2,
    outputTokens: 5,
    reasoningTokens: 1,
    totalTokens: 15,
  });
  assert.equal(usageConsistencyWarning(u!), undefined);
});

test("safety identifier — stable HMAC, not raw workspace", () => {
  const ws = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const a = deriveSafetyIdentifier({
    workspaceId: ws,
    secret: "super-secret-salt-value",
  });
  const b = deriveSafetyIdentifier({
    workspaceId: ws,
    secret: "super-secret-salt-value",
  });
  assert.ok(a);
  assert.equal(a, b);
  assert.notEqual(a, ws);
  assert.equal(
    deriveSafetyIdentifier({ workspaceId: ws, secret: undefined }),
    undefined
  );
});

test("strict schema — optionals become required nullable", () => {
  const strict = toOpenAIStrictJsonSchema({
    type: "object",
    properties: {
      a: { type: "string" },
      b: { type: "string" },
    },
    required: ["a"],
    additionalProperties: true,
  });
  assert.equal(strict.additionalProperties, false);
  assert.deepEqual(strict.required, ["a", "b"]);
  const b = (strict.properties as Record<string, unknown>).b as {
    anyOf: unknown[];
  };
  assert.ok(Array.isArray(b.anyOf));
});

test("responses client — store false, no tools, one call, structured format", async () => {
  let calls = 0;
  let body: Record<string, unknown> = {};
  const client = createFetchOpenAIResponsesClient({
    apiKey: "sk-test",
    fetchImpl: async (_url, init) => {
      calls += 1;
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "resp_1",
          status: "completed",
          output_text: '{"ok":true}',
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    },
  });

  const result = await client.create(
    {
      model: "gpt-5.6-terra",
      instructions: "sys",
      input: "user",
      store: false,
      maxOutputTokens: 512,
      reasoningEffort: "low",
      textFormat: {
        type: "json_schema",
        name: "test",
        strict: true,
        schema: { type: "object", properties: {}, additionalProperties: false },
      },
      safetyIdentifier: "abc",
    },
    { correlationId: "corr-client-1", timeoutMs: 5000 }
  );

  assert.equal(calls, 1);
  assert.equal(body.store, false);
  assert.equal(body.tools, undefined);
  assert.equal(body.previous_response_id, undefined);
  assert.equal((body.reasoning as { effort: string }).effort, "low");
  assert.equal(body.safety_identifier, "abc");
  assert.equal(
    (body.text as { format: { type: string } }).format.type,
    "json_schema"
  );
  assert.equal(result.status, "completed");
  assert.equal(result.outputText, '{"ok":true}');
});

test("responses client — 429 / timeout mapped", async () => {
  const rate = createFetchOpenAIResponsesClient({
    apiKey: "sk-test",
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), {
        status: 429,
      }),
  });
  await assert.rejects(
    () =>
      rate.create(
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
    (e: unknown) => e instanceof OpenAIAiError && e.code === "rate_limited"
  );
});

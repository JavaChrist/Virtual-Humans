/**
 * 8G-A — synthetic Responses fixtures for Creative parser/adapter path (no network).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MarketingAnalyzerError } from "@/application/directors/marketing/failures";
import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "@/domain/creative/__tests__/fixtures";
import type { OpenAIResponseResult } from "../../contracts";
import { OpenAIAiError } from "../../errors";
import { parseOpenAICreativeConfig } from "../../config";
import { createUnknownAiTokenPricing } from "../../marketing/pricing";
import {
  createOpenAICreativeAnalyzerAdapter,
  parseCreativeCandidateResponse,
} from "../index";

const enabledEnv = {
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test-key",
  OPENAI_CREATIVE_MODEL: "gpt-5.6-terra",
  OPENAI_CREATIVE_REASONING_EFFORT: "medium",
  OPENAI_CREATIVE_MAX_OUTPUT_TOKENS: "4096",
  DIRECTOR_V2_WORKSPACE_ID: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  OPENAI_SAFETY_IDENTIFIER_SECRET: "safety-salt-at-least-8",
};

const CASES: Array<{
  name: string;
  result: OpenAIResponseResult;
  openaiCode: string;
  failureCode: string;
}> = [
  {
    name: "incomplete max_output_tokens",
    result: {
      id: "resp_incomplete_1",
      status: "incomplete",
      incompleteReason: "max_output_tokens",
      usage: {
        inputTokens: 1400,
        outputTokens: 4096,
        totalTokens: 5496,
        reasoningTokens: 3800,
      },
    },
    openaiCode: "incomplete",
    failureCode: "incomplete",
  },
  {
    name: "refusal",
    result: {
      id: "resp_refuse_1",
      status: "completed",
      refusal: "declined",
      usage: { inputTokens: 10, outputTokens: 1, totalTokens: 11 },
    },
    openaiCode: "refused",
    failureCode: "refused",
  },
  {
    name: "empty output",
    result: {
      id: "resp_empty_1",
      status: "completed",
      outputText: "   ",
      usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
    },
    openaiCode: "empty_output",
    failureCode: "empty_response",
  },
  {
    name: "json parse",
    result: {
      id: "resp_json_1",
      status: "completed",
      outputText: "{broken",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
    openaiCode: "invalid_structured_output",
    failureCode: "invalid_structured_output",
  },
  {
    name: "zod validation",
    result: {
      id: "resp_zod_1",
      status: "completed",
      outputText: JSON.stringify({ title: "x" }),
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
    openaiCode: "invalid_structured_output",
    failureCode: "invalid_structured_output",
  },
  {
    name: "response failed / content filter",
    result: {
      id: "resp_fail_1",
      status: "failed",
      rawErrorCode: "content_filter",
      usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
    },
    openaiCode: "content_filtered",
    failureCode: "refused",
  },
];

test("parser fixtures — codes + obs redacted", () => {
  for (const c of CASES) {
    assert.throws(
      () => parseCreativeCandidateResponse(c.result),
      (e: unknown) => {
        assert.ok(e instanceof OpenAIAiError, c.name);
        assert.equal(e.code, c.openaiCode, c.name);
        assert.ok(e.structuredOutputObs?.category, c.name);
        if (c.result.incompleteReason) {
          assert.equal(
            e.structuredOutputObs?.incompleteReason,
            c.result.incompleteReason,
            c.name,
          );
        }
        const blob = JSON.stringify(e.structuredOutputObs);
        assert.equal(blob.includes("declined"), false, c.name);
        return true;
      },
    );
  }
  const ok = parseCreativeCandidateResponse({
    status: "completed",
    outputText: JSON.stringify(makeValidCreativeCandidate()),
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
  });
  assert.ok(ok.title.length > 0);
});

test("adapter fixtures — taxonomie Creative + metering conservé + retryable false", async () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);

  for (const c of CASES) {
    const adapter = createOpenAICreativeAnalyzerAdapter({
      client: {
        async create() {
          return c.result;
        },
      },
      env: enabledEnv,
      config: parseOpenAICreativeConfig(enabledEnv),
      pricing: createUnknownAiTokenPricing(),
    });
    await assert.rejects(
      () =>
        adapter.analyze(
          { brief, marketingPlan: plan },
          { correlationId: `corr-${c.name}`, mode: "execute" },
        ),
      (e: unknown) => {
        assert.ok(e instanceof MarketingAnalyzerError, c.name);
        assert.equal(e.failure.code, c.failureCode, c.name);
        assert.equal(e.failure.retryable, false, c.name);
        assert.notEqual(e.failure.code, "internal_error", c.name);
        assert.match(e.failure.publicMessage, /créative|créatif/i, c.name);
        assert.equal(/marketing/i.test(e.failure.publicMessage), false, c.name);
        if (c.result.usage?.totalTokens != null) {
          assert.equal(
            e.metering?.usage?.totalTokens,
            c.result.usage.totalTokens,
            c.name,
          );
        }
        return true;
      },
    );
  }
});

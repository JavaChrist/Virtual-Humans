/**
 * 8G-B — next Creative failure must emit redacted technical obs (no secrets/payload).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeCreativeBrief, makeMarketingPlan } from "@/domain/creative/__tests__/fixtures";
import { MarketingAnalyzerError } from "@/application/directors/marketing/failures";
import { logger } from "@/infrastructure/observability";
import { createOpenAICreativeAnalyzerAdapter } from "../adapter";
import { parseOpenAICreativeConfig } from "../../config";
import { createUnknownAiTokenPricing } from "../../marketing/pricing";
import type { OpenAIResponsesClientPort, OpenAIResponseResult } from "../../contracts";
import { CREATIVE_ANALYZER_PROMPT_VERSION } from "../prompt";
import { CREATIVE_CANDIDATE_SCHEMA_VERSION } from "../schema";

const enabledEnv = {
  DIRECTOR_V2_CREATIVE_AI_ENABLED: "1",
  DIRECTOR_V2_PAID_AI_ENABLED: "1",
  OPENAI_API_KEY: "sk-test-not-real",
  OPENAI_CREATIVE_MODEL: "gpt-5.6",
  OPENAI_CREATIVE_REASONING_EFFORT: "medium",
  OPENAI_CREATIVE_MAX_OUTPUT_TOKENS: "4096",
};

function fakeClient(
  impl: () => Promise<OpenAIResponseResult>
): OpenAIResponsesClientPort {
  return {
    async create() {
      return impl();
    },
  };
}

test("8G-B — failed log exposes redacted taxonomy fields, never payload/prompt/key", async () => {
  const brief = makeCreativeBrief();
  const plan = makeMarketingPlan(brief);
  const infoCalls: Array<{ event: string; data: Record<string, unknown> }> = [];
  const origInfo = logger.info.bind(logger);
  logger.info = ((event: string, _ctx: unknown, data?: Record<string, unknown>) => {
    infoCalls.push({ event, data: data ?? {} });
  }) as typeof logger.info;

  try {
    const adapter = createOpenAICreativeAnalyzerAdapter({
      client: fakeClient(async () => ({
        id: "resp_diag_8gb",
        status: "incomplete",
        incompleteReason: "max_output_tokens",
        usage: {
          inputTokens: 120,
          outputTokens: 4000,
          totalTokens: 4120,
          reasoningTokens: 3800,
        },
      })),
      env: enabledEnv,
      config: parseOpenAICreativeConfig(enabledEnv),
      pricing: createUnknownAiTokenPricing(),
    });

    await assert.rejects(
      () =>
        adapter.analyze(
          { brief, marketingPlan: plan },
          { correlationId: "corr-obs-8gb", mode: "execute" }
        ),
      (e: unknown) => e instanceof MarketingAnalyzerError && e.failure.code === "incomplete"
    );

    const failed = infoCalls.find((c) => c.event === "creative.ai.request.failed");
    assert.ok(failed, "creative.ai.request.failed must be logged");
    const d = failed.data;
    assert.equal(d.failureCode, "incomplete");
    assert.equal(d.incompleteReason, "max_output_tokens");
    assert.equal(d.responseStatus, "incomplete");
    assert.equal(d.structuredOutputCategory, "incomplete");
    assert.equal(d.providerRequestId, "resp_diag_8gb");
    assert.equal(d.promptVersion, CREATIVE_ANALYZER_PROMPT_VERSION);
    assert.equal(d.schemaVersion, CREATIVE_CANDIDATE_SCHEMA_VERSION);
    assert.equal(d.retryable, false);
    assert.equal(d.inputTokens, 120);
    assert.equal(d.outputTokens, 4000);
    assert.equal(d.reasoningTokens, 3800);

    const blob = JSON.stringify(infoCalls);
    assert.equal(/sk-test|api[_ ]?key|system prompt|bigIdea|Picasso/i.test(blob), false);
    assert.equal(CREATIVE_ANALYZER_PROMPT_VERSION, "creative-analyzer-v4");
    assert.equal(CREATIVE_CANDIDATE_SCHEMA_VERSION, "1.1.0");
  } finally {
    logger.info = origInfo;
  }
});

test("8H-A — v4 idempotency material distinct from v1/v2/v3", () => {
  const v1 = "creative-analyzer-v1";
  const v2 = "creative-analyzer-v2";
  const v3 = "creative-analyzer-v3";
  const v4 = CREATIVE_ANALYZER_PROMPT_VERSION;
  assert.equal(v4, "creative-analyzer-v4");
  assert.equal(CREATIVE_CANDIDATE_SCHEMA_VERSION, "1.1.0");
  assert.notEqual(v4, v1);
  assert.notEqual(v4, v2);
  assert.notEqual(v4, v3);
  const keyFor = (promptVersion: string, schemaVersion: string) =>
    [
      "cre",
      "proj",
      "brief",
      "1",
      "plan",
      "1",
      "gpt-5.6",
      promptVersion,
      schemaVersion,
    ].join(":");
  assert.notEqual(keyFor(v4, "1.1.0"), keyFor(v1, "1.0.0"));
  assert.notEqual(keyFor(v4, "1.1.0"), keyFor(v2, "1.0.0"));
  assert.notEqual(keyFor(v4, "1.1.0"), keyFor(v3, "1.0.0"));
});

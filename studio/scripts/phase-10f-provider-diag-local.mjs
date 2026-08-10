/**
 * Phase 10F-PROVIDER-DIAG — local offline request metadata (no network).
 */
import { Buffer } from "node:buffer";
import {
  getStoryboardCandidateJsonSchema,
  getStoryboardCandidateTextFormat,
} from "../src/infrastructure/ai/openai/storyboard/schema.ts";
import { STORYBOARD_ANALYZER_SYSTEM_PROMPT } from "../src/infrastructure/ai/openai/storyboard/prompt.ts";
import {
  approximateStoryboardTokenCount,
  mapStoryboardAnalysisRequest,
} from "../src/infrastructure/ai/openai/storyboard/mapping.ts";
import { makeStoryboardChain } from "../src/domain/storyboard/__tests__/fixtures.ts";
import { parseOpenAIStoryboardConfig } from "../src/infrastructure/ai/openai/config.ts";

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function walkIssues(node, path, issues) {
  if (!isPlainObject(node) && !Array.isArray(node)) return;
  if (Array.isArray(node)) {
    node.forEach((n, i) => walkIssues(n, `${path}[${i}]`, issues));
    return;
  }
  if (Object.prototype.hasOwnProperty.call(node, "$ref")) {
    issues.push({ path, issue: "has_ref" });
  }
  if (node.oneOf) issues.push({ path, issue: "has_oneOf" });
  if (
    (node.type === "object" || node.properties) &&
    node.additionalProperties !== false
  ) {
    issues.push({ path, issue: "object_missing_additionalProperties_false" });
  }
  if (node.properties && isPlainObject(node.properties)) {
    for (const [k, v] of Object.entries(node.properties)) {
      walkIssues(v, `${path}.${k}`, issues);
    }
  }
  if (node.items) walkIssues(node.items, `${path}.items`, issues);
  if (Array.isArray(node.anyOf)) {
    node.anyOf.forEach((n, i) => walkIssues(n, `${path}.anyOf[${i}]`, issues));
  }
  if (Array.isArray(node.oneOf)) {
    node.oneOf.forEach((n, i) => walkIssues(n, `${path}.oneOf[${i}]`, issues));
  }
}

const schema = getStoryboardCandidateJsonSchema();
const fmt = getStoryboardCandidateTextFormat();
const chain = makeStoryboardChain();
const mapped = mapStoryboardAnalysisRequest(chain);
const cfg = parseOpenAIStoryboardConfig({
  OPENAI_API_KEY: "sk-diag-placeholder",
  OPENAI_STORYBOARD_MODEL: "gpt-5.6",
  OPENAI_STORYBOARD_REASONING_EFFORT: "medium",
  OPENAI_STORYBOARD_MAX_OUTPUT_TOKENS: "4096",
  OPENAI_STORYBOARD_REQUIRE_PRICING: "1",
});

const body = {
  model: cfg.model,
  instructions: STORYBOARD_ANALYZER_SYSTEM_PROMPT,
  input: mapped.userMessage,
  store: false,
  max_output_tokens: cfg.maxOutputTokens,
  reasoning: { effort: cfg.reasoningEffort },
  text: {
    format: {
      type: "json_schema",
      name: fmt.name,
      strict: true,
      schema: fmt.schema,
    },
  },
};

const issues = [];
walkIssues(schema, "root", issues);

const report = {
  phase: "10F-PROVIDER-DIAG",
  mode: "offline-metadata",
  endpoint: "POST https://api.openai.com/v1/responses",
  model: cfg.model,
  reasoningEffort: cfg.reasoningEffort,
  maxOutputTokens: cfg.maxOutputTokens,
  timeoutMs: cfg.timeoutMs,
  schemaName: fmt.name,
  schemaBytes: Buffer.byteLength(JSON.stringify(fmt.schema), "utf8"),
  systemPromptBytes: Buffer.byteLength(STORYBOARD_ANALYZER_SYSTEM_PROMPT, "utf8"),
  inputBytesFixture: Buffer.byteLength(mapped.userMessage, "utf8"),
  approxInputTokensFixture: approximateStoryboardTokenCount(mapped.userMessage),
  bodyBytesFixture: Buffer.byteLength(JSON.stringify(body), "utf8"),
  blockingFindings: mapped.blockingFindings.length,
  schemaIssueCount: issues.length,
  schemaIssuesSample: issues.slice(0, 20),
  network: false,
};

console.log(JSON.stringify(report, null, 2));

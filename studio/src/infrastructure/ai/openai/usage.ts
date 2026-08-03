/**
 * Normalize Responses API usage — never invent tokens (VHS-117A).
 */

import type { AIUsage } from "./contracts";

function asNonNegInt(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
    return undefined;
  }
  return v;
}

/**
 * Extract usage from a Responses API payload shape.
 * Absent fields stay undefined. No inferred totals.
 */
export function normalizeAIUsage(raw: unknown): AIUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const u = raw as Record<string, unknown>;
  const input =
    asNonNegInt(u.input_tokens) ??
    asNonNegInt(u.prompt_tokens) ??
    asNonNegInt(u.inputTokens);
  const output =
    asNonNegInt(u.output_tokens) ??
    asNonNegInt(u.completion_tokens) ??
    asNonNegInt(u.outputTokens);
  const total = asNonNegInt(u.total_tokens) ?? asNonNegInt(u.totalTokens);

  let cachedInput: number | undefined;
  let reasoning: number | undefined;
  const details = u.input_tokens_details;
  if (details && typeof details === "object") {
    cachedInput = asNonNegInt((details as Record<string, unknown>).cached_tokens);
  }
  cachedInput =
    cachedInput ??
    asNonNegInt(u.cached_input_tokens) ??
    asNonNegInt(u.cachedInputTokens);

  const outDetails = u.output_tokens_details;
  if (outDetails && typeof outDetails === "object") {
    reasoning = asNonNegInt((outDetails as Record<string, unknown>).reasoning_tokens);
  }
  reasoning =
    reasoning ??
    asNonNegInt(u.reasoning_tokens) ??
    asNonNegInt(u.reasoningTokens);

  if (
    input === undefined &&
    output === undefined &&
    total === undefined &&
    cachedInput === undefined &&
    reasoning === undefined
  ) {
    return undefined;
  }

  const usage: AIUsage = {};
  if (input !== undefined) usage.inputTokens = input;
  if (cachedInput !== undefined) usage.cachedInputTokens = cachedInput;
  if (output !== undefined) usage.outputTokens = output;
  if (reasoning !== undefined) usage.reasoningTokens = reasoning;
  if (total !== undefined) usage.totalTokens = total;
  return usage;
}

/** Soft consistency check — does not invent missing fields. */
export function usageConsistencyWarning(usage: AIUsage): string | undefined {
  if (
    usage.totalTokens != null &&
    usage.inputTokens != null &&
    usage.outputTokens != null
  ) {
    const sum = usage.inputTokens + usage.outputTokens;
    if (usage.totalTokens < sum) {
      return "usage_total_lt_parts";
    }
  }
  if (
    usage.cachedInputTokens != null &&
    usage.inputTokens != null &&
    usage.cachedInputTokens > usage.inputTokens
  ) {
    return "cached_gt_input";
  }
  return undefined;
}

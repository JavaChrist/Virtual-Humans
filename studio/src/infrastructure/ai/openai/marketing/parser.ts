/**
 * Parse untrusted Responses output into MarketingAnalysisCandidate (VHS-117A / 7F-A).
 * Never finalizes a MarketingPlan. Never logs brief/response bodies.
 */

import {
  MarketingAnalysisCandidateSchema,
  normalizeMarketingCandidate,
  type MarketingAnalysisCandidate,
} from "@/domain/marketing";
import type { OpenAIResponseResult } from "../contracts";
import {
  OpenAIAiError,
  type OpenAIStructuredOutputObs,
} from "../errors";

function usageObs(
  result: OpenAIResponseResult
): OpenAIStructuredOutputObs["usage"] {
  if (!result.usage) return undefined;
  return {
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    totalTokens: result.usage.totalTokens,
    reasoningTokens: result.usage.reasoningTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
  };
}

function baseObs(
  result: OpenAIResponseResult,
  category: OpenAIStructuredOutputObs["category"]
): OpenAIStructuredOutputObs {
  return {
    category,
    responseStatus: result.status,
    incompleteReason: result.incompleteReason,
    usage: usageObs(result),
    providerRequestId: result.id,
  };
}

function zodObsFromIssues(
  result: OpenAIResponseResult,
  issues: ReadonlyArray<{
    path: PropertyKey[];
    code: string;
    expected?: unknown;
    received?: unknown;
  }>
): OpenAIStructuredOutputObs {
  const zodPaths: string[] = [];
  const zodCodes: string[] = [];
  const zodTypeMismatches: NonNullable<
    OpenAIStructuredOutputObs["zodTypeMismatches"]
  > = [];
  for (const issue of issues.slice(0, 24)) {
    const path = issue.path.map(String).join(".");
    zodPaths.push(path || "(root)");
    zodCodes.push(String(issue.code));
    if (issue.code === "invalid_type") {
      zodTypeMismatches.push({
        path: path || "(root)",
        expected:
          typeof issue.expected === "string" ? issue.expected : undefined,
        received:
          typeof issue.received === "string" ? issue.received : undefined,
      });
    }
  }
  return {
    ...baseObs(result, "zod_validation"),
    zodPaths,
    zodCodes,
    zodTypeMismatches: zodTypeMismatches.length
      ? zodTypeMismatches
      : undefined,
  };
}

export function parseMarketingCandidateResponse(
  result: OpenAIResponseResult
): MarketingAnalysisCandidate {
  if (result.refusal?.trim()) {
    throw new OpenAIAiError("refused", {
      internalCode: "model_refusal",
      structuredOutputObs: baseObs(result, "refused"),
    });
  }
  if (result.status === "incomplete") {
    throw new OpenAIAiError("incomplete", {
      internalCode: result.incompleteReason ?? "incomplete",
      structuredOutputObs: baseObs(result, "incomplete"),
    });
  }
  if (result.status === "cancelled") {
    throw new OpenAIAiError("cancelled", {
      structuredOutputObs: baseObs(result, "other"),
    });
  }
  if (result.status === "failed") {
    if (/content[_ ]?filter|policy/i.test(result.rawErrorCode ?? "")) {
      throw new OpenAIAiError("content_filtered", {
        internalCode: result.rawErrorCode,
        structuredOutputObs: baseObs(result, "other"),
      });
    }
    throw new OpenAIAiError("provider_unavailable", {
      internalCode: result.rawErrorCode ?? "failed",
      structuredOutputObs: baseObs(result, "other"),
    });
  }

  const text = result.outputText?.trim();
  if (!text) {
    throw new OpenAIAiError("empty_output", {
      structuredOutputObs: baseObs(result, "empty_output"),
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OpenAIAiError("invalid_structured_output", {
      internalCode: "json_parse",
      structuredOutputObs: baseObs(result, "json_parse"),
    });
  }

  // Detect double-encoded JSON (string after one parse) without a second accept path.
  if (typeof parsed === "string") {
    throw new OpenAIAiError("invalid_structured_output", {
      internalCode: "json_string_encoded",
      structuredOutputObs: {
        ...baseObs(result, "json_parse"),
        category: "json_parse",
        zodPaths: ["(root)"],
        zodCodes: ["json_string_encoded"],
        zodTypeMismatches: [
          { path: "(root)", expected: "object", received: "string" },
        ],
      },
    });
  }

  const zod = MarketingAnalysisCandidateSchema.safeParse(parsed);
  if (!zod.success) {
    throw new OpenAIAiError("invalid_structured_output", {
      internalCode: "zod_validation",
      structuredOutputObs: zodObsFromIssues(result, zod.error.issues),
    });
  }

  return normalizeMarketingCandidate(zod.data);
}

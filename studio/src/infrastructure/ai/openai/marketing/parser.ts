/**
 * Parse untrusted Responses output into MarketingAnalysisCandidate (VHS-117A).
 * Never finalizes a MarketingPlan.
 */

import {
  MarketingAnalysisCandidateSchema,
  normalizeMarketingCandidate,
  type MarketingAnalysisCandidate,
} from "@/domain/marketing";
import type { OpenAIResponseResult } from "../contracts";
import { OpenAIAiError } from "../errors";

export function parseMarketingCandidateResponse(
  result: OpenAIResponseResult
): MarketingAnalysisCandidate {
  if (result.refusal?.trim()) {
    throw new OpenAIAiError("refused", { internalCode: "model_refusal" });
  }
  if (result.status === "incomplete") {
    throw new OpenAIAiError("incomplete", {
      internalCode: result.incompleteReason ?? "incomplete",
    });
  }
  if (result.status === "cancelled") {
    throw new OpenAIAiError("cancelled");
  }
  if (result.status === "failed") {
    if (/content[_ ]?filter|policy/i.test(result.rawErrorCode ?? "")) {
      throw new OpenAIAiError("content_filtered", {
        internalCode: result.rawErrorCode,
      });
    }
    throw new OpenAIAiError("provider_unavailable", {
      internalCode: result.rawErrorCode ?? "failed",
    });
  }

  const text = result.outputText?.trim();
  if (!text) {
    throw new OpenAIAiError("empty_output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new OpenAIAiError("invalid_structured_output", {
      internalCode: "json_parse",
    });
  }

  const zod = MarketingAnalysisCandidateSchema.safeParse(parsed);
  if (!zod.success) {
    throw new OpenAIAiError("invalid_structured_output", {
      internalCode: "zod_validation",
    });
  }

  return normalizeMarketingCandidate(zod.data);
}

/**
 * Parse untrusted Responses output into CreativeAnalysisCandidate (VHS-118A).
 * Never finalizes a CreativeConcept.
 */

import {
  CreativeAnalysisCandidateSchema,
  normalizeCreativeCandidate,
  type CreativeAnalysisCandidate,
} from "@/domain/creative";
import type { OpenAIResponseResult } from "../contracts";
import { OpenAIAiError } from "../errors";

export function parseCreativeCandidateResponse(
  result: OpenAIResponseResult
): CreativeAnalysisCandidate {
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

  const zod = CreativeAnalysisCandidateSchema.safeParse(parsed);
  if (!zod.success) {
    throw new OpenAIAiError("invalid_structured_output", {
      internalCode: "zod_validation",
    });
  }

  return normalizeCreativeCandidate(zod.data);
}

import { ScriptAnalysisCandidateSchema, type ScriptAnalysisCandidate } from "@/domain/script";
import type { OpenAIResponseResult } from "../contracts";
import { OpenAIAiError } from "../errors";

/** Parses transport output only; ScriptWriter owns validation and authoritative timing. */
export function parseScriptCandidateResponse(result: OpenAIResponseResult): ScriptAnalysisCandidate {
  if (result.refusal?.trim()) throw new OpenAIAiError("refused", { internalCode: "model_refusal" });
  if (result.status === "incomplete") {
    throw new OpenAIAiError("incomplete", { internalCode: result.incompleteReason ?? "incomplete" });
  }
  if (result.status === "cancelled") throw new OpenAIAiError("cancelled");
  if (result.status === "failed") {
    throw new OpenAIAiError(
      /content[_ ]?filter|policy/i.test(result.rawErrorCode ?? "") ? "content_filtered" : "provider_unavailable",
      { internalCode: result.rawErrorCode ?? "failed" }
    );
  }
  const output = result.outputText?.trim();
  if (!output) throw new OpenAIAiError("empty_output");
  let parsed: unknown;
  try { parsed = JSON.parse(output); } catch { throw new OpenAIAiError("invalid_structured_output", { internalCode: "json_parse" }); }
  const candidate = ScriptAnalysisCandidateSchema.safeParse(parsed);
  if (!candidate.success) throw new OpenAIAiError("invalid_structured_output", { internalCode: "zod_validation" });
  return candidate.data;
}

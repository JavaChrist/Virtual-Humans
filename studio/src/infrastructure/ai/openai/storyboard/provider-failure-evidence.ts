/**
 * Redacted Storyboard provider-failure evidence for smoke / durable local proofs.
 * Never includes API keys, prompts, schemas, response bodies, or artifact content.
 */
import { sanitizeInternalCode } from "@/application/directors/marketing/failures";
import type { OpenAIAiError } from "../errors";

export type StoryboardFailureStage =
  | "request_build"
  | "provider_request"
  | "provider_response"
  | "candidate_parse";

export type StoryboardProviderFailureEvidence = {
  stage: StoryboardFailureStage;
  vhsFailureCode: string;
  httpStatus?: number;
  openaiCode?: string;
  providerErrorCode?: string;
  providerErrorType?: string;
  providerRequestId?: string;
  internalCode?: string;
  durationMs: number;
  networkAttempts: number;
  usagePresent: boolean;
};

function sanitizeObs(raw: string | undefined): string | undefined {
  return sanitizeInternalCode(raw);
}

const FORBIDDEN =
  /sk-[A-Za-z0-9]{10,}|Bearer\s+\S+|prompt|instructions|schema\s*\{|BEGIN PRIVATE/i;

/** Build redacted evidence from a mapped OpenAI error + timing. */
export function buildStoryboardProviderFailureEvidence(input: {
  stage: StoryboardFailureStage;
  vhsFailureCode: string;
  openaiErr?: OpenAIAiError;
  durationMs: number;
  networkAttempts: number;
  usagePresent?: boolean;
}): StoryboardProviderFailureEvidence {
  const err = input.openaiErr;
  const evidence: StoryboardProviderFailureEvidence = {
    stage: input.stage,
    vhsFailureCode: sanitizeObs(input.vhsFailureCode) ?? "request_failed",
    httpStatus: err?.httpStatus,
    openaiCode: sanitizeObs(err?.code),
    providerErrorCode: sanitizeObs(err?.providerObs?.providerErrorCode),
    providerErrorType: sanitizeObs(err?.providerObs?.providerErrorType),
    providerRequestId: sanitizeObs(err?.providerObs?.providerRequestId),
    internalCode: sanitizeObs(err?.internalCode),
    durationMs: Number.isFinite(input.durationMs)
      ? Math.max(0, Math.floor(input.durationMs))
      : 0,
    networkAttempts: Number.isFinite(input.networkAttempts)
      ? Math.max(0, Math.floor(input.networkAttempts))
      : 0,
    usagePresent: Boolean(input.usagePresent),
  };
  return assertStoryboardProviderFailureEvidenceSafe(evidence);
}

/** Fail closed if accidental secret-like content slipped in. */
export function assertStoryboardProviderFailureEvidenceSafe(
  evidence: StoryboardProviderFailureEvidence,
): StoryboardProviderFailureEvidence {
  const blob = JSON.stringify(evidence);
  if (FORBIDDEN.test(blob)) {
    return {
      stage: evidence.stage,
      vhsFailureCode: "request_failed",
      durationMs: evidence.durationMs,
      networkAttempts: evidence.networkAttempts,
      usagePresent: evidence.usagePresent,
      internalCode: "redacted",
    };
  }
  return evidence;
}

export function inferStoryboardFailureStage(
  openaiErr: OpenAIAiError | undefined,
  networkAttempts: number,
): StoryboardFailureStage {
  if (!openaiErr) return "request_build";
  if (
    openaiErr.code === "prompt_injection_detected" ||
    openaiErr.code === "storyboard_ai_disabled" ||
    openaiErr.code === "paid_ai_disabled" ||
    openaiErr.code === "openai_not_configured" ||
    openaiErr.code === "pricing_unknown"
  ) {
    return "request_build";
  }
  if (
    openaiErr.code === "invalid_structured_output" ||
    openaiErr.code === "empty_output" ||
    openaiErr.code === "incomplete" ||
    openaiErr.code === "refused"
  ) {
    return "candidate_parse";
  }
  if (networkAttempts > 0) {
    if (
      openaiErr.code === "structured_output_unsupported" ||
      openaiErr.code === "invalid_request" ||
      openaiErr.code === "unsupported_model" ||
      openaiErr.httpStatus != null
    ) {
      return "provider_response";
    }
    return "provider_request";
  }
  return "request_build";
}

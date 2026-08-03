/**
 * Pure provider error → GenerationError mapping (VHS-109).
 * Never embeds secrets, prompts, or signed URLs in publicMessage.
 */

import {
  GenerationDomainError,
  type GenerationError,
  type GenerationErrorCode,
} from "@/domain/generation";

function scrub(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/xi-api-key["']?\s*[:=]\s*["']?[^"'&\s]+/gi, "xi-api-key=[redacted]")
    .replace(/https:\/\/[^\s"'<>]+/gi, "[url]")
    .replace(/data:[^;]+;base64,[A-Za-z0-9+/=]+/gi, "[data-url]")
    .slice(0, 280);
}

function codeFromStatus(status: number): GenerationErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status === 402) return "quota_exceeded";
  if (status === 408 || status === 504) return "timeout";
  if (status === 400 || status === 422) return "content_rejected";
  if (status >= 500) return "provider_unavailable";
  return "unknown";
}

export function mapProviderError(
  e: unknown,
  meta: { providerId: string; modelId?: string },
): GenerationError {
  if (e instanceof GenerationDomainError) {
    return e.toGenerationError();
  }

  if (e instanceof Error && e.name === "AbortError") {
    return {
      code: "cancelled",
      retryable: false,
      publicMessage: "Generation was aborted.",
      providerId: meta.providerId,
      modelId: meta.modelId,
      internalCode: "AbortError",
    };
  }

  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();

  if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("timed out")) {
    return {
      code: "timeout",
      retryable: true,
      publicMessage: "Provider request timed out.",
      providerId: meta.providerId,
      modelId: meta.modelId,
    };
  }

  const statusMatch = /\((\d{3})\)/.exec(msg) ?? /status\s*[:=]?\s*(\d{3})/i.exec(msg);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    const code = codeFromStatus(status);
    return {
      code,
      retryable: code === "rate_limited" || code === "provider_unavailable" || code === "timeout",
      publicMessage: publicForCode(code),
      providerId: meta.providerId,
      modelId: meta.modelId,
      internalCode: `http_${status}`,
    };
  }

  if (lower.includes("quota") || lower.includes("exhausted balance") || lower.includes("insufficient")) {
    return {
      code: "quota_exceeded",
      retryable: false,
      publicMessage: "Provider quota exceeded.",
      providerId: meta.providerId,
      modelId: meta.modelId,
    };
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return {
      code: "rate_limited",
      retryable: true,
      publicMessage: "Provider rate limit reached.",
      providerId: meta.providerId,
      modelId: meta.modelId,
    };
  }

  if (
    lower.includes("safety") ||
    lower.includes("moderation") ||
    lower.includes("content policy") ||
    lower.includes("rejected")
  ) {
    return {
      code: "content_rejected",
      retryable: false,
      publicMessage: "Provider rejected the content.",
      providerId: meta.providerId,
      modelId: meta.modelId,
    };
  }

  // unknown — never auto-retryable; scrub diagnostic into internalCode only
  return {
    code: "unknown",
    retryable: false,
    publicMessage: "Provider request failed.",
    providerId: meta.providerId,
    modelId: meta.modelId,
    internalCode: scrub(msg).slice(0, 120),
  };
}

function publicForCode(code: GenerationErrorCode): string {
  switch (code) {
    case "unauthorized":
      return "Provider authentication failed.";
    case "rate_limited":
      return "Provider rate limit reached.";
    case "quota_exceeded":
      return "Provider quota exceeded.";
    case "timeout":
      return "Provider request timed out.";
    case "content_rejected":
      return "Provider rejected the content.";
    case "provider_unavailable":
      return "Provider is temporarily unavailable.";
    default:
      return "Provider request failed.";
  }
}

export function toFailedResult(
  e: unknown,
  meta: { providerId: string; modelId?: string; failedAt: string },
): {
  status: "failed";
  error: GenerationError;
  failedAt: string;
} {
  return {
    status: "failed",
    error: mapProviderError(e, meta),
    failedAt: meta.failedAt,
  };
}

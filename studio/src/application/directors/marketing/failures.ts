/**
 * Serializable Marketing analysis failure contract (VHS-117D).
 * Application layer — no OpenAI types, no stacks, no secrets.
 */

import type { AnalyzerMetering } from "@/application/directors/shared/analyzer-metering";

export const MARKETING_ANALYSIS_FAILURE_CODES = [
  "rate_limited",
  "timeout",
  "provider_unavailable",
  "unauthorized",
  "forbidden",
  "request_failed",
  "quota_exceeded",
  "refused",
  "incomplete",
  "empty_response",
  "invalid_structured_output",
  "invalid_candidate",
  "budget_exceeded",
  "idempotency_conflict",
  "retry_required",
  "retry_not_allowed",
  "retry_conflict",
  "run_in_progress",
  "internal_error",
] as const;

export type MarketingAnalysisFailureCode =
  (typeof MARKETING_ANALYSIS_FAILURE_CODES)[number];

/** Redacted provider transport metadata — never prompts/bodies/secrets. */
export type MarketingProviderFailureMetadata = {
  providerErrorCode?: string;
  providerErrorType?: string;
  providerRequestId?: string;
  failureStage?:
    | "request_build"
    | "provider_request"
    | "provider_response"
    | "candidate_parse";
  networkAttempts?: number;
  durationMs?: number;
  usagePresent?: boolean;
};

export type MarketingAnalysisFailure = {
  code: MarketingAnalysisFailureCode;
  retryable: boolean;
  publicMessage: string;
  provider?: "openai";
  httpStatus?: number;
  retryAfterSeconds?: number;
  /** Bounded, app-controlled — never a free-form provider string. */
  internalCode?: string;
  /** Optional redacted provider obs for smoke / durable proofs. */
  providerMetadata?: MarketingProviderFailureMetadata;
};

/** Safe public copy for UI / JSON — never names OpenAI or models. */
export const MARKETING_FAILURE_PUBLIC_MESSAGES: Record<
  MarketingAnalysisFailureCode,
  string
> = {
  rate_limited:
    "Le service d’analyse est temporairement limité. Réessayez plus tard.",
  timeout: "L’analyse a pris trop de temps. Réessayez plus tard.",
  provider_unavailable:
    "Le service d’analyse est temporairement indisponible. Réessayez plus tard.",
  unauthorized: "L’analyse n’a pas pu être authentifiée. Réessayez plus tard.",
  forbidden: "L’analyse a été refusée par le service. Réessayez plus tard.",
  request_failed: "L’analyse n’a pas pu aboutir. Réessayez plus tard.",
  quota_exceeded:
    "Le quota du service d’analyse est insuffisant. Vérifiez la facturation puis réessayez.",
  refused: "L’analyse a été refusée. Ajustez le brief puis réessayez.",
  incomplete: "La réponse d’analyse est incomplète. Réessayez plus tard.",
  empty_response: "Aucune analyse n’a été produite. Réessayez plus tard.",
  invalid_structured_output:
    "La sortie d’analyse est invalide. Réessayez plus tard.",
  invalid_candidate: "Le candidat marketing est invalide.",
  budget_exceeded: "Budget insuffisant pour lancer l’analyse.",
  idempotency_conflict: "Conflit d’idempotence sur l’analyse marketing.",
  retry_required:
    "Cette analyse a déjà échoué. Utilisez « Réessayer l’analyse » pour une nouvelle tentative.",
  retry_not_allowed: "Cette analyse ne peut pas être relancée.",
  retry_conflict:
    "Une autre tentative est déjà en cours ou a été créée. Actualisez l’état avant de réessayer.",
  run_in_progress: "Une analyse marketing est déjà en cours.",
  internal_error: "Erreur interne pendant l’analyse marketing.",
};

const RETRYABLE_DEFAULT: ReadonlySet<MarketingAnalysisFailureCode> = new Set([
  "rate_limited",
  "timeout",
  "provider_unavailable",
]);

export function marketingFailure(
  code: MarketingAnalysisFailureCode,
  opts?: Partial<
    Omit<MarketingAnalysisFailure, "code" | "publicMessage" | "retryable">
  > & {
    publicMessage?: string;
    retryable?: boolean;
  }
): MarketingAnalysisFailure {
  const meta = opts?.providerMetadata;
  const providerMetadata = meta
    ? {
        providerErrorCode: sanitizeInternalCode(meta.providerErrorCode),
        providerErrorType: sanitizeInternalCode(meta.providerErrorType),
        providerRequestId: sanitizeInternalCode(meta.providerRequestId),
        failureStage: meta.failureStage,
        networkAttempts:
          meta.networkAttempts != null && Number.isFinite(meta.networkAttempts)
            ? Math.max(0, Math.floor(meta.networkAttempts))
            : undefined,
        durationMs:
          meta.durationMs != null && Number.isFinite(meta.durationMs)
            ? Math.max(0, Math.floor(meta.durationMs))
            : undefined,
        usagePresent:
          typeof meta.usagePresent === "boolean" ? meta.usagePresent : undefined,
      }
    : undefined;
  return {
    code,
    retryable: opts?.retryable ?? RETRYABLE_DEFAULT.has(code),
    publicMessage:
      opts?.publicMessage ?? MARKETING_FAILURE_PUBLIC_MESSAGES[code],
    provider: opts?.provider,
    httpStatus: opts?.httpStatus,
    retryAfterSeconds: opts?.retryAfterSeconds,
    internalCode: opts?.internalCode,
    providerMetadata,
  };
}

/**
 * Typed analyzer failure — thrown by adapters / recognized by Marketing Director.
 * Never serialize the Error instance itself to JSON.
 * Optional metering when the provider was called and usage/cost is known.
 */
export class MarketingAnalyzerError extends Error {
  readonly failure: MarketingAnalysisFailure;
  readonly metering?: AnalyzerMetering;

  constructor(
    failure: MarketingAnalysisFailure,
    opts?: { metering?: AnalyzerMetering }
  ) {
    super(failure.publicMessage);
    this.name = "MarketingAnalyzerError";
    this.failure = failure;
    this.metering = opts?.metering;
  }
}

export function isMarketingAnalyzerError(
  e: unknown
): e is MarketingAnalyzerError {
  return e instanceof MarketingAnalyzerError;
}

export function internalMarketingFailure(
  internalCode = "unexpected"
): MarketingAnalysisFailure {
  return marketingFailure("internal_error", {
    retryable: false,
    internalCode: sanitizeInternalCode(internalCode),
  });
}

/** Bound internal codes — alnum, underscore, dash, max 64. */
export function sanitizeInternalCode(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, 64);
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) return "invalid_internal_code";
  return trimmed;
}

/** Max Retry-After propagated to clients (seconds). */
export const MARKETING_RETRY_AFTER_MAX_SECONDS = 3600;

/**
 * Parse a numeric Retry-After value for HTTP responses.
 * HTTP-date forms are ignored. Never invents a delay.
 */
export function parseRetryAfterSeconds(
  raw: string | null | undefined
): number | undefined {
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0 || n > MARKETING_RETRY_AFTER_MAX_SECONDS) {
    return undefined;
  }
  return n;
}

export type MarketingFailureHttpStatus =
  | 202
  | 402
  | 409
  | 422
  | 429
  | 500
  | 502
  | 503
  | 504;

/** Canonical application → HTTP mapping (VHS-117D). */
export function httpStatusForMarketingFailure(
  code: MarketingAnalysisFailureCode
): MarketingFailureHttpStatus {
  switch (code) {
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "provider_unavailable":
      return 503;
    case "unauthorized":
    case "forbidden":
    case "incomplete":
    case "empty_response":
    case "invalid_structured_output":
    case "request_failed":
      return 502;
    case "refused":
    case "invalid_candidate":
      return 422;
    case "budget_exceeded":
      return 402;
    case "quota_exceeded":
      return 402;
    case "idempotency_conflict":
    case "retry_required":
    case "retry_conflict":
      return 409;
    case "retry_not_allowed":
      return 422;
    case "run_in_progress":
      return 202;
    case "internal_error":
    default:
      return 500;
  }
}

/** Pure UI message lookup — no provider/model/HTTP leakage. */
export function publicMessageForMarketingFailureCode(
  code: string | undefined
): string {
  if (
    code &&
    (MARKETING_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code)
  ) {
    return MARKETING_FAILURE_PUBLIC_MESSAGES[
      code as MarketingAnalysisFailureCode
    ];
  }
  return MARKETING_FAILURE_PUBLIC_MESSAGES.internal_error;
}

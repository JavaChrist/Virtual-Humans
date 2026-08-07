/**
 * Normalized OpenAI / Marketing AI errors (VHS-117A / VHS-117D).
 * Never embed prompts, briefs, secrets, raw responses, or stacks.
 */

/** Max Retry-After accepted from provider headers (seconds). */
export const OPENAI_RETRY_AFTER_MAX_SECONDS = 3600;

/**
 * Parse a numeric Retry-After header. HTTP-date forms are ignored.
 * Invalid / non-positive / unbounded values → undefined (never invent a delay).
 */
export function parseRetryAfterSeconds(
  raw: string | null | undefined
): number | undefined {
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  if (
    !Number.isInteger(n) ||
    n <= 0 ||
    n > OPENAI_RETRY_AFTER_MAX_SECONDS
  ) {
    return undefined;
  }
  return n;
}

export type OpenAIAiErrorCode =
  | "openai_not_configured"
  | "marketing_ai_disabled"
  | "creative_ai_disabled"
  | "script_ai_disabled"
  | "art_ai_disabled"
  | "storyboard_ai_disabled"
  | "paid_ai_disabled"
  | "invalid_request"
  | "prompt_injection_detected"
  | "unsupported_model"
  | "structured_output_unsupported"
  | "rate_limited"
  | "quota_exceeded"
  | "unauthorized"
  | "forbidden"
  | "timeout"
  | "cancelled"
  | "refused"
  | "incomplete"
  | "invalid_structured_output"
  | "empty_output"
  | "content_filtered"
  | "pricing_unknown"
  | "provider_unavailable"
  | "unknown";

const RETRYABLE: ReadonlySet<OpenAIAiErrorCode> = new Set([
  "rate_limited",
  "timeout",
  "provider_unavailable",
]);

const PUBLIC_MESSAGES: Record<OpenAIAiErrorCode, string> = {
  openai_not_configured: "OpenAI n’est pas configuré.",
  marketing_ai_disabled: "L’analyse Marketing IA est désactivée.",
  creative_ai_disabled: "L’analyse Creative IA est désactivée.",
  script_ai_disabled: "L’analyse Script IA est désactivée.",
  art_ai_disabled: "L’analyse Art IA est désactivée.",
  storyboard_ai_disabled: "L’analyse Storyboard IA est désactivée.",
  paid_ai_disabled: "Les appels IA payants sont désactivés.",
  invalid_request: "Requête d’analyse invalide.",
  prompt_injection_detected: "Contenu non fiable bloquant détecté dans le brief.",
  unsupported_model: "Modèle Marketing non supporté.",
  structured_output_unsupported: "Sortie structurée non supportée pour ce modèle.",
  rate_limited: "Limite de débit OpenAI atteinte.",
  quota_exceeded: "Quota OpenAI dépassé.",
  unauthorized: "Authentification OpenAI refusée.",
  forbidden: "Accès OpenAI interdit.",
  timeout: "Délai d’attente OpenAI dépassé.",
  cancelled: "Appel OpenAI annulé.",
  refused: "Le modèle a refusé de produire l’analyse.",
  incomplete: "Réponse OpenAI incomplète.",
  invalid_structured_output: "Sortie structurée invalide.",
  empty_output: "Réponse OpenAI vide.",
  content_filtered: "Contenu filtré par la politique de sécurité.",
  pricing_unknown: "Tarification du modèle indisponible.",
  provider_unavailable: "Fournisseur OpenAI indisponible.",
  unknown: "Erreur d’analyse Marketing.",
};

/** Redacted provider observability — never prompts, bodies, or secrets. */
export type OpenAIProviderObs = {
  providerErrorCode?: string;
  providerErrorType?: string;
  providerRequestId?: string;
  rateLimitLimitRequests?: string;
  rateLimitRemainingRequests?: string;
  rateLimitResetRequests?: string;
};

/** Redacted structured-output validation obs — never brief/response bodies. */
export type OpenAIStructuredOutputObs = {
  category:
    | "json_parse"
    | "zod_validation"
    | "empty_output"
    | "incomplete"
    | "refused"
    | "other";
  zodPaths?: string[];
  zodCodes?: string[];
  /** Type-level only: expected/received (e.g. object/null) — never values. */
  zodTypeMismatches?: Array<{
    path: string;
    expected?: string;
    received?: string;
  }>;
  responseStatus?: string;
  incompleteReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };
  providerRequestId?: string;
};

function sanitizeObsToken(raw: string | null | undefined): string | undefined {
  if (raw == null) return undefined;
  const trimmed = String(raw).trim().slice(0, 128);
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

function sanitizeTypeToken(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, 64);
  if (!/^[a-zA-Z0-9_|.\-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeStructuredOutputObs(
  raw: OpenAIStructuredOutputObs | undefined
): OpenAIStructuredOutputObs | undefined {
  if (!raw) return undefined;
  const zodPaths = raw.zodPaths
    ?.map((p) => String(p).trim().slice(0, 128))
    .filter((p) => /^[a-zA-Z0-9_.\[\]]+$/.test(p))
    .slice(0, 24);
  const zodCodes = raw.zodCodes
    ?.map((c) => String(c).trim().slice(0, 64))
    .filter((c) => /^[a-zA-Z0-9_]+$/.test(c))
    .slice(0, 24);
  const zodTypeMismatches = raw.zodTypeMismatches
    ?.slice(0, 24)
    .map((m) => ({
      path: String(m.path).trim().slice(0, 128),
      expected: sanitizeTypeToken(m.expected),
      received: sanitizeTypeToken(m.received),
    }))
    .filter((m) => /^[a-zA-Z0-9_.\[\]]+$/.test(m.path));
  const usage = raw.usage
    ? {
        inputTokens: Number.isFinite(raw.usage.inputTokens)
          ? raw.usage.inputTokens
          : undefined,
        outputTokens: Number.isFinite(raw.usage.outputTokens)
          ? raw.usage.outputTokens
          : undefined,
        totalTokens: Number.isFinite(raw.usage.totalTokens)
          ? raw.usage.totalTokens
          : undefined,
        reasoningTokens: Number.isFinite(raw.usage.reasoningTokens)
          ? raw.usage.reasoningTokens
          : undefined,
        cachedInputTokens: Number.isFinite(raw.usage.cachedInputTokens)
          ? raw.usage.cachedInputTokens
          : undefined,
      }
    : undefined;
  return {
    category: raw.category,
    zodPaths: zodPaths?.length ? zodPaths : undefined,
    zodCodes: zodCodes?.length ? zodCodes : undefined,
    zodTypeMismatches: zodTypeMismatches?.length
      ? zodTypeMismatches
      : undefined,
    responseStatus: sanitizeObsToken(raw.responseStatus),
    incompleteReason: sanitizeObsToken(raw.incompleteReason),
    usage,
    providerRequestId: sanitizeObsToken(raw.providerRequestId),
  };
}

export class OpenAIAiError extends Error {
  readonly code: OpenAIAiErrorCode;
  readonly retryable: boolean;
  readonly publicMessage: string;
  readonly internalCode: string;
  readonly httpStatus?: number;
  readonly retryAfterSeconds?: number;
  readonly providerObs?: OpenAIProviderObs;
  readonly structuredOutputObs?: OpenAIStructuredOutputObs;

  constructor(
    code: OpenAIAiErrorCode,
    opts?: {
      internalCode?: string;
      publicMessage?: string;
      retryable?: boolean;
      httpStatus?: number;
      retryAfterSeconds?: number;
      providerObs?: OpenAIProviderObs;
      structuredOutputObs?: OpenAIStructuredOutputObs;
    }
  ) {
    const publicMessage = opts?.publicMessage ?? PUBLIC_MESSAGES[code];
    super(publicMessage);
    this.name = "OpenAIAiError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.internalCode = opts?.internalCode ?? code;
    this.retryable = opts?.retryable ?? RETRYABLE.has(code);
    this.httpStatus = opts?.httpStatus;
    const ra = opts?.retryAfterSeconds;
    if (
      ra != null &&
      Number.isInteger(ra) &&
      ra > 0 &&
      ra <= OPENAI_RETRY_AFTER_MAX_SECONDS
    ) {
      this.retryAfterSeconds = ra;
    }
    if (opts?.providerObs) {
      this.providerObs = {
        providerErrorCode: sanitizeObsToken(opts.providerObs.providerErrorCode),
        providerErrorType: sanitizeObsToken(opts.providerObs.providerErrorType),
        providerRequestId: sanitizeObsToken(opts.providerObs.providerRequestId),
        rateLimitLimitRequests: sanitizeObsToken(
          opts.providerObs.rateLimitLimitRequests
        ),
        rateLimitRemainingRequests: sanitizeObsToken(
          opts.providerObs.rateLimitRemainingRequests
        ),
        rateLimitResetRequests: sanitizeObsToken(
          opts.providerObs.rateLimitResetRequests
        ),
      };
    }
    this.structuredOutputObs = sanitizeStructuredOutputObs(
      opts?.structuredOutputObs
    );
  }
}


export function isOpenAIAiError(e: unknown): e is OpenAIAiError {
  return e instanceof OpenAIAiError;
}

/** Map HTTP / transport failures without echoing bodies. */
export function mapOpenAIHttpError(
  status: number,
  providerCode?: string,
  opts?: {
    retryAfterHeader?: string | null;
    providerErrorType?: string | null;
    providerRequestId?: string | null;
    rateLimitLimitRequests?: string | null;
    rateLimitRemainingRequests?: string | null;
    rateLimitResetRequests?: string | null;
  }
): OpenAIAiError {
  const retryAfterSeconds = parseRetryAfterSeconds(opts?.retryAfterHeader);
  const providerObs: OpenAIProviderObs = {
    providerErrorCode: providerCode,
    providerErrorType: opts?.providerErrorType ?? undefined,
    providerRequestId: opts?.providerRequestId ?? undefined,
    rateLimitLimitRequests: opts?.rateLimitLimitRequests ?? undefined,
    rateLimitRemainingRequests: opts?.rateLimitRemainingRequests ?? undefined,
    rateLimitResetRequests: opts?.rateLimitResetRequests ?? undefined,
  };
  const codeHint = `${providerCode ?? ""} ${opts?.providerErrorType ?? ""}`;

  if (status === 401) {
    return new OpenAIAiError("unauthorized", {
      internalCode: `http_${status}`,
      httpStatus: status,
      providerObs,
    });
  }
  if (status === 403) {
    return new OpenAIAiError("forbidden", {
      internalCode: `http_${status}`,
      httpStatus: status,
      providerObs,
    });
  }
  if (status === 429) {
    // Distinguish rate_limit_exceeded vs insufficient_quota (never treat quota as retryable).
    const insufficientQuota = /insufficient_quota/i.test(codeHint);
    const billingQuota =
      /billing|quota_exceeded/i.test(codeHint) && !/rate_limit/i.test(codeHint);
    if (insufficientQuota || billingQuota) {
      return new OpenAIAiError("quota_exceeded", {
        internalCode: sanitizeObsToken(providerCode) ?? `http_${status}`,
        httpStatus: status,
        retryAfterSeconds,
        retryable: false,
        providerObs,
      });
    }
    return new OpenAIAiError("rate_limited", {
      internalCode: sanitizeObsToken(providerCode) ?? `http_${status}`,
      httpStatus: status,
      retryAfterSeconds,
      providerObs,
    });
  }
  if (status === 400 && /structured|json_schema|response_format/i.test(codeHint)) {
    return new OpenAIAiError("structured_output_unsupported", {
      internalCode: providerCode ?? "http_400",
      httpStatus: status,
      providerObs,
    });
  }
  if (status === 400 && /model_not_found|invalid_model|model/i.test(codeHint)) {
    return new OpenAIAiError("unsupported_model", {
      internalCode: providerCode ?? "http_400",
      httpStatus: status,
      providerObs,
    });
  }
  if (status >= 500) {
    return new OpenAIAiError("provider_unavailable", {
      internalCode: `http_${status}`,
      httpStatus: status,
      providerObs,
    });
  }
  return new OpenAIAiError("unknown", {
    internalCode: `http_${status}`,
    httpStatus: status,
    providerObs,
  });
}

export function mapAbortError(e: unknown): OpenAIAiError {
  if (e instanceof OpenAIAiError) return e;
  const name = e instanceof Error ? e.name : "";
  const msg = e instanceof Error ? e.message : "";
  // Node undici: controller.abort(new Error("timeout")) rejects with Error("timeout")
  // (name !== "AbortError", message has no "abort") — must still map to timeout.
  if (/timeout/i.test(msg) || /timeout/i.test(name)) {
    return new OpenAIAiError("timeout");
  }
  if (name === "AbortError" || /aborted|abort/i.test(msg)) {
    return new OpenAIAiError("cancelled");
  }
  return new OpenAIAiError("unknown", { internalCode: "transport" });
}

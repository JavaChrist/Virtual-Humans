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

export class OpenAIAiError extends Error {
  readonly code: OpenAIAiErrorCode;
  readonly retryable: boolean;
  readonly publicMessage: string;
  readonly internalCode: string;
  readonly httpStatus?: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: OpenAIAiErrorCode,
    opts?: {
      internalCode?: string;
      publicMessage?: string;
      retryable?: boolean;
      httpStatus?: number;
      retryAfterSeconds?: number;
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
  }
}

export function isOpenAIAiError(e: unknown): e is OpenAIAiError {
  return e instanceof OpenAIAiError;
}

/** Map HTTP / transport failures without echoing bodies. */
export function mapOpenAIHttpError(
  status: number,
  providerCode?: string,
  opts?: { retryAfterHeader?: string | null }
): OpenAIAiError {
  const retryAfterSeconds = parseRetryAfterSeconds(opts?.retryAfterHeader);

  if (status === 401) {
    return new OpenAIAiError("unauthorized", {
      internalCode: `http_${status}`,
      httpStatus: status,
    });
  }
  if (status === 403) {
    return new OpenAIAiError("forbidden", {
      internalCode: `http_${status}`,
      httpStatus: status,
    });
  }
  if (status === 429) {
    const quota = /quota|billing|insufficient/i.test(providerCode ?? "");
    return new OpenAIAiError(quota ? "quota_exceeded" : "rate_limited", {
      internalCode: providerCode ?? `http_${status}`,
      httpStatus: status,
      retryAfterSeconds,
    });
  }
  if (status === 400 && /structured|json_schema|response_format/i.test(providerCode ?? "")) {
    return new OpenAIAiError("structured_output_unsupported", {
      internalCode: providerCode ?? "http_400",
      httpStatus: status,
    });
  }
  if (status === 400 && /model/i.test(providerCode ?? "")) {
    return new OpenAIAiError("unsupported_model", {
      internalCode: providerCode ?? "http_400",
      httpStatus: status,
    });
  }
  if (status >= 500) {
    return new OpenAIAiError("provider_unavailable", {
      internalCode: `http_${status}`,
      httpStatus: status,
    });
  }
  return new OpenAIAiError("unknown", {
    internalCode: `http_${status}`,
    httpStatus: status,
  });
}

export function mapAbortError(e: unknown): OpenAIAiError {
  if (e instanceof OpenAIAiError) return e;
  const name = e instanceof Error ? e.name : "";
  const msg = e instanceof Error ? e.message : "";
  if (name === "AbortError" || /aborted|abort/i.test(msg)) {
    if (/timeout/i.test(msg)) return new OpenAIAiError("timeout");
    return new OpenAIAiError("cancelled");
  }
  return new OpenAIAiError("unknown", { internalCode: "transport" });
}

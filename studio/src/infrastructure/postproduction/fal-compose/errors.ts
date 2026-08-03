/**
 * Public-safe fal compose errors (no URLs / payloads / stacks).
 */

export type FalComposeErrorCode =
  | "invalid_input"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "output_invalid"
  | "merge_failed"
  | "unknown";

export function mapFalComposeClientError(e: unknown): {
  code: FalComposeErrorCode;
  retryable: boolean;
  publicMessage: string;
} {
  const msg = e instanceof Error ? e.message : "Merge failed";
  const lower = msg.toLowerCase();
  if (/429|rate.?limit/i.test(msg)) {
    return {
      code: "rate_limited",
      retryable: true,
      publicMessage: "Limite de débit provider atteinte.",
    };
  }
  if (/timeout|timed out|abort/i.test(lower)) {
    return {
      code: "timeout",
      retryable: true,
      publicMessage: "Délai d'attente du merge dépassé.",
    };
  }
  if (/unavailable|503|502|network/i.test(lower)) {
    return {
      code: "provider_unavailable",
      retryable: true,
      publicMessage: "Provider merge indisponible.",
    };
  }
  if (/exhausted balance|user is locked|top up/i.test(lower)) {
    return {
      code: "provider_unavailable",
      retryable: false,
      publicMessage: "Solde provider épuisé.",
    };
  }
  return {
    code: "merge_failed",
    retryable: false,
    publicMessage: "Échec du merge compose.",
  };
}

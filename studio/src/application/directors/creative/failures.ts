/**
 * Creative-facing failure copy + mapping helpers (VHS-8G-A).
 * Reuses MarketingAnalysisFailure codes; never says « marketing ».
 */

import {
  MARKETING_ANALYSIS_FAILURE_CODES,
  marketingFailure,
  type MarketingAnalysisFailure,
  type MarketingAnalysisFailureCode,
} from "@/application/directors/marketing/failures";

/** Creative-specific public messages — same codes, different product wording. */
export const CREATIVE_FAILURE_PUBLIC_MESSAGES: Record<
  MarketingAnalysisFailureCode,
  string
> = {
  rate_limited:
    "Le service d’analyse créative est temporairement limité. Réessayez plus tard.",
  timeout: "L’analyse créative a pris trop de temps. Réessayez plus tard.",
  provider_unavailable:
    "Le service d’analyse créative est temporairement indisponible. Réessayez plus tard.",
  unauthorized:
    "L’analyse créative n’a pas pu être authentifiée. Réessayez plus tard.",
  forbidden:
    "L’analyse créative a été refusée par le service. Réessayez plus tard.",
  request_failed: "L’analyse créative n’a pas pu aboutir. Réessayez plus tard.",
  quota_exceeded:
    "Le quota du service d’analyse créative est insuffisant. Vérifiez la facturation puis réessayez.",
  refused:
    "L’analyse créative a été refusée. Ajustez le brief ou le plan puis réessayez.",
  incomplete:
    "La réponse d’analyse créative est incomplète. Réessayez plus tard.",
  empty_response:
    "Aucune analyse créative n’a été produite. Réessayez plus tard.",
  invalid_structured_output:
    "La sortie d’analyse créative est invalide. Réessayez plus tard.",
  invalid_candidate: "Le candidat créatif est invalide.",
  budget_exceeded: "Budget insuffisant pour lancer l’analyse créative.",
  idempotency_conflict:
    "Conflit d’idempotence sur l’analyse créative.",
  retry_required:
    "Cette analyse créative a déjà échoué. Une confirmation humaine est requise pour une nouvelle tentative.",
  retry_not_allowed: "Cette analyse créative ne peut pas être relancée.",
  retry_conflict:
    "Une autre tentative créative est déjà en cours ou a été créée. Actualisez l’état avant de réessayer.",
  run_in_progress: "Une analyse créative est déjà en cours.",
  internal_error: "Erreur interne pendant l’analyse créative.",
};

/** Auto-retry is always disabled for Creative; human retry may be gated later. */
export function creativeFailure(
  code: MarketingAnalysisFailureCode,
  opts?: Partial<
    Omit<MarketingAnalysisFailure, "code" | "publicMessage" | "retryable">
  > & {
    publicMessage?: string;
  }
): MarketingAnalysisFailure {
  return marketingFailure(code, {
    ...opts,
    publicMessage:
      opts?.publicMessage ?? CREATIVE_FAILURE_PUBLIC_MESSAGES[code],
    retryable: false,
  });
}

export function withCreativePublicMessage(
  failure: MarketingAnalysisFailure
): MarketingAnalysisFailure {
  return {
    ...failure,
    publicMessage:
      CREATIVE_FAILURE_PUBLIC_MESSAGES[failure.code] ??
      CREATIVE_FAILURE_PUBLIC_MESSAGES.internal_error,
    retryable: false,
  };
}

export function publicMessageForCreativeFailureCode(
  code: string | undefined
): string {
  if (
    code &&
    (MARKETING_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code)
  ) {
    return CREATIVE_FAILURE_PUBLIC_MESSAGES[
      code as MarketingAnalysisFailureCode
    ];
  }
  return CREATIVE_FAILURE_PUBLIC_MESSAGES.internal_error;
}

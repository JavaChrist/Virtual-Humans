/**
 * Art-facing failure copy (Porte 8P).
 * Reuses MarketingAnalysisFailure codes; never says « marketing ».
 */

import {
  MARKETING_ANALYSIS_FAILURE_CODES,
  marketingFailure,
  type MarketingAnalysisFailure,
  type MarketingAnalysisFailureCode,
} from "@/application/directors/marketing/failures";

/** Art-specific public messages — same codes, Art product wording. */
export const ART_FAILURE_PUBLIC_MESSAGES: Record<
  MarketingAnalysisFailureCode,
  string
> = {
  rate_limited:
    "Le service de direction art est temporairement limité. Réessayez plus tard.",
  timeout: "La direction art a pris trop de temps. Réessayez plus tard.",
  provider_unavailable:
    "Le service de direction art est temporairement indisponible. Réessayez plus tard.",
  unauthorized:
    "La direction art n’a pas pu être authentifiée. Réessayez plus tard.",
  forbidden: "La direction art a été refusée par le service. Réessayez plus tard.",
  request_failed: "La direction art n’a pas pu aboutir. Réessayez plus tard.",
  quota_exceeded:
    "Le quota du service de direction art est insuffisant. Vérifiez la facturation puis réessayez.",
  refused:
    "La direction art a été refusée. Ajustez les prérequis puis réessayez.",
  incomplete: "La réponse de direction art est incomplète. Réessayez plus tard.",
  empty_response: "Aucune direction art n’a été produite. Réessayez plus tard.",
  invalid_structured_output:
    "La sortie de direction art est invalide. Réessayez plus tard.",
  invalid_candidate: "Le candidat de direction art est invalide.",
  budget_exceeded: "Budget insuffisant pour lancer la direction art.",
  idempotency_conflict: "Conflit d’idempotence sur la direction art.",
  retry_required:
    "Cette direction art a déjà échoué. Utilisez « Réessayer la direction art » pour une nouvelle tentative.",
  retry_not_allowed: "Cette direction art ne peut pas être relancée.",
  retry_conflict:
    "Une autre tentative art est déjà en cours ou a été créée. Actualisez l’état avant de réessayer.",
  run_in_progress: "Une direction art est déjà en cours.",
  internal_error: "Erreur interne pendant la direction art.",
};

export function artFailure(
  code: MarketingAnalysisFailureCode,
  opts?: Partial<
    Omit<MarketingAnalysisFailure, "code" | "publicMessage" | "retryable">
  > & {
    publicMessage?: string;
    retryable?: boolean;
  }
): MarketingAnalysisFailure {
  return marketingFailure(code, {
    ...opts,
    publicMessage: opts?.publicMessage ?? ART_FAILURE_PUBLIC_MESSAGES[code],
  });
}

/** Preserve taxonomy retryable; swap public copy to Art wording. */
export function withArtPublicMessage(
  failure: MarketingAnalysisFailure
): MarketingAnalysisFailure {
  return {
    ...failure,
    publicMessage:
      ART_FAILURE_PUBLIC_MESSAGES[failure.code] ??
      ART_FAILURE_PUBLIC_MESSAGES.internal_error,
  };
}

export function publicMessageForArtFailureCode(
  code: string | undefined
): string {
  if (
    code &&
    (MARKETING_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code)
  ) {
    return ART_FAILURE_PUBLIC_MESSAGES[code as MarketingAnalysisFailureCode];
  }
  return ART_FAILURE_PUBLIC_MESSAGES.internal_error;
}

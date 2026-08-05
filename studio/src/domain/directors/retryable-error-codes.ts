/**
 * Director error codes eligible for an **explicit human retry** attempt
 * (UI « Réessayer l’analyse » / `begin_or_retry_director_run`).
 *
 * This allowlist NEVER drives automatic provider retries, backoff loops,
 * or client auto-resubmit. Failure taxonomy `retryable` remains separate
 * (`marketingFailure(...).retryable` / RETRYABLE_DEFAULT).
 *
 * Keep in sync with SQL `director_error_code_is_human_retryable` (VHS-129).
 */

export const DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES = [
  "rate_limited",
  "timeout",
  "provider_unavailable",
  /** Human-only after parser/schema fix deploy — not auto-retryable. */
  "invalid_structured_output",
] as const;

export type DirectorHumanRetryableErrorCode =
  (typeof DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES)[number];

export function isDirectorHumanRetryableErrorCode(
  code: string | null | undefined
): code is DirectorHumanRetryableErrorCode {
  return (
    !!code &&
    (DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES as readonly string[]).includes(code)
  );
}

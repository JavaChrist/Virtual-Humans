/**
 * Director error codes that may receive an explicit human retry attempt.
 * Never used for automatic retry loops.
 */

export const DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES = [
  "rate_limited",
  "timeout",
  "provider_unavailable",
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

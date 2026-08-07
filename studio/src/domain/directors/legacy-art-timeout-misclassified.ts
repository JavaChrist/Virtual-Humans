/**
 * Porte 8P-B — narrow legacy exception for Art runs that hit the Node abort
 * bug (Error("timeout") → internal_error) under the old 60s Art timeout.
 *
 * NEVER expands the global human-retry allowlist.
 * NEVER mutates historical rows.
 * NEVER applies to Marketing / Creative / Script / Storyboard.
 */

import { isDirectorHumanRetryableErrorCode } from "./retryable-error-codes";

/** Default OpenAI Art timeout at the time of the misclassification bug. */
export const LEGACY_ART_TIMEOUT_MS = 60_000;

/**
 * Wall-clock window (created_at → completed_at) consistent with a 60s provider
 * abort plus short app/reserve latency. Narrow enough to exclude fast failures.
 */
export const LEGACY_ART_TIMEOUT_DURATION_MS_MIN = 55_000;
export const LEGACY_ART_TIMEOUT_DURATION_MS_MAX = 75_000;

export const LEGACY_ART_TIMEOUT_RETRY_REASON = "misclassified_timeout" as const;

export type LegacyArtTimeoutMisclassifiedRun = {
  directorType: string;
  status: string;
  errorCode: string | null | undefined;
  usage: unknown;
  actualCostMinor: number | null | undefined;
  costStatus: string | null | undefined;
  outputArtifactId: string | null | undefined;
  createdAt: string | Date | null | undefined;
  completedAt: string | Date | null | undefined;
};

function toEpochMs(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * True only for the proven Art timeout→internal_error misclassification pattern.
 * All predicates are conjunctive — any mismatch refuses retry.
 */
export function isLegacyArtTimeoutMisclassified(
  run: LegacyArtTimeoutMisclassifiedRun
): boolean {
  if (run.directorType !== "art") return false;
  if (run.status !== "failed") return false;
  if (run.errorCode !== "internal_error") return false;
  if (run.usage != null) return false;
  if (run.actualCostMinor != null) return false;
  if (run.costStatus !== "released") return false;
  if (run.outputArtifactId != null) return false;

  const createdMs = toEpochMs(run.createdAt);
  const completedMs = toEpochMs(run.completedAt);
  if (createdMs == null || completedMs == null) return false;
  const durationMs = completedMs - createdMs;
  if (durationMs < LEGACY_ART_TIMEOUT_DURATION_MS_MIN) return false;
  if (durationMs > LEGACY_ART_TIMEOUT_DURATION_MS_MAX) return false;
  return true;
}

/** Human Art retry eligibility: standard allowlist OR legacy misclassified timeout. */
export function isArtHumanRetryEligible(input: {
  errorCode: string | null | undefined;
  legacyTimeoutMisclassified?: boolean;
}): boolean {
  return (
    isDirectorHumanRetryableErrorCode(input.errorCode) ||
    input.legacyTimeoutMisclassified === true
  );
}

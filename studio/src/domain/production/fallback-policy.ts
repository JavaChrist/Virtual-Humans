/**
 * Fallback selection rules — only plan-declared fallbacks.
 */

import type { GenerationStep } from "@/domain/routing/router/generation-plan";
import type { ProductionAttempt, ProductionAttemptError } from "./attempts";
import { countFallbacksUsed } from "./attempts";
import type { ProductionPolicy } from "./policy";

export type FallbackDecision =
  | { allowed: true; fallbackIndex: number; reason: string }
  | { allowed: false; reason: string };

export function decideFallback(input: {
  step: GenerationStep;
  attempts: readonly ProductionAttempt[];
  lastError: ProductionAttemptError | undefined;
  qualityRejected?: boolean;
  policy: ProductionPolicy;
  cancelled: boolean;
}): FallbackDecision {
  if (input.cancelled) {
    return { allowed: false, reason: "production_cancelled" };
  }

  const used = countFallbacksUsed(input.attempts);
  if (used >= input.step.fallbacks.length || used >= 2) {
    return { allowed: false, reason: "fallback_exhausted" };
  }
  if (input.step.fallbacks.length === 0) {
    return { allowed: false, reason: "no_fallback_in_plan" };
  }

  const err = input.lastError;
  if (input.qualityRejected) {
    if (!input.policy.qualityFailureAllowsFallback) {
      return { allowed: false, reason: "quality_fallback_disabled" };
    }
    return {
      allowed: true,
      fallbackIndex: used,
      reason: "quality_rejected_allows_fallback",
    };
  }

  if (!err) {
    return { allowed: false, reason: "no_error" };
  }

  if (err.category === "content_rejected") {
    return { allowed: false, reason: "content_rejected" };
  }
  if (err.category === "invalid_input") {
    return { allowed: false, reason: "invalid_input" };
  }
  if (err.category === "unauthorized") {
    return { allowed: false, reason: "unauthorized" };
  }
  if (err.category === "unknown") {
    return { allowed: false, reason: "unknown_error" };
  }
  if (err.retryable === true && (err.category === "technical" || !err.category)) {
    return {
      allowed: true,
      fallbackIndex: used,
      reason: "retryable_technical",
    };
  }

  return { allowed: false, reason: "error_not_retryable" };
}

/**
 * Production attempts — primary + planned fallbacks only.
 */

import type { CostEstimate, Money } from "@/domain/cost";
import type { ExternalJobRef, GeneratedAsset } from "@/domain/generation";
import type { ModelId, ProviderId } from "@/domain/routing/capabilities";
import { ProductionDomainError } from "./errors";

export const ATTEMPT_STATUSES = [
  "pending",
  "executing",
  "submitted",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export type AttemptKind = "primary" | "fallback";

export type ProductionAttemptError = {
  code: string;
  message: string;
  retryable: boolean;
  category?:
    | "technical"
    | "content_rejected"
    | "invalid_input"
    | "unauthorized"
    | "unknown"
    | "quality";
};

export type ProductionAttempt = {
  id: string;
  stepId: string;
  attemptNumber: number;
  kind: AttemptKind;
  providerId: ProviderId;
  modelId: ModelId;
  idempotencyKey: string;
  status: AttemptStatus;
  estimate: CostEstimate;
  /** Explicit provisional commit when provider has no actual cost yet. */
  actualCost?: Money;
  costKind?: "actual" | "provisional";
  error?: ProductionAttemptError;
  providerJob?: ExternalJobRef;
  output?: GeneratedAsset;
  fallbackIndex?: number;
  startedAt?: string;
  completedAt?: string;
};

export function assertAttemptRules(attempts: readonly ProductionAttempt[]): void {
  const primary = attempts.filter((a) => a.kind === "primary");
  if (primary.length > 1) {
    throw new ProductionDomainError(
      "invalid_input",
      "Une seule tentative primaire est autorisée par étape."
    );
  }
  const fallbacks = attempts.filter((a) => a.kind === "fallback");
  if (fallbacks.length > 2) {
    throw new ProductionDomainError(
      "invalid_input",
      "Maximum deux tentatives de fallback par étape."
    );
  }
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const a of attempts) {
    if (ids.has(a.id)) {
      throw new ProductionDomainError("invalid_input", "IDs de tentative en double.");
    }
    ids.add(a.id);
    if (keys.has(a.idempotencyKey)) {
      throw new ProductionDomainError(
        "invalid_input",
        "Clés d'idempotence de tentative en double."
      );
    }
    keys.add(a.idempotencyKey);
  }
}

export function nextAttemptNumber(attempts: readonly ProductionAttempt[]): number {
  if (attempts.length === 0) return 1;
  return Math.max(...attempts.map((a) => a.attemptNumber)) + 1;
}

export function countFallbacksUsed(attempts: readonly ProductionAttempt[]): number {
  return attempts.filter((a) => a.kind === "fallback").length;
}

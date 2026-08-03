/**
 * Idempotency before GenerationEngine.execute — PD owns the store.
 * Engine is called without idempotencyStore to avoid double-begin.
 */

import {
  buildCommandFingerprint,
  buildIdempotencyKey,
  type CommandFingerprintInput,
} from "@/domain/generation";
import { ProductionDomainError } from "@/domain/production";
import type { ProductionIdempotencyPort } from "./ports";

export function productionIdempotencyKey(parts: {
  projectId: string;
  planRevisionId: string;
  sceneId: string;
  stepId: string;
  attempt: number;
}): string {
  return buildIdempotencyKey(parts);
}

export function productionFingerprint(input: CommandFingerprintInput): string {
  return buildCommandFingerprint(input);
}

export type IdempotencyBeginDecision =
  | { action: "proceed"; key: string; fingerprint: string }
  | { action: "reuse_completed"; key: string; fingerprint: string }
  | { action: "wait_in_progress"; key: string; fingerprint: string }
  | { action: "conflict"; key: string; reason: string };

export async function beginAttemptIdempotency(
  port: ProductionIdempotencyPort,
  input: {
    key: string;
    fingerprint: string;
    /** If the run already has a completed attempt with this key. */
    runAlreadyCompleted?: boolean;
  }
): Promise<IdempotencyBeginDecision> {
  if (input.runAlreadyCompleted) {
    return {
      action: "reuse_completed",
      key: input.key,
      fingerprint: input.fingerprint,
    };
  }

  const existing = await port.find(input.key);
  if (existing?.status === "completed") {
    return {
      action: "reuse_completed",
      key: input.key,
      fingerprint: input.fingerprint,
    };
  }
  if (existing?.status === "begun") {
    if (existing.fingerprint !== input.fingerprint) {
      return {
        action: "conflict",
        key: input.key,
        reason: "fingerprint_mismatch",
      };
    }
    return {
      action: "wait_in_progress",
      key: input.key,
      fingerprint: input.fingerprint,
    };
  }

  const begin = await port.begin(input.key, input.fingerprint);
  if (begin.status === "conflict") {
    if (begin.reason === "already_completed") {
      return {
        action: "reuse_completed",
        key: input.key,
        fingerprint: input.fingerprint,
      };
    }
    return {
      action: "conflict",
      key: input.key,
      reason: begin.reason,
    };
  }

  return { action: "proceed", key: input.key, fingerprint: input.fingerprint };
}

export async function completeAttemptIdempotency(
  port: ProductionIdempotencyPort,
  key: string,
  resultFingerprint: string
): Promise<void> {
  await port.complete(key, resultFingerprint);
}

export async function failAttemptIdempotency(
  port: ProductionIdempotencyPort,
  key: string,
  errorCode: string
): Promise<void> {
  await port.fail(key, errorCode);
}

export function assertIdempotencyPortConfigured(
  port: ProductionIdempotencyPort | undefined,
  forRealExecution: boolean
): void {
  if (!port) {
    throw new ProductionDomainError(
      "store_required",
      "ProductionIdempotencyPort requis."
    );
  }
  if (forRealExecution && !port.durable) {
    // Soft signal for dry-run; hard for start is handled by caller warnings/errors.
  }
}

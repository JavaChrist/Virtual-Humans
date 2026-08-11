/**
 * MT-013F — Future bounded execution protections for MV-001 (prep only).
 * Does not enqueue, submit, reserve, or call fal.
 */

import { createHash, randomUUID } from "node:crypto";
import { deepFreeze } from "@/domain/motion/freeze";
import {
  MV001_BENCHMARK_ID,
  MV001_ENDPOINT_ID,
  MV001_MAX_CALLS,
  MV001_PROVIDER_ID,
} from "./mv001-benchmark-profile";

export const MV001_EXECUTE_PROTECTIONS_VERSION = "mt013f-mv001-exec-1.0.0" as const;
export const MV001_IDEMPOTENCY_SCOPE = "MV-001" as const;

export type Mv001ExecuteProtections = {
  schemaVersion: typeof MV001_EXECUTE_PROTECTIONS_VERSION;
  benchmarkId: typeof MV001_BENCHMARK_ID;
  correlationId: string;
  idempotencyKey: string;
  attempt: 1;
  retryOf: null;
  maxEnqueue: 1;
  maxSubmit: 1;
  polling: {
    resubmitAllowed: false;
    timeoutMs: number;
    deadlineIso: string | null;
    submissionUnknownPolicy: "no_automatic_retry";
    cancel: "unsupported";
  };
  lateOutput: "quarantine";
  qcRequired: true;
  humanReviewRequired: true;
  mergeExport: "disabled";
  autoActivate: false;
  fallbacks: 0;
  autoRetry: 0;
  providerId: typeof MV001_PROVIDER_ID;
  modelId: typeof MV001_ENDPOINT_ID;
  preparedOnly: true;
};

export type Mv001SubmitGuardState = {
  enqueueCount: number;
  submitCount: number;
  idempotencyKey: string;
};

/** Deterministic idempotency key for a single MV-001 paid attempt. */
export function buildMv001IdempotencyKey(input: {
  workspaceId: string;
  projectId: string;
  /** Stable operator nonce for this benchmark slot — one per MV-001. */
  benchmarkNonce: string;
}): string {
  const material = [
    MV001_IDEMPOTENCY_SCOPE,
    input.workspaceId,
    input.projectId,
    MV001_PROVIDER_ID,
    MV001_ENDPOINT_ID,
    input.benchmarkNonce,
  ].join("|");
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 32);
  return `mv001-${hash}`;
}

export function createMv001ExecuteProtections(input?: {
  correlationId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  deadlineIso?: string | null;
}): Readonly<Mv001ExecuteProtections> {
  return deepFreeze({
    schemaVersion: MV001_EXECUTE_PROTECTIONS_VERSION,
    benchmarkId: MV001_BENCHMARK_ID,
    correlationId: input?.correlationId ?? randomUUID(),
    idempotencyKey: input?.idempotencyKey ?? `mv001-pending-${randomUUID().slice(0, 8)}`,
    attempt: 1,
    retryOf: null,
    maxEnqueue: 1,
    maxSubmit: MV001_MAX_CALLS,
    polling: {
      resubmitAllowed: false,
      timeoutMs: input?.timeoutMs ?? 15 * 60 * 1000,
      deadlineIso: input?.deadlineIso ?? null,
      submissionUnknownPolicy: "no_automatic_retry",
      cancel: "unsupported",
    },
    lateOutput: "quarantine",
    qcRequired: true,
    humanReviewRequired: true,
    mergeExport: "disabled",
    autoActivate: false,
    fallbacks: 0,
    autoRetry: 0,
    providerId: MV001_PROVIDER_ID,
    modelId: MV001_ENDPOINT_ID,
    preparedOnly: true,
  });
}

export function assertMv001EnqueueAllowed(state: Mv001SubmitGuardState): void {
  if (state.enqueueCount >= 1) {
    throw new Error("MV-001: second enqueue forbidden.");
  }
}

export function assertMv001SubmitAllowed(state: Mv001SubmitGuardState): void {
  if (state.submitCount >= 1) {
    throw new Error("MV-001: second submit forbidden.");
  }
}

export function assertMv001NoReplay(
  seenKeys: ReadonlySet<string>,
  idempotencyKey: string,
): void {
  if (seenKeys.has(idempotencyKey)) {
    throw new Error("MV-001: idempotency replay forbidden.");
  }
}

export function assertMv001NoFallbackOrRetry(protections: Mv001ExecuteProtections): void {
  if (protections.fallbacks !== 0 || protections.autoRetry !== 0) {
    throw new Error("MV-001: fallback/retry must remain 0.");
  }
  if (protections.retryOf !== null || protections.attempt !== 1) {
    throw new Error("MV-001: only attempt 1 with retryOf=null allowed.");
  }
  if (protections.polling.resubmitAllowed) {
    throw new Error("MV-001: resubmit during polling forbidden.");
  }
}

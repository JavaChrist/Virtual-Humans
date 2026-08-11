/**
 * Motion Transfer provider-agnostic port (MT-006).
 * No concrete provider SDK. Credentials never appear in these types.
 */

import { deepFreeze } from "./freeze";
import {
  MotionTransferDomainError,
  MOTION_TRANSFER_PROVIDER_HUMAN_RETRYABLE,
  MotionTransferProviderErrorCodeValues,
  sanitizePublicMessage,
  type MotionTransferProviderErrorCode,
} from "./errors";
import { assertNoSignedUrlLeak } from "./redact";
import type {
  MotionTransferCancelResult,
  MotionTransferEstimate,
  MotionTransferInput,
  MotionTransferJobStatus,
  MotionTransferProviderOutputDescriptor,
  MotionTransferStatus,
  MotionTransferSubmission,
} from "./types";

export const MOTION_TRANSFER_PROVIDER_PORT_VERSION = "1.0.0" as const;

/**
 * Map raw provider lifecycle vocabulary → domain job status.
 * Unknown → fail-closed (throws).
 */
export function mapProviderLifecycleStatus(
  raw: string,
): MotionTransferJobStatus {
  const n = raw.trim().toLowerCase();
  switch (n) {
    case "queued":
    case "pending":
      return "queued";
    case "running":
    case "processing":
    case "in_progress":
      return "processing";
    case "succeeded":
    case "completed":
    case "success":
      return "completed";
    case "failed":
    case "error":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "timed_out":
    case "timeout":
    case "timedout":
      return "timed_out";
    default:
      throw new MotionTransferDomainError(
        "provider_status_unknown",
        "Statut provider inconnu.",
        { diagnostic: `unknown_status:${sanitizePublicMessage(raw)}` },
      );
  }
}

export type MotionTransferProviderContext = {
  correlationId: string;
  workspaceId: string;
  projectId: string;
  runId?: string;
  /** Internal production job id (VHS), not provider job id. */
  jobId?: string;
  attempt: number;
  idempotencyKey: string;
  providerId: string;
  modelId: string;
  /** Absolute ISO deadline for the logical operation. */
  deadlineAt?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  requestedAt: string;
};

/** Media refs presented at the provider boundary — still no secrets. */
export type MotionTransferProviderMediaBoundary = {
  sourceVideoRef: string;
  identityRefs: string[];
  outfitRef?: string;
  /** Ephemeral access tokens live only in adapter concrete impl — never here. */
};

export type MotionTransferProviderEstimateInput = {
  motion: MotionTransferInput;
  /** Billable duration assumption (seconds). */
  billableDurationSeconds: number;
  currency: string;
};

export type MotionTransferProviderSubmitInput = {
  motion: MotionTransferInput;
  /** Selected route ids (already decided by Router). */
  providerId: string;
  modelId: string;
  estimate: MotionTransferEstimate;
  attempt: number;
  mediaBoundary: MotionTransferProviderMediaBoundary;
  outputConstraints: MotionTransferInput["output"];
  /** QC/human policy transported as provenance only — not executed by the port. */
  reviewPolicyProvenance?: Record<string, unknown>;
};

export type MotionTransferProviderPollInput = {
  providerJobId: string;
};

export type MotionTransferProviderCancelInput = {
  providerJobId: string;
};

/** Redacted provider evidence — safe for logs / audit metadata. */
export type MotionTransferProviderErrorEvidence = {
  code: MotionTransferProviderErrorCode;
  publicMessage: string;
  httpStatus?: number;
  providerErrorCode?: string;
  providerErrorType?: string;
  providerRequestId?: string;
  stage?: "estimate" | "submit" | "poll" | "cancel";
  durationMs?: number;
  networkAttempts?: number;
  usagePresent?: boolean;
};

export function isMotionTransferProviderErrorCode(
  code: string,
): code is MotionTransferProviderErrorCode {
  return (MotionTransferProviderErrorCodeValues as readonly string[]).includes(
    code,
  );
}

export function isProviderHumanRetryable(
  code: MotionTransferProviderErrorCode,
): boolean {
  return MOTION_TRANSFER_PROVIDER_HUMAN_RETRYABLE.has(code);
}

function scrubProviderEvidenceText(text: string): string {
  return sanitizePublicMessage(text)
    .replace(/sk-[A-Za-z0-9_-]+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/xi-api-key["']?\s*[:=]\s*["']?[^"'&\s]+/gi, "xi-api-key=[redacted]")
    .slice(0, 280);
}

export function createProviderErrorEvidence(
  input: MotionTransferProviderErrorEvidence,
): Readonly<MotionTransferProviderErrorEvidence> {
  const evidence: MotionTransferProviderErrorEvidence = {
    code: input.code,
    publicMessage: scrubProviderEvidenceText(input.publicMessage),
    httpStatus: input.httpStatus,
    providerErrorCode: input.providerErrorCode
      ? scrubProviderEvidenceText(input.providerErrorCode).slice(0, 80)
      : undefined,
    providerErrorType: input.providerErrorType
      ? scrubProviderEvidenceText(input.providerErrorType).slice(0, 80)
      : undefined,
    providerRequestId: input.providerRequestId
      ? scrubProviderEvidenceText(input.providerRequestId).slice(0, 80)
      : undefined,
    stage: input.stage,
    durationMs: input.durationMs,
    networkAttempts: input.networkAttempts,
    usagePresent: input.usagePresent,
  };
  const blob = JSON.stringify(evidence);
  if (
    /https?:\/\//i.test(blob) ||
    /data:[^;]+;base64,/i.test(blob) ||
    /\bsk-[A-Za-z0-9]{10,}/i.test(blob) ||
    /Bearer\s+(?!\[redacted\])\S+/i.test(blob)
  ) {
    throw new MotionTransferDomainError(
      "provider_failed",
      "Fuite sensible bloquée dans l'évidence provider.",
    );
  }
  return deepFreeze(evidence);
}

export function assertEstimateUsableForPaidReservation(
  estimate: MotionTransferEstimate,
): void {
  if (estimate.mode !== "firm") {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Estimation non ferme — réservation payante interdite.",
    );
  }
  if (
    !Number.isInteger(estimate.estimatedCostMinor) ||
    estimate.estimatedCostMinor < 0
  ) {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Montant d'estimation invalide.",
    );
  }
  if (!/^[A-Z]{3}$/.test(estimate.currency)) {
    throw new MotionTransferDomainError(
      "provider_invalid_request",
      "Devise d'estimation invalide.",
    );
  }
}

export function assertProviderOutputDescriptorSafe(
  output: MotionTransferProviderOutputDescriptor,
): void {
  try {
    assertNoSignedUrlLeak(output);
  } catch {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Référence de sortie provider invalide.",
    );
  }
  if (
    /^https?:\/\//i.test(output.providerOutputRef) ||
    output.providerOutputRef.includes("..") ||
    /data:/i.test(output.providerOutputRef)
  ) {
    throw new MotionTransferDomainError(
      "provider_output_invalid",
      "Référence de sortie provider invalide.",
    );
  }
}

/**
 * Provider-agnostic Motion Transfer port.
 * Compatible in spirit with VHS-109 ProviderAdapter; typed for Motion domain.
 */
export interface MotionTransferProviderPort {
  readonly providerId: string;
  readonly supportedModelIds: readonly string[];
  readonly portVersion: typeof MOTION_TRANSFER_PROVIDER_PORT_VERSION;

  estimate(
    input: MotionTransferProviderEstimateInput,
    context: MotionTransferProviderContext,
  ): Promise<MotionTransferEstimate>;

  submit(
    input: MotionTransferProviderSubmitInput,
    context: MotionTransferProviderContext,
  ): Promise<MotionTransferSubmission>;

  poll(
    input: MotionTransferProviderPollInput,
    context: MotionTransferProviderContext,
  ): Promise<MotionTransferStatus>;

  cancel?(
    input: MotionTransferProviderCancelInput,
    context: MotionTransferProviderContext,
  ): Promise<MotionTransferCancelResult>;
}

export type MotionTransferProviderCallCounters = {
  estimate: number;
  submit: number;
  poll: number;
  cancel: number;
  /** Network attempts simulated — always 0 for fake default. */
  network: number;
};

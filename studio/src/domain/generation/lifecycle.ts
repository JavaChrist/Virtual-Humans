/**
 * Provider execution lifecycle types (VHS-109).
 */

import type { CostEstimate } from "@/domain/cost";
import type { MediaAction } from "@/domain/cost";
import type { CanonicalGenerationInput } from "./input";
import type { ExternalJobRef, GeneratedAsset, ProviderUsage } from "./output";
import type { GenerationError } from "./errors";

export type ProviderExecutionContext = {
  correlationId: string;
  idempotencyKey: string;
  timeoutMs: number;
  requestedAt: string;
  signal?: AbortSignal;
};

export type ProviderEstimateResult = {
  estimate: CostEstimate;
  warnings?: string[];
};

export type ProviderSubmissionResult =
  | {
      status: "completed";
      output: GeneratedAsset;
      usage?: ProviderUsage;
      completedAt: string;
    }
  | {
      status: "submitted";
      providerJob: ExternalJobRef;
      submittedAt: string;
      pollAfterMs?: number;
    };

export type ProviderPollResult =
  | {
      status: "completed";
      output: GeneratedAsset;
      providerJob: ExternalJobRef;
      usage?: ProviderUsage;
      completedAt: string;
    }
  | {
      status: "processing";
      providerJob: ExternalJobRef;
      progress?: number;
      pollAfterMs?: number;
    }
  | {
      status: "failed";
      error: GenerationError;
      providerJob?: ExternalJobRef;
      failedAt: string;
    };

export type ProviderCancelResult = {
  status: "cancelled";
  providerJob?: ExternalJobRef;
  cancelledAt: string;
};

export type ProviderWebhookRequest = {
  headers: Record<string, string>;
  body: string;
};

export type VerifiedProviderEvent = {
  providerJob: ExternalJobRef;
  status: "completed" | "failed" | "processing";
};

/**
 * Provider adapter port — absence of a method means unsupported.
 * Never invent cancel/webhook when the underlying SDK lacks them.
 */
export interface ProviderAdapter {
  readonly providerId: string;
  supports(modelId: string, action: MediaAction): boolean;
  estimate?(
    input: CanonicalGenerationInput,
    context: ProviderExecutionContext,
  ): Promise<ProviderEstimateResult>;
  submit(
    input: CanonicalGenerationInput,
    context: ProviderExecutionContext,
  ): Promise<ProviderSubmissionResult>;
  poll?(
    job: ExternalJobRef,
    context: ProviderExecutionContext,
  ): Promise<ProviderPollResult>;
  cancel?(
    job: ExternalJobRef,
    context: ProviderExecutionContext,
  ): Promise<ProviderCancelResult>;
  verifyWebhook?(request: ProviderWebhookRequest): Promise<VerifiedProviderEvent>;
}

export type GenerationExecutionContext = {
  correlationId: string;
  requestedAt: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Optional future store — unused unless provided. */
  idempotencyStore?: import("./idempotency").IdempotencyStore;
};

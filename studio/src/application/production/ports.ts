/**
 * Production Director ports — injectable effects only (VHS-110).
 * No Supabase implementations in this increment.
 */

import type { Money } from "@/domain/cost";
import type { GeneratedAsset, IdempotencyStore } from "@/domain/generation";
import type {
  ProductionEvent,
  ProductionRun,
  QualityValidationRequest,
  QualityValidationResult,
} from "@/domain/production";
import type { Phase11AWorkerCounters } from "./phase-11a-openai-image-allowlist";

export type BudgetReservationRequest = {
  reservationId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  amount: Money;
  currency: Money["currency"];
};

export type BudgetReservationResult =
  | { status: "reserved"; reservationId: string; amount: Money }
  | { status: "rejected"; reason: string };

export type BudgetCommitRequest = {
  reservationId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  amount: Money;
  /** Explicit when provider did not return an actual cost. */
  costKind: "actual" | "provisional";
};

export type BudgetCommitResult =
  | { status: "committed"; amount: Money; costKind: "actual" | "provisional" }
  | { status: "failed"; reason: string };

export type BudgetReleaseRequest = {
  reservationId: string;
  runId: string;
  sceneId: string;
  stepId: string;
  attemptId: string;
  amount: Money;
};

export type BudgetReleaseResult =
  | { status: "released"; amount: Money }
  | { status: "failed"; reason: string };

export interface ProductionRunStore {
  load(runId: string): Promise<ProductionRun | null>;
  create(run: ProductionRun): Promise<void>;
  save(run: ProductionRun, expectedRevision: number): Promise<ProductionRun>;
  /** Optional concurrency guard — returns existing run id if one is active for the plan. */
  findActiveByPlan?(planRevisionId: string): Promise<string | null>;
}

export interface BudgetReservationPort {
  reserve(request: BudgetReservationRequest): Promise<BudgetReservationResult>;
  commit(request: BudgetCommitRequest): Promise<BudgetCommitResult>;
  release(request: BudgetReleaseRequest): Promise<BudgetReleaseResult>;
}

/** Extends generation IdempotencyStore — durable store required before real production. */
export interface ProductionIdempotencyPort extends IdempotencyStore {
  /** Signal that this store is durable across process restarts. */
  readonly durable: boolean;
}

export interface QualityValidatorPort {
  validate(
    request: QualityValidationRequest,
    context: { correlationId: string; nowIso: string }
  ): Promise<QualityValidationResult>;
}

export type EventPublishFailurePolicy = "ignore" | "fail_soft";

export interface ProductionEventPort {
  publish(event: ProductionEvent): Promise<void>;
}

/** Optional Phase 11A private ingest — wired only when VHS-124 exception path is active. */
export type Phase11AImageMaterializePort = {
  materializeCompletedInlineImage(input: {
    run: ProductionRun;
    output: GeneratedAsset;
    sceneId: string;
    stepId: string;
    attemptId: string;
    nextId: () => string;
    nowIso: string;
  }): Promise<{
    output: GeneratedAsset;
    counters: Phase11AWorkerCounters;
  }>;
};

export type ProductionPorts = {
  runStore: ProductionRunStore;
  budget: BudgetReservationPort;
  idempotency: ProductionIdempotencyPort;
  quality: QualityValidatorPort;
  events: ProductionEventPort;
  eventPublishFailurePolicy?: EventPublishFailurePolicy;
  /** When set, inline OpenAI image outputs are ingested privately before run state save. */
  phase11AImageMaterialize?: Phase11AImageMaterializePort;
};

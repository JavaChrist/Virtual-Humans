/**
 * Production Director result union (VHS-110).
 */

import type {
  ProductionEvent,
  ProductionIssue,
  ProductionResult,
  ProductionRun,
} from "@/domain/production";

export type ProductionWaitingReason =
  | "max_actions_reached"
  | "awaiting_provider_job"
  | "idempotency_in_progress"
  | "concurrency_limit"
  | "no_ready_steps"
  | "budget_blocked";

export type ProductionReviewRequest = {
  sceneId: string;
  stepId: string;
  attemptId: string;
  reasons: { code: string; message: string }[];
};

export type ProductionDirectorResult =
  | {
      status: "started" | "progressed";
      run: ProductionRun;
      events: ProductionEvent[];
    }
  | {
      status: "completed";
      run: ProductionRun;
      result: ProductionResult;
      events: ProductionEvent[];
    }
  | {
      status: "waiting";
      run: ProductionRun;
      reason: ProductionWaitingReason;
      events: ProductionEvent[];
    }
  | {
      status: "needs_review";
      run: ProductionRun;
      review: ProductionReviewRequest;
      events: ProductionEvent[];
    }
  | {
      status: "failed";
      run?: ProductionRun;
      errors: ProductionIssue[];
      events: ProductionEvent[];
    };

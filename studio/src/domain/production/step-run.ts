/**
 * Step run status machine (pure).
 */

import { ProductionDomainError } from "./errors";

export const STEP_RUN_STATUSES = [
  "pending",
  "ready",
  "reserved",
  "executing",
  "submitted",
  "polling",
  "validating",
  "completed",
  "fallback_ready",
  "failed",
  "cancelled",
  "skipped",
] as const;

export type StepRunStatus = (typeof STEP_RUN_STATUSES)[number];

/** Explicit allowed transitions. Same-state is allowed (idempotent). */
export const STEP_RUN_TRANSITIONS: Readonly<Record<StepRunStatus, readonly StepRunStatus[]>> =
  Object.freeze({
    pending: ["pending", "ready", "skipped", "cancelled"],
    ready: ["ready", "reserved", "skipped", "cancelled"],
    // ready/fallback_ready: release after idempotency wait_in_progress (no engine call)
    reserved: ["reserved", "executing", "ready", "fallback_ready", "failed", "cancelled"],
    executing: ["executing", "submitted", "polling", "validating", "completed", "failed", "cancelled"],
    submitted: ["submitted", "polling", "validating", "completed", "failed", "cancelled"],
    polling: ["polling", "validating", "completed", "failed", "cancelled"],
    validating: ["validating", "completed", "fallback_ready", "failed", "cancelled"],
    completed: ["completed"],
    fallback_ready: ["fallback_ready", "reserved", "failed", "cancelled", "skipped"],
    failed: ["failed"],
    cancelled: ["cancelled"],
    skipped: ["skipped"],
  });

export const TERMINAL_STEP_STATUSES: ReadonlySet<StepRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
  "skipped",
]);

export function canTransitionStep(from: StepRunStatus, to: StepRunStatus): boolean {
  return STEP_RUN_TRANSITIONS[from].includes(to);
}

export function assertStepTransition(from: StepRunStatus, to: StepRunStatus): void {
  if (!canTransitionStep(from, to)) {
    throw new ProductionDomainError(
      "invalid_transition",
      `Transition d'étape interdite: ${from} → ${to}.`
    );
  }
}

export function isTerminalStepStatus(status: StepRunStatus): boolean {
  return TERMINAL_STEP_STATUSES.has(status);
}

export function isActiveStepStatus(status: StepRunStatus): boolean {
  return (
    status === "reserved" ||
    status === "executing" ||
    status === "submitted" ||
    status === "polling" ||
    status === "validating"
  );
}

export function isFailedDefinitely(status: StepRunStatus): boolean {
  return status === "failed" || status === "cancelled" || status === "skipped";
}

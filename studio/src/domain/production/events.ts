/**
 * Serializable production events — no secrets, prompts, or signed URLs.
 */

export const PRODUCTION_EVENT_TYPES = [
  "production.started",
  "scene.started",
  "step.ready",
  "attempt.reserved",
  "attempt.started",
  "attempt.submitted",
  "attempt.completed",
  "attempt.failed",
  "fallback.selected",
  "quality.accepted",
  "quality.rejected",
  "scene.completed",
  "scene.failed",
  "production.partial",
  "production.completed",
  "production.failed",
  "production.cancellation_requested",
  "production.cancelled",
] as const;

export type ProductionEventType = (typeof PRODUCTION_EVENT_TYPES)[number];

export type ProductionEvent = {
  id: string;
  type: ProductionEventType;
  at: string;
  correlationId: string;
  projectId: string;
  runId: string;
  sceneId?: string;
  stepId?: string;
  attemptId?: string;
  /** Non-sensitive payload only. */
  data?: Record<string, string | number | boolean | null>;
};

export type ProductionEventFactory = {
  nextId: () => string;
  nowIso: () => string;
};

export function createProductionEvent(
  factory: ProductionEventFactory,
  base: Omit<ProductionEvent, "id" | "at">
): ProductionEvent {
  return {
    id: factory.nextId(),
    at: factory.nowIso(),
    ...base,
  };
}

import { ProjectDomainError } from "./errors";

export const SceneStatusValues = [
  "pending",
  "ready",
  "queued",
  "generating",
  "validating",
  "completed",
  "retryable_failed",
  "failed",
  "cancelled",
  "skipped",
] as const;

export type SceneStatus = (typeof SceneStatusValues)[number];

/**
 * Structural edges only. Preconditions are enforced separately via SceneTransitionContext.
 * Same-status is idempotent.
 */
const ALLOWED: Readonly<Record<SceneStatus, readonly SceneStatus[]>> = {
  pending: ["ready", "skipped", "cancelled"],
  ready: ["queued", "skipped", "cancelled", "pending"],
  queued: ["generating", "cancelled", "skipped"],
  generating: ["validating", "retryable_failed", "failed", "cancelled"],
  validating: ["completed", "retryable_failed", "failed", "cancelled"],
  completed: [], // regeneration requires a new attempt/revision — not a silent mutation
  retryable_failed: ["queued", "failed", "cancelled"],
  failed: ["cancelled", "skipped"],
  cancelled: [],
  skipped: [],
};

export type SceneTransitionContext = {
  hasValidSceneData?: boolean;
  hasApprovedPlan?: boolean;
  jobId?: string;
  hasValidResult?: boolean;
  /** Explicit authorization for retryable_failed → queued */
  retryAuthorized?: boolean;
};

export type SceneState = {
  status: SceneStatus;
  jobId?: string;
};

export function isSceneStatus(value: unknown): value is SceneStatus {
  return typeof value === "string" && (SceneStatusValues as readonly string[]).includes(value);
}

function preconditionFor(from: SceneStatus, to: SceneStatus, ctx: SceneTransitionContext): string | null {
  if (from === "pending" && to === "ready" && !ctx.hasValidSceneData) {
    return "hasValidSceneData";
  }
  if (from === "ready" && to === "queued" && !ctx.hasApprovedPlan) {
    return "hasApprovedPlan";
  }
  if (from === "queued" && to === "generating" && !ctx.jobId) {
    return "jobId";
  }
  if (from === "validating" && to === "completed" && !ctx.hasValidResult) {
    return "hasValidResult";
  }
  if (from === "retryable_failed" && to === "queued" && !ctx.retryAuthorized) {
    return "retryAuthorized";
  }
  return null;
}

export function canTransitionScene(
  from: SceneStatus,
  to: SceneStatus,
  ctx: SceneTransitionContext = {},
): boolean {
  if (!isSceneStatus(from) || !isSceneStatus(to)) return false;
  if (from === to) return true;
  if (!ALLOWED[from].includes(to)) return false;
  return preconditionFor(from, to, ctx) === null;
}

export function assertSceneTransition(
  from: SceneStatus,
  to: SceneStatus,
  ctx: SceneTransitionContext = {},
): void {
  if (!isSceneStatus(from) || !isSceneStatus(to)) {
    throw new ProjectDomainError("invalid_scene_transition", "Unknown scene status.");
  }
  if (from === to) return;

  if (!ALLOWED[from].includes(to)) {
    throw new ProjectDomainError(
      "invalid_scene_transition",
      "This scene status transition is not allowed.",
      { from, to },
    );
  }

  const missing = preconditionFor(from, to, ctx);
  if (missing) {
    throw new ProjectDomainError(
      "missing_precondition",
      "A required precondition for this scene transition is missing.",
      { from, to, precondition: missing },
    );
  }
}

/**
 * Apply a scene transition. completed/cancelled/skipped are terminal —
 * regeneration must create a new attempt/revision outside this mutation.
 */
export function transitionScene(
  state: SceneState,
  to: SceneStatus,
  ctx: SceneTransitionContext = {},
): SceneState {
  assertSceneTransition(state.status, to, ctx);

  if (state.status === to) {
    return { ...state };
  }

  const next: SceneState = { status: to };
  if (to === "generating" && ctx.jobId) {
    next.jobId = ctx.jobId;
  } else if (state.jobId && to !== "pending" && to !== "ready" && to !== "skipped") {
    next.jobId = state.jobId;
  }
  return next;
}

export function getAllowedSceneTransitions(
  from: SceneStatus,
  ctx: SceneTransitionContext = {},
): SceneStatus[] {
  return ALLOWED[from].filter((to) => canTransitionScene(from, to, ctx));
}

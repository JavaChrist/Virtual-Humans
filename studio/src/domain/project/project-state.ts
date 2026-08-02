import { ProjectDomainError } from "./errors";

export const ProjectStatusValues = [
  "draft",
  "planning",
  "awaiting_approval",
  "approved",
  "producing",
  "completed",
  "failed",
  "cancelled",
  "archived",
] as const;

export type ProjectStatus = (typeof ProjectStatusValues)[number];

/**
 * Explicit allowed transitions (no enum ordering).
 * Same-state transitions are treated as idempotent no-ops.
 *
 * Controlled exits: failed, cancelled, archived.
 * Explicit reopen: failed/cancelled → draft|planning; completed → draft (new revision cycle).
 * completed → producing is FORBIDDEN (requires explicit reopen to draft first).
 */
const ALLOWED: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  draft: ["planning", "cancelled", "archived"],
  planning: ["awaiting_approval", "draft", "cancelled", "failed", "archived"],
  awaiting_approval: ["approved", "planning", "cancelled", "failed", "archived"],
  approved: ["producing", "awaiting_approval", "cancelled", "archived"],
  producing: ["completed", "failed", "cancelled"],
  completed: ["archived", "draft"],
  failed: ["draft", "planning", "archived", "cancelled"],
  cancelled: ["draft", "planning", "archived"],
  archived: [], // terminal
};

export type ProjectState = {
  status: ProjectStatus;
  /** Preserved when entering archived / failed / cancelled (never erased by archive). */
  previousStatus?: ProjectStatus;
};

export type ProjectTransitionOptions = {
  /** Required for reopen paths from failed/cancelled/completed. */
  explicitReopen?: boolean;
};

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && (ProjectStatusValues as readonly string[]).includes(value);
}

export function canTransitionProject(
  from: ProjectStatus,
  to: ProjectStatus,
  options: ProjectTransitionOptions = {},
): boolean {
  if (!isProjectStatus(from) || !isProjectStatus(to)) return false;
  if (from === to) return true; // idempotent
  if (!ALLOWED[from].includes(to)) return false;

  // Reopen paths require an explicit command flag
  const reopen =
    (from === "failed" || from === "cancelled") && (to === "draft" || to === "planning");
  const reopenCompleted = from === "completed" && to === "draft";
  if ((reopen || reopenCompleted) && !options.explicitReopen) return false;

  return true;
}

export function assertProjectTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  options: ProjectTransitionOptions = {},
): void {
  if (canTransitionProject(from, to, options)) return;
  throw new ProjectDomainError(
    "invalid_project_transition",
    "This project status transition is not allowed.",
    { from, to, explicitReopen: Boolean(options.explicitReopen) },
  );
}

/**
 * Apply a project status transition.
 * Idempotent same-state returns the same logical state (previousStatus untouched).
 * Archiving stores the prior status in previousStatus without erasing history.
 */
export function transitionProject(
  state: ProjectState,
  to: ProjectStatus,
  options: ProjectTransitionOptions = {},
): ProjectState {
  assertProjectTransition(state.status, to, options);

  if (state.status === to) {
    return { ...state };
  }

  if (to === "archived") {
    return {
      status: "archived",
      previousStatus: state.status,
    };
  }

  // Preserve previousStatus when already set and moving to failed/cancelled
  if (to === "failed" || to === "cancelled") {
    return {
      status: to,
      previousStatus: state.previousStatus ?? state.status,
    };
  }

  // Leaving archived is impossible (ALLOWED empty); other transitions clear previous unless reopen
  return { status: to };
}

export function getAllowedProjectTransitions(
  from: ProjectStatus,
  options: ProjectTransitionOptions = {},
): ProjectStatus[] {
  const list = [...ALLOWED[from]];
  if (!options.explicitReopen) {
    return list.filter((to) => canTransitionProject(from, to, options) && from !== to);
  }
  return list.filter((to) => from !== to);
}

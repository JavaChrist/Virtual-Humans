/**
 * Domain errors for project/scene state, revisions, concurrency, approvals (VHS-004).
 * Safe for logs — never embed full artifact payloads.
 */

export type ProjectDomainErrorCode =
  | "invalid_project_transition"
  | "invalid_scene_transition"
  | "missing_precondition"
  | "invalid_revision_chain"
  | "version_conflict"
  | "incompatible_artifact"
  | "revision_not_found"
  | "stale_approval"
  | "non_serializable_value"
  | "invalid_argument";

export class ProjectDomainError extends Error {
  readonly code: ProjectDomainErrorCode;
  readonly publicMessage: string;
  /** Structured, non-sensitive details for tests / ops. */
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(
    code: ProjectDomainErrorCode,
    publicMessage: string,
    details?: Record<string, string | number | boolean | null>,
    diagnostic?: string,
  ) {
    super(diagnostic ?? publicMessage);
    this.name = "ProjectDomainError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.details = details;
  }
}

export function isProjectDomainError(e: unknown): e is ProjectDomainError {
  return e instanceof ProjectDomainError;
}

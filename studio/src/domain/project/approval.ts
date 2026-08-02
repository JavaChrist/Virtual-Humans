import { IsoDateTimeSchema, type DomainId } from "@/domain/shared";
import { REQUIRED_FOR_PRODUCTION, isArtifactType, type ArtifactType } from "./artifact-types";
import { ProjectDomainError } from "./errors";
import type { ActiveRevision, Revision } from "./revision";

export const MAX_APPROVAL_COMMENT_LENGTH = 2000;

export type ApprovalStatus = "approved" | "rejected";

export type Approval = {
  id: DomainId;
  projectId: DomainId;
  artifactType: ArtifactType;
  revisionId: DomainId;
  revision: number;
  status: ApprovalStatus;
  decidedAt: string;
  decidedBy: DomainId;
  comment?: string;
};

export type CreateApprovalInput = {
  id: string;
  target: Revision<unknown>;
  status: ApprovalStatus;
  decidedBy: string;
  decidedAt?: string;
  comment?: string;
};

export function createApproval(input: CreateApprovalInput): Approval {
  if (!isArtifactType(input.target.artifactType)) {
    throw new ProjectDomainError("incompatible_artifact", "Unknown artifact type.");
  }
  if (input.status !== "approved" && input.status !== "rejected") {
    throw new ProjectDomainError("invalid_argument", "Approval status must be approved or rejected.");
  }
  if (!input.id?.trim() || !input.decidedBy?.trim()) {
    throw new ProjectDomainError("invalid_argument", "Approval id and decidedBy are required.");
  }
  const decidedAt = input.decidedAt ?? new Date().toISOString();
  if (!IsoDateTimeSchema.safeParse(decidedAt).success) {
    throw new ProjectDomainError("invalid_argument", "decidedAt must be a valid UTC ISO-8601 timestamp.");
  }
  if (input.comment != null) {
    if (typeof input.comment !== "string" || input.comment.length > MAX_APPROVAL_COMMENT_LENGTH) {
      throw new ProjectDomainError("invalid_argument", "Approval comment is invalid or too long.");
    }
  }

  const approval: Approval = {
    id: input.id,
    projectId: input.target.projectId,
    artifactType: input.target.artifactType,
    revisionId: input.target.id,
    revision: input.target.revision,
    status: input.status,
    decidedAt,
    decidedBy: input.decidedBy,
  };
  if (input.comment) approval.comment = input.comment;
  return Object.freeze(approval);
}

/**
 * An approval is stale if it does not target the currently active revision
 * of the same project + artifact type.
 */
export function isApprovalCurrent(approval: Approval, active: ActiveRevision): boolean {
  return (
    approval.projectId === active.projectId &&
    approval.artifactType === active.artifactType &&
    approval.revisionId === active.revisionId &&
    approval.revision === active.revision
  );
}

export function assertApprovalCurrent(approval: Approval, active: ActiveRevision): void {
  if (!isApprovalCurrent(approval, active)) {
    throw new ProjectDomainError("stale_approval", "Approval does not target the active revision.", {
      artifactType: approval.artifactType,
      approvalRevision: approval.revision,
      activeRevision: active.revision,
    });
  }
}

export type ProductionReadinessInput = {
  projectId: string;
  /** Active revision pointers per artifact type. */
  activeByType: Partial<Record<ArtifactType, ActiveRevision>>;
  /** Latest decision per artifact type (must match active revision to count). */
  approvalsByType: Partial<Record<ArtifactType, Approval>>;
  /** Override the required set (defaults to REQUIRED_FOR_PRODUCTION). */
  requiredTypes?: readonly ArtifactType[];
};

export type ProductionReadiness = {
  ready: boolean;
  missing: ArtifactType[];
  unapproved: ArtifactType[];
  stale: ArtifactType[];
};

/**
 * Pure check: can production start?
 * Requires each required artifact to have an active revision and a matching approval = approved.
 */
export function checkProductionReadiness(input: ProductionReadinessInput): ProductionReadiness {
  const required = input.requiredTypes ?? REQUIRED_FOR_PRODUCTION;
  const missing: ArtifactType[] = [];
  const unapproved: ArtifactType[] = [];
  const stale: ArtifactType[] = [];

  for (const type of required) {
    const active = input.activeByType[type];
    if (!active || active.projectId !== input.projectId) {
      missing.push(type);
      continue;
    }
    const approval = input.approvalsByType[type];
    if (!approval) {
      unapproved.push(type);
      continue;
    }
    if (!isApprovalCurrent(approval, active)) {
      stale.push(type);
      continue;
    }
    if (approval.status !== "approved") {
      unapproved.push(type);
    }
  }

  return {
    ready: missing.length === 0 && unapproved.length === 0 && stale.length === 0,
    missing,
    unapproved,
    stale,
  };
}

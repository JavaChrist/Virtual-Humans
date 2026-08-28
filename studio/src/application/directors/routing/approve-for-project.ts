/**
 * VHS-123 — persist human approval for GenerationPlan (append-only).
 */
import { randomUUID } from "node:crypto";
import { createApproval, isApprovalCurrent, type Approval } from "@/domain/project";
import type { ArtifactType } from "@/domain/project/artifact-types";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { authorizeDirectorAction } from "@/application/director/director-action-policy";
import type { DirectorRunContext } from "@/application/directors/marketing/result";

export type ApproveArtifactInput = {
  projectId: string;
  artifactType: Extract<ArtifactType, "generation_plan" | "video_project_brief" | "storyboard_project">;
  artifactId: string;
  revision: number;
  decision: "approved" | "rejected";
  expectedProjectRevision: number;
  confirmation: true;
  comment?: string;
};

export type ApprovalView = {
  id: string;
  artifactType: ArtifactType;
  artifactId: string;
  revision: number;
  status: "approved" | "rejected";
  decidedAt: string;
  decidedBy: string;
  stale: boolean;
  projectRevision: number;
};

export type ApproveArtifactResult =
  | { status: "completed" | "existing"; approval: ApprovalView }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 409 | 422 | 503;
    };

export type ArtifactApprovalPort = {
  persistApproval(input: {
    id: string;
    workspaceId: string;
    projectId: string;
    artifactType: string;
    artifactId: string;
    revision: number;
    status: "approved" | "rejected";
    decidedBy: string;
    comment?: string;
    expectedProjectRevision: number;
    confirmation: true;
    correlationId: string;
  }): Promise<{
    status: "created" | "existing";
    approvalId: string;
    projectRevision: number;
    artifactRevision: number;
  }>;
};

export type ApproveArtifactForProjectDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  approvals: ArtifactApprovalPort;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
  actorId?: string;
};

export type ApproveArtifactForProject = {
  execute(input: ApproveArtifactInput, context: DirectorRunContext): Promise<ApproveArtifactResult>;
};

function failed(
  code: string,
  publicMessage: string,
  httpHint: Extract<ApproveArtifactResult, { status: "failed" }>["httpHint"],
): Extract<ApproveArtifactResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false };
}

export function createApproveArtifactForProject(
  deps: ApproveArtifactForProjectDeps,
): ApproveArtifactForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const actorId = deps.actorId ?? "shared-password-user";

  return {
    async execute(input, context) {
      const mode =
        input.artifactType === "generation_plan"
          ? "approve_generation_plan"
          : "approve_text";
      const denied = authorizeDirectorAction(
        { routeId: "approvals", method: "POST", mode },
        env,
      );
      if (!denied.allowed) {
        return failed(denied.code, denied.publicMessage, 503);
      }
      if (!canUseDirectorV2Persistence(env)) {
        return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failed("confirmation_required", "Confirmation humaine explicite requise.", 400);
      }
      if (input.decision !== "approved" && input.decision !== "rejected") {
        return failed("invalid_decision", "Décision d'approbation invalide.", 400);
      }

      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failed("not_found", "Projet introuvable.", 400);
      }
      if (project.activeRevision !== input.expectedProjectRevision) {
        return failed(
          "optimistic_conflict",
          "Le projet a changé depuis la vérification.",
          409,
        );
      }

      const active = await deps.artifacts.getActive(input.projectId, input.artifactType);
      if (!active) {
        return failed("artifact_not_active", "Aucune révision active pour cet artifact.", 422);
      }
      if (active.artifactId !== input.artifactId || active.revision !== input.revision) {
        return failed(
          "approval_revision_not_active",
          "Seule la révision active peut être approuvée.",
          409,
        );
      }
      if (active.stale === true) {
        return failed(
          "artifact_stale",
          "Cet artifact est obsolète (révision amont) — impossible d'approuver.",
          422,
        );
      }

      const artifact = await deps.artifacts.load(input.artifactId);
      if (!artifact) {
        return failed("artifact_missing", "Artifact introuvable.", 422);
      }

      // Domain validation (type, comment length, etc.)
      let domainApproval: Approval;
      try {
        domainApproval = createApproval({
          id: id(),
          target: {
            id: artifact.id,
            projectId: input.projectId,
            artifactType: input.artifactType,
            revision: input.revision,
            schemaVersion: artifact.schemaVersion,
            value: artifact.value as Readonly<unknown>,
            createdAt: artifact.createdAt,
            createdBy: artifact.createdBy,
            correlationId: artifact.correlationId,
          },
          status: input.decision,
          decidedBy: actorId,
          comment: input.comment,
        });
      } catch {
        return failed("invalid_approval", "Approbation invalide.", 400);
      }

      // Defensive: ensure domain would consider it current against active pointer
      if (
        !isApprovalCurrent(domainApproval, {
          projectId: input.projectId,
          artifactType: input.artifactType,
          revisionId: active.artifactId,
          revision: active.revision,
          updatedAt: active.updatedAt,
          updatedBy: active.updatedBy,
        })
      ) {
        return failed("stale_approval", "Approbation non alignée sur la révision active.", 409);
      }

      try {
        const persisted = await deps.approvals.persistApproval({
          id: domainApproval.id,
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          artifactType: input.artifactType,
          artifactId: input.artifactId,
          revision: input.revision,
          status: input.decision,
          decidedBy: actorId,
          comment: input.comment,
          expectedProjectRevision: input.expectedProjectRevision,
          confirmation: true,
          correlationId: context.correlationId,
        });
        return {
          status: persisted.status === "existing" ? "existing" : "completed",
          approval: {
            id: persisted.approvalId,
            artifactType: input.artifactType,
            artifactId: input.artifactId,
            revision: persisted.artifactRevision,
            status: input.decision,
            decidedAt: domainApproval.decidedAt,
            decidedBy: actorId,
            stale: false,
            projectRevision: persisted.projectRevision,
          },
        };
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        const diagnostic =
          error && typeof error === "object" && "message" in error
            ? String((error as { message: unknown }).message)
            : "";
        if (code === "optimistic_conflict" || diagnostic.includes("optimistic_conflict")) {
          return failed("optimistic_conflict", "Conflit de révision optimiste.", 409);
        }
        if (code === "conflict" || diagnostic.includes("generation_plan_not_ready")) {
          return failed("generation_plan_not_ready", "Le plan n'est pas prêt pour approbation.", 422);
        }
        if (diagnostic.includes("approval_revision_not_active")) {
          return failed(
            "approval_revision_not_active",
            "Seule la révision active peut être approuvée.",
            409,
          );
        }
        return failed("persist_failed", "Persistance de l'approbation impossible.", 503);
      }
    },
  };
}

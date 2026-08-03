/**
 * Create Director project from finalized brief (VHS-116).
 */

import {
  BRIEF_SCHEMA_VERSION,
  finalizeBrief,
  type VideoProjectBrief,
  type VideoProjectBriefDraft,
  type VideoProjectBriefFields,
} from "@/domain/brief";
import type { CreateProjectWithBriefPort } from "@/infrastructure/db/repositories/create-project-with-brief";

export type CreateDirectorProjectCommand = {
  projectId: string;
  artifactId: string;
  workspaceId: string;
  /** Draft fields or already-normalized fields — finalized in the service. */
  draft: VideoProjectBriefDraft | { fields: VideoProjectBriefFields };
  expectedBriefRevision: 1;
  correlationId: string;
  actor: {
    type: "shared_password";
    id: string;
  };
};

export type CreateDirectorProjectResult =
  | {
      status: "created" | "existing";
      projectId: string;
      artifactId: string;
      revision: 1;
      projectName: string;
      createdAt: string;
      updatedAt: string;
    }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
    };

export type CreateDirectorProject = {
  execute(command: CreateDirectorProjectCommand): Promise<CreateDirectorProjectResult>;
};

export type CreateDirectorProjectDeps = {
  port: CreateProjectWithBriefPort;
  nowIso: () => string;
};

function asDraft(input: CreateDirectorProjectCommand["draft"]): VideoProjectBriefDraft {
  if ("draftVersion" in input && "updatedAt" in input && "currentStep" in input) {
    return input;
  }
  return {
    draftVersion: "1.0.0",
    updatedAt: new Date().toISOString(),
    currentStep: 5,
    fields: input.fields,
  };
}

export function createCreateDirectorProject(
  deps: CreateDirectorProjectDeps
): CreateDirectorProject {
  return {
    async execute(command) {
      if (command.expectedBriefRevision !== 1) {
        return {
          status: "failed",
          code: "invalid_revision",
          publicMessage: "Seule la révision 1 est acceptée à la création.",
        };
      }
      if (!command.workspaceId || !command.projectId || !command.artifactId) {
        return {
          status: "failed",
          code: "invalid_input",
          publicMessage: "Identifiants de création manquants.",
        };
      }

      let brief: VideoProjectBrief;
      try {
        brief = finalizeBrief(asDraft(command.draft), {
          id: command.artifactId,
          projectId: command.projectId,
          createdBy: command.actor.id,
          correlationId: command.correlationId,
          createdAt: deps.nowIso(),
          revision: 1,
        });
      } catch (e) {
        const publicMessage =
          e && typeof e === "object" && "publicMessage" in e
            ? String((e as { publicMessage: string }).publicMessage)
            : "Brief invalide.";
        return {
          status: "failed",
          code: "invalid_brief",
          publicMessage,
        };
      }

      try {
        const result = await deps.port.execute({
          workspaceId: command.workspaceId,
          projectId: command.projectId,
          artifactId: command.artifactId,
          projectName: brief.projectName,
          brief: { ...brief } as unknown as Record<string, unknown>,
          schemaVersion: BRIEF_SCHEMA_VERSION,
          correlationId: command.correlationId,
          actorType: command.actor.type,
          actorId: command.actor.id,
          createdBy: command.actor.id,
        });
        return {
          status: result.status,
          projectId: result.projectId,
          artifactId: result.artifactId,
          revision: 1,
          projectName: brief.projectName,
          createdAt: result.createdAt || brief.createdAt,
          updatedAt: result.updatedAt || brief.createdAt,
        };
      } catch (e) {
        const code =
          e && typeof e === "object" && "code" in e
            ? String((e as { code: string }).code)
            : "unknown";
        const publicMessage =
          e && typeof e === "object" && "publicMessage" in e
            ? String((e as { publicMessage: string }).publicMessage)
            : "Création du projet impossible.";
        return { status: "failed", code, publicMessage };
      }
    },
  };
}

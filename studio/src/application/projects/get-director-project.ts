/**
 * Load Director project view model (VHS-116).
 */

import {
  VideoProjectBriefSchema,
  type VideoProjectBrief,
} from "@/domain/brief";
import type {
  ArtifactRepository,
  ProjectRepository,
  PersistedVideoProject,
} from "./ports";

export type DirectorProjectView = {
  project: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  brief: {
    id: string;
    revision: number;
    projectName: string;
    platform: string;
    durationSeconds: number;
    language: string;
    characterId?: string;
    objective: string;
    subjectName: string;
  };
  nextStep: {
    id: "marketing_analysis";
    label: string;
    enabled: false;
  };
};

export type GetDirectorProjectResult =
  | { status: "ok"; view: DirectorProjectView }
  | { status: "not_found"; publicMessage: string }
  | { status: "invalid_artifact"; publicMessage: string }
  | { status: "failed"; code: string; publicMessage: string };

export type GetDirectorProject = {
  execute(
    projectId: string,
    workspaceId: string
  ): Promise<GetDirectorProjectResult>;
};

export function createGetDirectorProject(deps: {
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
}): GetDirectorProject {
  return {
    async execute(projectId, workspaceId) {
      try {
        const project = await deps.projects.load(projectId);
        if (!project || project.workspaceId !== workspaceId) {
          return {
            status: "not_found",
            publicMessage: "Projet introuvable.",
          };
        }
        const active = await deps.artifacts.getActive(
          projectId,
          "video_project_brief"
        );
        if (!active) {
          return {
            status: "invalid_artifact",
            publicMessage: "Brief actif introuvable pour ce projet.",
          };
        }
        const artifact = await deps.artifacts.load(active.artifactId);
        if (!artifact) {
          return {
            status: "invalid_artifact",
            publicMessage: "Artifact brief introuvable.",
          };
        }
        const parsed = VideoProjectBriefSchema.safeParse(artifact.value);
        if (!parsed.success) {
          return {
            status: "invalid_artifact",
            publicMessage: "Brief persisté invalide.",
          };
        }
        const brief = parsed.data as VideoProjectBrief;
        return {
          status: "ok",
          view: mapDirectorProjectView(project, brief, active.revision, active.artifactId),
        };
      } catch (e) {
        return {
          status: "failed",
          code: "unknown",
          publicMessage:
            e instanceof Error ? e.message : "Lecture du projet impossible.",
        };
      }
    },
  };
}

export function mapDirectorProjectView(
  project: PersistedVideoProject,
  brief: VideoProjectBrief,
  revision: number,
  artifactId: string
): DirectorProjectView {
  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    brief: {
      id: artifactId,
      revision,
      projectName: brief.projectName,
      platform: brief.platform,
      durationSeconds: brief.durationSeconds,
      language: brief.language,
      characterId: brief.characterId,
      objective: brief.objective,
      subjectName: brief.subjectName,
    },
    nextStep: {
      id: "marketing_analysis",
      label: "Analyse marketing",
      enabled: false,
    },
  };
}

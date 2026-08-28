/**
 * Project / artifact persistence ports (VHS-113).
 */

import type { ArtifactType } from "@/domain/project";
import type { ProjectStatus } from "@/domain/project";

export type PersistedVideoProject = {
  id: string;
  workspaceId: string;
  name: string;
  status: ProjectStatus;
  activeRevision: number;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  correlationId: string;
};

export type PersistedArtifact = {
  id: string;
  workspaceId: string;
  projectId: string;
  artifactType: ArtifactType;
  revision: number;
  schemaVersion: string;
  parentRevisionId: string | null;
  value: unknown;
  createdAt: string;
  createdBy: string;
  correlationId: string;
};

export type ActiveArtifactPointer = {
  projectId: string;
  artifactType: ArtifactType;
  artifactId: string;
  revision: number;
  updatedAt: string;
  updatedBy: string;
  /** Authoritative stale flag (VHS-126). Absent/false = current. */
  stale?: boolean;
  staleReason?: string | null;
  staleSince?: string | null;
};

export interface ProjectRepository {
  create(project: PersistedVideoProject): Promise<void>;
  load(projectId: string): Promise<PersistedVideoProject | null>;
  saveStatus(
    projectId: string,
    status: ProjectStatus,
    expectedActiveRevision: number,
    updatedAt: string
  ): Promise<PersistedVideoProject>;
  /** Recent projects in workspace — newest first (VHS-116). */
  listRecent?(limit: number): Promise<PersistedVideoProject[]>;
  /** Non-archived projects in the repository workspace (quota). */
  countActiveNonArchived?(): Promise<number>;
}

export interface ArtifactRepository {
  append(artifact: PersistedArtifact): Promise<void>;
  load(artifactId: string): Promise<PersistedArtifact | null>;
  loadByRevision(
    projectId: string,
    artifactType: ArtifactType,
    revision: number
  ): Promise<PersistedArtifact | null>;
  getActive(
    projectId: string,
    artifactType: ArtifactType
  ): Promise<ActiveArtifactPointer | null>;
  setActive(input: {
    projectId: string;
    artifactType: ArtifactType;
    artifactId: string;
    expectedRevision: number;
    updatedBy: string;
  }): Promise<ActiveArtifactPointer>;
}

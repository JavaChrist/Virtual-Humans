/**
 * List recent Director projects (VHS-116).
 */

import type { ArtifactRepository, ProjectRepository } from "./ports";
import { VideoProjectBriefSchema } from "@/domain/brief";

export type DirectorProjectListItem = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  platform?: string;
  durationSeconds?: number;
};

export type ListDirectorProjectsResult =
  | { status: "ok"; items: DirectorProjectListItem[] }
  | { status: "failed"; publicMessage: string };

export type ListDirectorProjects = {
  execute(limit?: number): Promise<ListDirectorProjectsResult>;
};

export function createListDirectorProjects(deps: {
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
}): ListDirectorProjects {
  return {
    async execute(limit = 20) {
      try {
        if (!deps.projects.listRecent) {
          return { status: "ok", items: [] };
        }
        const projects = await deps.projects.listRecent(limit);
        const items: DirectorProjectListItem[] = [];
        for (const p of projects) {
          let platform: string | undefined;
          let durationSeconds: number | undefined;
          try {
            const active = await deps.artifacts.getActive(
              p.id,
              "video_project_brief"
            );
            if (active) {
              const art = await deps.artifacts.load(active.artifactId);
              const parsed = VideoProjectBriefSchema.safeParse(art?.value);
              if (parsed.success) {
                platform = parsed.data.platform;
                durationSeconds = parsed.data.durationSeconds;
              }
            }
          } catch {
            // non-blocking enrichment
          }
          items.push({
            id: p.id,
            name: p.name,
            status: p.status,
            updatedAt: p.updatedAt,
            platform,
            durationSeconds,
          });
        }
        return { status: "ok", items };
      } catch {
        return {
          status: "failed",
          publicMessage: "Impossible de charger les projets récents.",
        };
      }
    },
  };
}

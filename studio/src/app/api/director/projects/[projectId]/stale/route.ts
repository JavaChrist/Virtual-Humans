/**
 * GET project stale active artifacts (VHS-126).
 */

import { NextRequest } from "next/server";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger, startObservedRoute } from "@/infrastructure/observability";
import { determineRestartPoint } from "@/domain/project";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/stale",
    operation: "director.stale.get",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) {
    return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  try {
    const stack = createDirectorPersistenceStack();
    const project = await stack.projects.load(projectId);
    if (!project || project.workspaceId !== stack.workspaceId) {
      return obs.json({ error: "Projet introuvable." }, { status: 404 });
    }
    const stale = await stack.listStale(projectId);
    const restartPoint =
      stale.some((s) => s.causedByType === "video_project_brief")
        ? determineRestartPoint("video_project_brief")
        : null;
    return obs.json({
      projectRevision: project.activeRevision,
      stale,
      restartPoint,
    });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Lecture stale impossible." }, { status: 500 });
  }
}

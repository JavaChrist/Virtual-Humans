/**
 * GET Director project by id (VHS-116).
 */

import { NextRequest } from "next/server";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger, startObservedRoute } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]",
    operation: "director.project.get",
  });

  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }

  const { projectId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      projectId
    )
  ) {
    return obs.json({ error: "Identifiant de projet invalide." }, { status: 400 });
  }

  try {
    const stack = createDirectorPersistenceStack();
    const result = await stack.getProject.execute(projectId, stack.workspaceId);
    if (result.status === "not_found") {
      return obs.json({ error: result.publicMessage }, { status: 404 });
    }
    if (result.status === "invalid_artifact") {
      return obs.json({ error: result.publicMessage }, { status: 422 });
    }
    if (result.status === "failed") {
      return obs.json({ error: result.publicMessage }, { status: 503 });
    }
    logger.info("director.project.loaded", obs.context, {
      projectId: result.view.project.id,
      status: result.view.project.status,
    });
    return obs.json({ view: result.view });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Lecture du projet impossible." }, { status: 500 });
  }
}

/**
 * GET Brief revision comparison (VHS-126) — business fields only.
 */

import { NextRequest } from "next/server";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger, startObservedRoute } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/brief/compare",
    operation: "director.brief.compare",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) {
    return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const leftRaw = req.nextUrl.searchParams.get("left");
  const rightRaw = req.nextUrl.searchParams.get("right");
  const leftRevision = leftRaw != null ? Number(leftRaw) : undefined;
  const rightRevision = rightRaw != null ? Number(rightRaw) : undefined;
  if (
    (leftRaw != null && (!Number.isInteger(leftRevision) || leftRevision! < 1)) ||
    (rightRaw != null && (!Number.isInteger(rightRevision) || rightRevision! < 1))
  ) {
    return obs.json({ error: "Révisions invalides." }, { status: 422 });
  }

  try {
    const stack = createDirectorPersistenceStack();
    const project = await stack.projects.load(projectId);
    if (!project || project.workspaceId !== stack.workspaceId) {
      return obs.json({ error: "Projet introuvable." }, { status: 404 });
    }
    const comparison = await stack.reviseBrief.compare(projectId, {
      leftRevision,
      rightRevision,
    });
    return obs.json({ comparison });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Comparaison impossible." }, { status: 500 });
  }
}

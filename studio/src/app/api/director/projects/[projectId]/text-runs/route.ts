/**
 * GET text Director run status (8I-B).
 * Read-only view of public.director_runs — no begin/execute, no provider call.
 *
 * Query:
 * - director = marketing|creative|script|art|storyboard (required)
 * - runId = uuid (optional) — load specific run; else latest active for director
 */

import { NextRequest } from "next/server";
import {
  isTextDirectorType,
  type TextDirectorType,
} from "@/application/directors/text-run-status";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import {
  logger,
  startObservedRoute,
} from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/text-runs",
    operation: "director.text_runs.get",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) {
    return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  const directorRaw = req.nextUrl.searchParams.get("director") ?? "";
  if (!isTextDirectorType(directorRaw)) {
    return obs.json({ error: "Director invalide." }, { status: 400 });
  }
  const directorType = directorRaw as TextDirectorType;
  const runId = req.nextUrl.searchParams.get("runId");
  if (runId != null && !isUuid(runId)) {
    return obs.json({ error: "Identifiant de run invalide." }, { status: 400 });
  }

  try {
    const port = createDirectorPersistenceStack().textDirectorRunStatus;
    const run = runId
      ? await port.loadRun({
          projectId,
          directorRunId: runId,
          directorType,
        })
      : await port.findActiveRun({ projectId, directorType });

    // Fail-closed isolation: unknown / wrong type → null (not 404 leak across projects).
    return obs.json({
      director: directorType,
      run,
    });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Lecture du run impossible." }, { status: 500 });
  }
}

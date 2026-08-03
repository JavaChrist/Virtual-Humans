import { NextRequest } from "next/server";
import { z } from "zod";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import {
  generateCorrelationId,
  logger,
  resolveCorrelationId,
  startObservedRoute,
} from "@/infrastructure/observability";

export const dynamic = "force-dynamic";
type RouteParams = { params: Promise<{ projectId: string }> };

const BodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("dry_run") }),
  z.object({ mode: z.literal("dry-run") }),
  z.object({
    mode: z.literal("execute"),
    expectedStoryboardRevision: z.number().int().positive(),
    expectedVisualDirectionRevision: z.number().int().positive().optional(),
    expectedVideoScriptRevision: z.number().int().positive().optional(),
  }),
]);

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/prompts",
    operation: "director.prompts.get",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  try {
    const dryRun = await createDirectorPersistenceStack().buildScenePackages.dryRun(
      { projectId },
      { correlationId: obs.context.correlationId, mode: "dry-run" },
    );
    return obs.json({ dryRun, packageSet: dryRun.existingPackageSet ?? null });
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      return obs.json({ error: error.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, error);
    return obs.json({ error: "Lecture packages impossible." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/prompts",
    operation: "director.prompts.post",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return obs.json({ error: "JSON invalide." }, { status: 400 });
  }
  const body = BodySchema.safeParse(raw);
  if (!body.success) return obs.json({ error: "Requête invalide." }, { status: 400 });
  const correlationId =
    resolveCorrelationId(req.headers.get("x-correlation-id")) ?? generateCorrelationId();
  try {
    const builder = createDirectorPersistenceStack().buildScenePackages;
    if (body.data.mode !== "execute") {
      const dryRun = await builder.dryRun({ projectId }, { correlationId, mode: "dry-run" });
      return obs.json({ dryRun });
    }
    const result = await builder.execute(
      {
        projectId,
        expectedStoryboardRevision: body.data.expectedStoryboardRevision,
        expectedVisualDirectionRevision: body.data.expectedVisualDirectionRevision,
        expectedVideoScriptRevision: body.data.expectedVideoScriptRevision,
      },
      { correlationId, mode: "execute" },
    );
    if (result.status === "already_running") {
      return obs.json(
        {
          status: result.status,
          directorRunId: result.directorRunId,
          error: { code: "run_in_progress", retryable: false, message: result.publicMessage },
        },
        { status: 202 },
      );
    }
    if (result.status === "needs_input") return obs.json(result, { status: 422 });
    if (result.status === "failed") {
      return obs.json(
        {
          status: "failed",
          error: { code: result.code, retryable: result.retryable, message: result.publicMessage },
        },
        { status: result.httpHint },
      );
    }
    return obs.json(result);
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      return obs.json({ error: error.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, error);
    return obs.json(
      {
        status: "failed",
        error: {
          code: "internal_error",
          retryable: false,
          message: "Échec de la construction des packages.",
        },
      },
      { status: 500 },
    );
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { redactDirectorStoragePathsForClient } from "@/application/postproduction/redact-director-storage-paths";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import {
  authorizeDirectorAction,
  directorActionHttp,
} from "@/application/director/director-action-policy";
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
    confirmation: z.literal(true),
    destinationId: z.enum(["download", "aiccos"]).optional(),
  }),
]);

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/export",
    operation: "director.export.get",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  try {
    const stack = createDirectorPersistenceStack();
    const dryRun = await stack.prepareExport.dryRun(
      { projectId, destinationId: "download" },
      { correlationId: obs.context.correlationId, mode: "dry-run" },
    );
    const ep = await stack.artifacts.getActive(projectId, "export_package");
    let exportPackage = null as unknown;
    if (ep) {
      const loaded = await stack.artifacts.load(ep.artifactId);
      exportPackage = loaded?.value ?? null;
    }
    return obs.json(
      redactDirectorStoragePathsForClient({
        dryRun,
        exportPackage,
        exportPackageRevision: ep?.revision ?? null,
      }),
    );
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      return obs.json({ error: error.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, error);
    return obs.json({ error: "Lecture export impossible." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/export",
    operation: "director.export.post",
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
    const prepare = createDirectorPersistenceStack().prepareExport;
    if (body.data.mode !== "execute") {
      const dryRun = await prepare.dryRun(
        { projectId, destinationId: "download" },
        { correlationId, mode: "dry-run" },
      );
      return obs.json({ dryRun });
    }
    const denied = directorActionHttp(
      authorizeDirectorAction({ routeId: "export", method: "POST", mode: "execute" }),
    );
    if (denied) {
      return obs.json(
        {
          status: "failed",
          error: { code: denied.body.code, retryable: false, message: denied.body.error },
        },
        { status: denied.status },
      );
    }
    const result = await prepare.execute(
      {
        projectId,
        confirmation: true,
        destinationId: body.data.destinationId ?? "download",
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
    if (result.status === "failed") {
      return obs.json(
        {
          status: "failed",
          error: { code: result.code, retryable: result.retryable, message: result.publicMessage },
        },
        { status: result.httpHint },
      );
    }
    return obs.json(redactDirectorStoragePathsForClient(result));
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      return obs.json({ error: error.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, error);
    return obs.json(
      {
        status: "failed",
        error: { code: "internal_error", retryable: false, message: "Échec de l'export." },
      },
      { status: 500 },
    );
  }
}

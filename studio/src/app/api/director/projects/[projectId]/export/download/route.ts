import { NextRequest } from "next/server";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger, startObservedRoute } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";
type RouteParams = { params: Promise<{ projectId: string }> };

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

/**
 * Download the final media bytes for the active ExportPackage.
 * Manifest JSON is available at …/export/manifest — never confused with this response.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/export/download",
    operation: "director.export.download",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  try {
    const result = await createDirectorPersistenceStack().downloadFinalAsset.execute({
      projectId,
    });
    if (result.status === "failed") {
      return obs.json(
        {
          status: "failed",
          error: { code: result.code, retryable: false, message: result.publicMessage },
        },
        { status: result.httpHint },
      );
    }
    return new Response(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        ...result.headers,
        "X-Correlation-Id": obs.context.correlationId,
      },
    });
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      return obs.json({ error: error.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, error);
    return obs.json({ error: "Téléchargement média impossible." }, { status: 500 });
  }
}

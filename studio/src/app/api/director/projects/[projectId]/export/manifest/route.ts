import { NextRequest } from "next/server";
import type { ExportPackage } from "@/domain/postproduction";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger, startObservedRoute } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";
type RouteParams = { params: Promise<{ projectId: string }> };

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

/**
 * Safe redacted ExportPackage / manifest JSON — distinct from media download.
 * Never includes signed URLs, tokens, or storage secrets.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/export/manifest",
    operation: "director.export.manifest",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  try {
    const stack = createDirectorPersistenceStack();
    const active = await stack.artifacts.getActive(projectId, "export_package");
    if (!active) {
      return obs.json({ error: "Aucun paquet d'export actif." }, { status: 404 });
    }
    const loaded = await stack.artifacts.load(active.artifactId);
    if (!loaded) {
      return obs.json({ error: "Paquet d'export introuvable." }, { status: 404 });
    }
    const pkg = loaded.value as ExportPackage;
    const safe = {
      id: pkg.id,
      projectId: pkg.projectId,
      productionResultRevisionId: pkg.productionResultRevisionId,
      createdAt: pkg.createdAt,
      revision: active.revision,
      finalAsset: {
        id: pkg.finalAsset.id,
        kind: pkg.finalAsset.kind,
        mimeType: pkg.finalAsset.mimeType,
        durationSeconds: pkg.finalAsset.durationSeconds,
        sizeBytes: pkg.finalAsset.sizeBytes,
        checksum: pkg.finalAsset.checksum,
        sourceKind: pkg.finalAsset.source.kind,
      },
      qualityStatus: pkg.qualityReport.status,
      humanReviewStatus: pkg.humanReview?.status,
      manifest: pkg.manifest,
      note: "Manifeste redacted — le média final se télécharge via /export/download.",
    };
    const body = JSON.stringify(safe, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-manifest-${projectId.slice(0, 8)}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Correlation-Id": obs.context.correlationId,
      },
    });
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      return obs.json({ error: error.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, error);
    return obs.json({ error: "Lecture du manifeste impossible." }, { status: 500 });
  }
}

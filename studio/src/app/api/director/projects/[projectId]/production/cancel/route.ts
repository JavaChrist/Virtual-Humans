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

const BodySchema = z.object({
  runId: z.string().uuid(),
  expectedRunRevision: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  confirmation: z.literal(true),
});

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/production/cancel",
    operation: "director.production.cancel",
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
    const result = await createDirectorPersistenceStack().startProduction.cancel(
      {
        projectId,
        runId: body.data.runId,
        expectedRunRevision: body.data.expectedRunRevision,
        reason: body.data.reason,
        confirmation: true,
      },
      { correlationId, mode: "execute" },
    );
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
          message: "Échec de l'annulation.",
        },
      },
      { status: 500 },
    );
  }
}

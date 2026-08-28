/**
 * POST create / GET list Director projects (VHS-116).
 * Server-only. Requires DIRECTOR_V2_ENABLED + DIRECTOR_V2_PERSISTENCE_ENABLED.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { VideoProjectBriefFieldsSchema } from "@/domain/brief";
import {
  canUseDirectorV2Persistence,
} from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import {
  generateCorrelationId,
  logger,
  resolveCorrelationId,
  startObservedRoute,
} from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

const CreateBodySchema = z.object({
  projectId: z.string().uuid(),
  artifactId: z.string().uuid(),
  expectedBriefRevision: z.literal(1),
  fields: VideoProjectBriefFieldsSchema,
  correlationId: z.string().min(8).max(128).optional(),
});

export async function GET(req: NextRequest) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects",
    operation: "director.projects.list",
  });

  if (!canUseDirectorV2Persistence()) {
    logger.info("route.client_error", obs.context, { status: 404, reason: "persistence_off" });
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }

  try {
    const stack = createDirectorPersistenceStack();
    const result = await stack.listProjects.execute(20);
    if (result.status === "failed") {
      logger.info("director.project.listed", obs.context, { ok: false });
      return obs.json({ error: result.publicMessage }, { status: 503 });
    }
    logger.info("director.project.listed", obs.context, {
      count: result.items.length,
    });
    return obs.json({ items: result.items });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Liste des projets impossible." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects",
    operation: "director.project.create",
  });

  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }

  logger.info("director.project.create.started", obs.context, {});

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return obs.json({ error: "JSON invalide." }, { status: 400 });
  }

  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) {
    logger.info("director.project.create.failed", obs.context, {
      code: "invalid_body",
    });
    return obs.json({ error: "Requête invalide." }, { status: 400 });
  }

  const correlationId =
    parsed.data.correlationId ??
    resolveCorrelationId(req.headers.get("x-correlation-id")) ??
    generateCorrelationId();

  try {
    const stack = createDirectorPersistenceStack();
    const result = await stack.createProject.execute({
      projectId: parsed.data.projectId,
      artifactId: parsed.data.artifactId,
      workspaceId: stack.workspaceId,
      expectedBriefRevision: 1,
      correlationId,
      actor: { type: "shared_password", id: "shared-password-user" },
      draft: {
        draftVersion: "1.0.0",
        updatedAt: new Date().toISOString(),
        currentStep: 5,
        fields: parsed.data.fields,
      },
    });

    if (result.status === "failed") {
      logger.info("director.project.create.failed", obs.context, {
        code: result.code,
        projectId: parsed.data.projectId,
      });
      const status =
        result.code === "conflict" || result.code === "project_brief_conflict"
          ? 409
          : result.code === "director_project_quota_exceeded"
            ? 409
            : result.code === "not_found"
              ? 503
              : 400;
      return obs.json(
        { error: result.publicMessage, code: result.code },
        { status }
      );
    }

    logger.info("director.project.create.completed", obs.context, {
      projectId: result.projectId,
      status: result.status,
    });
    return obs.json({
      status: result.status,
      projectId: result.projectId,
      artifactId: result.artifactId,
      revision: result.revision,
      projectName: result.projectName,
    });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      logger.info("director.project.create.failed", obs.context, {
        code: "config",
      });
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    logger.info("director.project.create.failed", obs.context, {
      code: "unknown",
    });
    return obs.json({ error: "Création du projet impossible." }, { status: 500 });
  }
}

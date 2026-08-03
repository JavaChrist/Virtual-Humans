/**
 * GET/POST Brief revisions (VHS-126).
 * POST creates an immutable next brief revision + downstream stale cascade.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  AspectRatioValues,
  DurationValues,
  ObjectiveValues,
  PlatformValues,
  SubjectTypeValues,
  ToneValues,
  FIELD_LIMITS,
} from "@/domain/brief";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { logger, startObservedRoute } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

const BriefFieldsPatchSchema = z
  .object({
    projectName: z.string().min(1).max(FIELD_LIMITS.projectName).optional(),
    subjectType: z.enum(SubjectTypeValues).optional(),
    subjectName: z.string().min(1).max(FIELD_LIMITS.subjectName).optional(),
    subjectDescription: z.string().min(1).max(FIELD_LIMITS.subjectDescription).optional(),
    objective: z.enum(ObjectiveValues).optional(),
    platform: z.enum(PlatformValues).optional(),
    durationSeconds: z
      .union([
        z.literal(15),
        z.literal(20),
        z.literal(30),
        z.literal(60),
        z.number().refine((n): n is (typeof DurationValues)[number] =>
          (DurationValues as readonly number[]).includes(n),
        ),
      ])
      .optional(),
    aspectRatio: z.enum(AspectRatioValues).optional(),
    language: z
      .string()
      .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/)
      .optional(),
    tone: z.enum(ToneValues).optional(),
    characterId: z.string().uuid().optional(),
    callToAction: z.string().max(FIELD_LIMITS.callToAction).optional(),
    audienceDescription: z.string().max(FIELD_LIMITS.audienceDescription).optional(),
    brandConstraints: z.string().max(FIELD_LIMITS.brandConstraints).optional(),
  })
  .strict();

const BodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("dry-run"),
    fields: BriefFieldsPatchSchema,
  }),
  z.object({
    mode: z.literal("execute"),
    fields: BriefFieldsPatchSchema,
    expectedBriefRevision: z.number().int().positive(),
    expectedProjectRevision: z.number().int().positive(),
    confirmation: z.literal(true),
  }),
]);

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/brief/revisions",
    operation: "director.brief.revisions.get",
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
    const revisions = await stack.reviseBrief.listRevisions(projectId);
    const active = revisions.find((r) => r.isActive) ?? null;
    let activeFields: Record<string, unknown> | null = null;
    if (active) {
      const art = await stack.artifacts.load(active.artifactId);
      if (art) {
        const v = art.value as Record<string, unknown>;
        activeFields = {
          projectName: v.projectName,
          subjectType: v.subjectType,
          subjectName: v.subjectName,
          subjectDescription: v.subjectDescription,
          objective: v.objective,
          platform: v.platform,
          durationSeconds: v.durationSeconds,
          aspectRatio: v.aspectRatio,
          language: v.language,
          tone: v.tone,
          characterId: v.characterId,
          callToAction: v.callToAction,
          audienceDescription: v.audienceDescription,
          brandConstraints: v.brandConstraints,
          mediaReferences: Array.isArray(v.mediaReferences)
            ? (v.mediaReferences as Array<{ id: string; kind: string; label: string }>).map(
                (m) => ({ id: m.id, kind: m.kind, label: m.label }),
              )
            : [],
        };
      }
    }
    return obs.json({
      projectRevision: project.activeRevision,
      revisions,
      activeRevision: active?.revision ?? null,
      activeFields,
      restartPoint: "marketing_plan",
    });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Lecture des révisions impossible." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/brief/revisions",
    operation: "director.brief.revisions.post",
  });
  if (!canUseDirectorV2Persistence()) {
    return obs.json({ error: "Persistance Director désactivée." }, { status: 404 });
  }
  const { projectId } = await params;
  if (!isUuid(projectId)) {
    return obs.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return obs.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return obs.json(
      { error: "Payload invalide.", code: "validation_error" },
      { status: 422 },
    );
  }

  try {
    const stack = createDirectorPersistenceStack();
    const ctx = {
      correlationId: obs.context.correlationId,
      mode: parsed.data.mode === "dry-run" ? ("dry-run" as const) : ("execute" as const),
      createdBy: "shared-password-user",
    };

    if (parsed.data.mode === "dry-run") {
      const dry = await stack.reviseBrief.dryRun(
        { projectId, fields: parsed.data.fields },
        ctx,
      );
      logger.info("director.brief.revise.dry_run", obs.context, {
        projectId,
        executable: dry.executable,
        changes: dry.changes.length,
      });
      return obs.json({ dryRun: dry });
    }

    const result = await stack.reviseBrief.execute(
      {
        projectId,
        fields: parsed.data.fields,
        expectedBriefRevision: parsed.data.expectedBriefRevision,
        expectedProjectRevision: parsed.data.expectedProjectRevision,
        confirmation: true,
      },
      ctx,
    );

    if (result.status === "failed") {
      logger.info("director.brief.revise.failed", obs.context, {
        projectId,
        code: result.code,
      });
      return obs.json(
        { error: result.publicMessage, code: result.code },
        { status: result.httpHint },
      );
    }

    logger.info("director.brief.revise.completed", obs.context, {
      projectId,
      revision: result.brief.revision,
      staleCount: result.staleTypes.length,
    });
    return obs.json({
      status: result.status,
      brief: {
        id: result.brief.id,
        revision: result.brief.revision,
        projectName: result.brief.projectName,
        platform: result.brief.platform,
        durationSeconds: result.brief.durationSeconds,
        language: result.brief.language,
        subjectName: result.brief.subjectName,
        objective: result.brief.objective,
        tone: result.brief.tone,
        aspectRatio: result.brief.aspectRatio,
      },
      previousRevision: result.previousRevision,
      projectRevision: result.projectRevision,
      changes: result.changes,
      staleTypes: result.staleTypes,
      restartPoint: result.restartPoint,
    });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Révision du brief impossible." }, { status: 500 });
  }
}

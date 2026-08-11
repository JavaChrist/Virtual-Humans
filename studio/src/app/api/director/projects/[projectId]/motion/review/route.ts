/**
 * MT-010 — Motion Transfer human review API (GET context / POST decision).
 * Reuses Director auth gate (proxy). No provider / enqueue / merge / export.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import { createMotionReviewOrchestratorFromHarness } from "@/infrastructure/motion/motion-review-harness";
import {
  generateCorrelationId,
  logger,
  resolveCorrelationId,
  startObservedRoute,
} from "@/infrastructure/observability";

export const dynamic = "force-dynamic";
type RouteParams = { params: Promise<{ projectId: string }> };

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );

const DecisionSchema = z.object({
  confirmation: z.literal(true),
  decision: z.enum([
    "approved",
    "rejected",
    "retry_same_reference",
    "retry_updated_constraints",
    "request_new_reference",
  ]),
  expectedRevision: z.number().int().positive(),
  reviewRequestId: z.string().min(8).max(120),
  comment: z.string().max(2000).optional(),
  updatedConstraintsRef: z.string().min(1).max(160).optional(),
  humanAttestation: z.boolean().optional(),
  runId: z.string().min(1).max(120).optional(),
});

async function resolveWorkspaceScope(projectId: string): Promise<{
  ok: true;
  workspaceId: string;
} | { ok: false; status: number; error: string }> {
  if (!canUseDirectorV2Persistence()) {
    // Allow harness-only motion review when persistence flag off but harness on
    if (
      process.env.MOTION_TRANSFER_FAKE_HARNESS === "1" ||
      process.env.NODE_ENV === "test"
    ) {
      return { ok: true, workspaceId: "ws-motion-harness" };
    }
    return { ok: false, status: 404, error: "Persistance Director désactivée." };
  }
  try {
    const stack = createDirectorPersistenceStack();
    const project = await stack.projects.load(projectId);
    if (!project) {
      return { ok: false, status: 404, error: "Projet introuvable." };
    }
    return { ok: true, workspaceId: project.workspaceId };
  } catch (error) {
    if (error instanceof V2SupabaseConfigError) {
      if (
        process.env.MOTION_TRANSFER_FAKE_HARNESS === "1" ||
        process.env.NODE_ENV === "test"
      ) {
        return { ok: true, workspaceId: "ws-motion-harness" };
      }
      return { ok: false, status: 503, error: error.message };
    }
    throw error;
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/motion/review",
    operation: "director.motion.review.get",
  });
  const { projectId } = await params;
  if (!isUuid(projectId) && process.env.NODE_ENV !== "test") {
    // tests may use non-uuid project ids in harness
    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(projectId)) {
      return obs.json({ error: "Identifiant invalide." }, { status: 400 });
    }
  }
  const scope = await resolveWorkspaceScope(projectId);
  if (!scope.ok) {
    return obs.json({ error: scope.error }, { status: scope.status });
  }

  const runId = req.nextUrl.searchParams.get("runId") ?? undefined;
  const correlationId =
    resolveCorrelationId(req.headers.get("x-correlation-id")) ??
    generateCorrelationId();

  try {
    const orch = createMotionReviewOrchestratorFromHarness();
    const result = await orch.getContext({
      projectId,
      workspaceId: scope.workspaceId,
      runId,
      correlationId,
    });
    if (result.status !== "ok") {
      return obs.json(
        { status: "failed", error: { code: result.code, message: result.publicMessage } },
        { status: result.httpHint },
      );
    }
    return obs.json({ status: "ok", context: result.context });
  } catch (error) {
    logger.error("route.failure", obs.context, error);
    return obs.json(
      {
        status: "failed",
        error: { code: "internal_error", message: "Lecture revue Motion impossible." },
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/motion/review",
    operation: "director.motion.review.post",
  });
  const { projectId } = await params;
  if (!isUuid(projectId) && process.env.NODE_ENV !== "test") {
    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(projectId)) {
      return obs.json({ error: "Identifiant invalide." }, { status: 400 });
    }
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return obs.json({ error: "JSON invalide." }, { status: 400 });
  }
  const body = DecisionSchema.safeParse(raw);
  if (!body.success) {
    return obs.json({ error: "Requête invalide." }, { status: 400 });
  }

  const scope = await resolveWorkspaceScope(projectId);
  if (!scope.ok) {
    return obs.json({ error: scope.error }, { status: scope.status });
  }

  const correlationId =
    resolveCorrelationId(req.headers.get("x-correlation-id")) ??
    generateCorrelationId();

  try {
    const orch = createMotionReviewOrchestratorFromHarness();
    const result = await orch.recordDecision({
      projectId,
      workspaceId: scope.workspaceId,
      runId: body.data.runId,
      decision: body.data.decision,
      expectedRevision: body.data.expectedRevision,
      reviewRequestId: body.data.reviewRequestId,
      comment: body.data.comment,
      updatedConstraintsRef: body.data.updatedConstraintsRef,
      humanAttestation: body.data.humanAttestation,
      confirmation: true,
      actorId: "shared-password-user",
      correlationId,
      nowIso: new Date().toISOString(),
    });

    if (result.status === "failed") {
      return obs.json(
        {
          status: "failed",
          error: { code: result.code, message: result.publicMessage },
        },
        { status: result.httpHint },
      );
    }
    if (result.status === "conflict") {
      return obs.json(
        {
          status: "conflict",
          error: { code: result.code, message: result.publicMessage },
        },
        { status: 409 },
      );
    }
    return obs.json({
      status: result.status,
      decisionId: result.decisionId,
      revision: result.revision,
      decision: result.decision,
      nextAllowedState: result.nextAllowedState,
      sideEffects: result.sideEffects,
    });
  } catch (error) {
    logger.error("route.failure", obs.context, error);
    return obs.json(
      {
        status: "failed",
        error: { code: "internal_error", message: "Enregistrement revue Motion impossible." },
      },
      { status: 500 },
    );
  }
}

/**
 * GET/POST Marketing analysis for a Director project (VHS-117B / VHS-117D).
 * No OpenAI call unless execute mode + flags + service path (tests use fakes).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
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
import { mapMarketingFailureToHttp } from "@/application/directors/marketing/http-map";
import {
  MARKETING_ANALYSIS_FAILURE_CODES,
  MARKETING_FAILURE_PUBLIC_MESSAGES,
  type MarketingAnalysisFailure,
  type MarketingAnalysisFailureCode,
} from "@/application/directors/marketing/failures";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

const BodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("dry-run") }),
  z.object({
    mode: z.literal("execute"),
    expectedBriefRevision: z.number().int().positive(),
  }),
]);

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function isCanonicalFailureCode(
  code: string
): code is MarketingAnalysisFailureCode {
  return (MARKETING_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code);
}

function failureFromServiceResult(result: {
  code: MarketingAnalysisFailureCode;
  publicMessage: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  provider?: "openai";
}): MarketingAnalysisFailure {
  return {
    code: result.code,
    retryable: result.retryable,
    publicMessage: result.publicMessage,
    provider: result.provider,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/marketing",
    operation: "director.marketing.get",
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
    const dry = await stack.analyzeMarketing.dryRun(
      { projectId },
      {
        correlationId: obs.context.correlationId,
        mode: "dry-run",
      }
    );
    logger.info("director.marketing.dry_run.completed", obs.context, {
      projectId,
      executable: dry.executable,
      executionAvailable: dry.executionAvailable,
    });
    return obs.json({ dryRun: dry, plan: dry.existingPlan ?? null });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Lecture marketing impossible." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/marketing",
    operation: "director.marketing.post",
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
    return obs.json({ error: "JSON invalide." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return obs.json({ error: "Requête invalide." }, { status: 400 });
  }

  const correlationId =
    resolveCorrelationId(req.headers.get("x-correlation-id")) ??
    generateCorrelationId();

  try {
    const stack = createDirectorPersistenceStack();

    if (parsed.data.mode === "dry-run") {
      logger.info("director.marketing.dry_run.started", obs.context, { projectId });
      const dry = await stack.analyzeMarketing.dryRun(
        { projectId },
        { correlationId, mode: "dry-run" }
      );
      logger.info("director.marketing.dry_run.completed", obs.context, {
        projectId,
        executable: dry.executable,
        executionAvailable: dry.executionAvailable,
      });
      return obs.json({ dryRun: dry });
    }

    // execute — gated inside service by flags; UI keeps button off when unavailable
    logger.info("director.marketing.run.started", obs.context, { projectId });
    const result = await stack.analyzeMarketing.execute(
      {
        projectId,
        expectedBriefRevision: parsed.data.expectedBriefRevision,
      },
      { correlationId, mode: "execute" }
    );

    if (result.status === "already_running") {
      return obs.json(
        {
          status: result.status,
          directorRunId: result.directorRunId,
          error: {
            code: "run_in_progress",
            retryable: false,
            message: result.publicMessage,
          },
        },
        { status: 202 }
      );
    }
    if (result.status === "needs_input") {
      logger.info("director.marketing.run.needs_input", obs.context, { projectId });
      return obs.json(result, { status: 422 });
    }
    if (result.status === "failed") {
      if (isCanonicalFailureCode(result.code)) {
        const mapped = mapMarketingFailureToHttp(
          failureFromServiceResult({
            code: result.code,
            publicMessage: result.publicMessage,
            retryable: result.retryable,
            retryAfterSeconds: result.retryAfterSeconds,
            provider: result.provider,
          })
        );
        logger.info("director.marketing.run.failed", obs.context, {
          projectId,
          directorRunId: result.directorRunId,
          failureCode: mapped.body.error.code,
          retryable: mapped.body.error.retryable,
          provider: result.provider,
          httpStatus: mapped.status,
          reservationReleased: true,
        });
        return obs.json(mapped.body, {
          status: mapped.status,
          headers: mapped.headers,
        });
      }
      // Service-local codes (flags/config) — preserve httpHint, redacted body
      logger.info("director.marketing.run.failed", obs.context, {
        projectId,
        directorRunId: result.directorRunId,
        failureCode: result.code,
        retryable: result.retryable,
        httpStatus: result.httpHint,
        reservationReleased: true,
      });
      return obs.json(
        {
          status: "failed",
          error: {
            code: result.code,
            retryable: result.retryable,
            message: result.publicMessage,
          },
        },
        { status: result.httpHint }
      );
    }

    logger.info("director.marketing.run.completed", obs.context, {
      projectId,
      status: result.status,
    });
    return obs.json(result);
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json(
      {
        status: "failed",
        error: {
          code: "internal_error",
          retryable: false,
          message: MARKETING_FAILURE_PUBLIC_MESSAGES.internal_error,
        },
      },
      { status: 500 }
    );
  }
}

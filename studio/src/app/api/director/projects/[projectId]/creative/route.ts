/**
 * GET/POST Creative analysis for a Director project (VHS-117B / VHS-117D / 8G-B).
 * No OpenAI call unless execute mode + flags + service path (tests use fakes).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  canUseDirectorV2Persistence,
} from "@/infrastructure/config/feature-flags";
import { isDirectorE2eFakeMode } from "@/infrastructure/config/e2e-fake-mode";
import {
  E2E_FAKE_FAIL_HEADER,
  parseE2eFakeFailHeader,
  runWithE2eRequestContext,
} from "@/infrastructure/e2e/e2e-request-context";
import { createDirectorPersistenceStack } from "@/infrastructure/db/director-server";
import { V2SupabaseConfigError } from "@/infrastructure/db/supabase-server";
import {
  generateCorrelationId,
  logger,
  resolveCorrelationId,
  startObservedRoute,
} from "@/infrastructure/observability";
import { mapMarketingFailureToHttp as mapCreativeFailureToHttp } from "@/application/directors/marketing/http-map";
import {
  MARKETING_ANALYSIS_FAILURE_CODES,
  type MarketingAnalysisFailure as CreativeAnalysisFailure,
  type MarketingAnalysisFailureCode as CreativeAnalysisFailureCode,
} from "@/application/directors/marketing/failures";
import { CREATIVE_FAILURE_PUBLIC_MESSAGES } from "@/application/directors/creative/failures";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

const BodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("dry-run") }),
  z.object({
    mode: z.literal("execute"),
    expectedMarketingPlanRevision: z.number().int().positive(),
  }),
]);

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

function isCanonicalFailureCode(
  code: string
): code is CreativeAnalysisFailureCode {
  return (MARKETING_ANALYSIS_FAILURE_CODES as readonly string[]).includes(code);
}

function failureFromServiceResult(result: {
  code: CreativeAnalysisFailureCode;
  publicMessage: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  provider?: "openai";
}): CreativeAnalysisFailure {
  return {
    code: result.code,
    retryable: result.retryable,
    publicMessage: result.publicMessage,
    provider: result.provider,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

/** E2E harness only — never enables provider network. */
function e2eContextFromRequest(req: NextRequest) {
  const env = process.env as Record<string, string | undefined>;
  if (env.DIRECTOR_V2_E2E_HARNESS !== "1" || !isDirectorE2eFakeMode(env)) {
    return {};
  }
  return parseE2eFakeFailHeader(req.headers.get(E2E_FAKE_FAIL_HEADER));
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/creative",
    operation: "director.creative.get",
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
    const dry = await stack.analyzeCreative.dryRun(
      { projectId },
      {
        correlationId: obs.context.correlationId,
        mode: "dry-run",
      }
    );
    logger.info("director.creative.dry_run.completed", obs.context, {
      projectId,
      executable: dry.executable,
      executionAvailable: dry.executionAvailable,
    });
    return obs.json({ dryRun: dry, concept: dry.existingConcept ?? null });
  } catch (e) {
    if (e instanceof V2SupabaseConfigError) {
      return obs.json({ error: e.message }, { status: 503 });
    }
    logger.error("route.failure", obs.context, e);
    return obs.json({ error: "Lecture creative impossible." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/creative",
    operation: "director.creative.post",
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

  const e2eCtx = e2eContextFromRequest(req);

  return runWithE2eRequestContext(e2eCtx, async () => {
    try {
      const stack = createDirectorPersistenceStack();

      if (parsed.data.mode === "dry-run") {
        logger.info("director.creative.dry_run.started", obs.context, { projectId });
        const dry = await stack.analyzeCreative.dryRun(
          { projectId },
          { correlationId, mode: "dry-run" }
        );
        logger.info("director.creative.dry_run.completed", obs.context, {
          projectId,
          executable: dry.executable,
          executionAvailable: dry.executionAvailable,
          promptVersion: dry.promptVersion,
        });
        return obs.json({ dryRun: dry });
      }

      // execute — gated inside service by flags; UI keeps button off when unavailable
      logger.info("director.creative.run.started", obs.context, { projectId });
      const result = await stack.analyzeCreative.execute(
        {
          projectId,
          expectedMarketingPlanRevision:
            parsed.data.expectedMarketingPlanRevision,
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
        logger.info("director.creative.run.needs_input", obs.context, {
          projectId,
        });
        return obs.json(result, { status: 422 });
      }
      if (result.status === "failed") {
        if (isCanonicalFailureCode(result.code)) {
          const mapped = mapCreativeFailureToHttp(
            failureFromServiceResult({
              code: result.code,
              publicMessage: result.publicMessage,
              // Creative: auto-retryable always false (8G-A).
              retryable: false,
              retryAfterSeconds: result.retryAfterSeconds,
              provider: result.provider,
            })
          );
          logger.info("director.creative.run.failed", obs.context, {
            projectId,
            directorRunId: result.directorRunId,
            failureCode: mapped.body.error.code,
            retryable: false,
            provider: result.provider,
            httpStatus: mapped.status,
            reservationReleased: true,
            e2eFakeFail: e2eCtx.creativeFail,
          });
          return obs.json(mapped.body, {
            status: mapped.status,
            headers: mapped.headers,
          });
        }
        // Service-local codes (flags/config) — preserve httpHint, redacted body
        logger.info("director.creative.run.failed", obs.context, {
          projectId,
          directorRunId: result.directorRunId,
          failureCode: result.code,
          retryable: false,
          httpStatus: result.httpHint,
          reservationReleased: true,
        });
        return obs.json(
          {
            status: "failed",
            error: {
              code: result.code,
              retryable: false,
              message: result.publicMessage,
            },
          },
          { status: result.httpHint }
        );
      }

      logger.info("director.creative.run.completed", obs.context, {
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
            message: CREATIVE_FAILURE_PUBLIC_MESSAGES.internal_error,
          },
        },
        { status: 500 }
      );
    }
  });
}

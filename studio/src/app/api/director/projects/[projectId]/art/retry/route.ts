/**
 * POST — Explicit human Art retry (Porte 8P / VHS-128 pattern).
 * Never accepts model / attempt number / idempotency key from the client.
 */

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
import { mapMarketingFailureToHttp } from "@/application/directors/marketing/http-map";
import {
  MARKETING_ANALYSIS_FAILURE_CODES,
  type MarketingAnalysisFailure,
  type MarketingAnalysisFailureCode,
} from "@/application/directors/marketing/failures";
import { ART_FAILURE_PUBLIC_MESSAGES } from "@/application/directors/art/failures";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ projectId: string }> };

const BodySchema = z.object({
  previousRunId: z.string().uuid(),
  retryRequestId: z.string().uuid(),
  expectedVideoScriptRevision: z.number().int().positive(),
  expectedCreativeConceptRevision: z.number().int().positive().optional(),
  expectedMarketingPlanRevision: z.number().int().positive().optional(),
});

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

export async function POST(req: NextRequest, { params }: RouteParams) {
  const obs = startObservedRoute(req, {
    route: "/api/director/projects/[projectId]/art/retry",
    operation: "director.art.retry",
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
    logger.info("director.art.retry.started", obs.context, {
      projectId,
      previousRunId: parsed.data.previousRunId,
    });

    const result = await stack.analyzeArt.executeRetry(
      {
        projectId,
        previousRunId: parsed.data.previousRunId,
        retryRequestId: parsed.data.retryRequestId,
        expectedVideoScriptRevision: parsed.data.expectedVideoScriptRevision,
        expectedCreativeConceptRevision: parsed.data.expectedCreativeConceptRevision,
        expectedMarketingPlanRevision: parsed.data.expectedMarketingPlanRevision,
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
        logger.info("director.art.retry.failed", obs.context, {
          projectId,
          directorRunId: result.directorRunId,
          failureCode: mapped.body.error.code,
          retryable: mapped.body.error.retryable,
          httpStatus: mapped.status,
        });
        return obs.json(mapped.body, {
          status: mapped.status,
          headers: mapped.headers,
        });
      }
      logger.info("director.art.retry.failed", obs.context, {
        projectId,
        directorRunId: result.directorRunId,
        failureCode: result.code,
        httpStatus: result.httpHint,
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

    logger.info("director.art.retry.completed", obs.context, {
      projectId,
      status: result.status,
      directorRunId: result.directorRunId,
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
          message: ART_FAILURE_PUBLIC_MESSAGES.internal_error,
        },
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  CORRELATION_HEADER,
  createLogContext,
  resolveCorrelationId,
  type LogContext,
} from "./correlation";
import { logger } from "./logger";

export type ObservedRoute = {
  /** Structured log context for this request. */
  context: LogContext;
  /** Attach correlation header on a NextResponse. */
  withCorrelation: <T extends NextResponse>(res: T) => T;
  /** JSON response that always includes x-correlation-id. */
  json: (body: unknown, init?: { status?: number; headers?: HeadersInit }) => NextResponse;
};

export type StartObservedRouteOptions = {
  route: string;
  operation?: string;
  projectId?: string;
  sceneId?: string;
  stepId?: string;
  /** When true (default), emit `route.start` info log. */
  logStart?: boolean;
};

/**
 * Small helper for App Router handlers (Next.js 16 Route Handlers).
 * Resolves correlation id from the request, builds LogContext, and
 * returns response helpers that propagate the header.
 */
export function startObservedRoute(
  req: NextRequest,
  options: StartObservedRouteOptions,
): ObservedRoute {
  const incoming = req.headers.get(CORRELATION_HEADER);
  const correlationId = resolveCorrelationId(incoming);
  const context = createLogContext(correlationId, {
    route: options.route,
    operation: options.operation ?? options.route,
    projectId: options.projectId,
    sceneId: options.sceneId,
    stepId: options.stepId,
  });

  if (options.logStart !== false) {
    logger.info("route.start", context, {
      method: req.method,
      path: options.route,
    });
  }

  const withCorrelation = <T extends NextResponse>(res: T): T => {
    res.headers.set(CORRELATION_HEADER, context.correlationId);
    return res;
  };

  const json = (body: unknown, init?: { status?: number; headers?: HeadersInit }) => {
    const res = NextResponse.json(body, {
      status: init?.status ?? 200,
      headers: init?.headers,
    });
    return withCorrelation(res);
  };

  return { context, withCorrelation, json };
}

/** Extract optional domain ids from a parsed JSON body without logging it. */
export function idsFromBody(body: unknown): Pick<LogContext, "projectId" | "sceneId" | "stepId"> {
  if (!body || typeof body !== "object") return {};
  const o = body as Record<string, unknown>;
  const out: Pick<LogContext, "projectId" | "sceneId" | "stepId"> = {};
  if (typeof o.projectId === "string" && o.projectId.trim()) out.projectId = o.projectId.trim();
  if (typeof o.sceneId === "string" && o.sceneId.trim()) out.sceneId = o.sceneId.trim();
  if (typeof o.stepId === "string" && o.stepId.trim()) out.stepId = o.stepId.trim();
  return out;
}

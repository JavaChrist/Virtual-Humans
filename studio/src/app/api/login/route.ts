/**
 * POST /api/login — shared password gate (VHS-002 / Phase 7).
 * Fail-closed. Generic errors. No password/session in response body.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  authCookieOptions,
  createSessionToken,
  resolveAuthConfig,
  verifyLoginPassword,
} from "@/lib/auth";
import { applyNoStoreHeaders, applySecurityHeaders } from "@/lib/security-headers";
import { checkRateLimit, rateLimitClientKey, RATE_LIMITS } from "@/lib/rate-limit";
import { logger, startObservedRoute } from "@/infrastructure/observability";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;

function json(
  body: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  const res = NextResponse.json(body, { status });
  applySecurityHeaders(res.headers);
  applyNoStoreHeaders(res.headers);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.headers.set(k, v);
  }
  return res;
}

export async function POST(req: NextRequest) {
  const obs = startObservedRoute(req, {
    route: "/api/login",
    operation: "auth.login",
  });

  const ip =
    req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const rl = checkRateLimit(`login:${rateLimitClientKey(ip)}`, RATE_LIMITS.login);
  if (!rl.ok) {
    logger.info("auth.login.rate_limited", obs.context, {});
    return json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      429,
      { "Retry-After": String(rl.retryAfterSeconds) },
    );
  }

  const config = resolveAuthConfig();
  if (!config.ok) {
    // Generic — do not reveal which secret is missing
    logger.info("auth.login.config_invalid", obs.context, { reason: config.reason });
    return json({ error: "Connexion impossible." }, 503);
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Connexion refusée." }, 400);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "Connexion refusée." }, 413);
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: "Connexion refusée." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Connexion refusée." }, 400);
  }

  const password = (body as { password?: unknown }).password;
  if (typeof password !== "string") {
    return json({ error: "Connexion refusée." }, 401);
  }

  const match = await verifyLoginPassword(password, config);
  if (!match) {
    logger.info("auth.login.failed", obs.context, {});
    return json({ error: "Connexion refusée." }, 401);
  }

  const session = await createSessionToken(config);
  if (!session.ok) {
    return json({ error: "Connexion impossible." }, 503);
  }

  const res = json({ ok: true }, 200);
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(AUTH_COOKIE, session.token, authCookieOptions(session.maxAge, isProd));
  logger.info("auth.login.ok", obs.context, {});
  return res;
}

/** Logout moved to POST /api/logout — reject legacy DELETE. */
export async function DELETE() {
  return json({ error: "Utilisez POST /api/logout." }, 405);
}

export async function GET() {
  return json({ error: "Méthode non autorisée." }, 405);
}

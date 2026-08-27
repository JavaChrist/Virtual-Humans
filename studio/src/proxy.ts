import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE,
  resolveAuthConfig,
  verifySessionToken,
} from "@/lib/auth";
import { assertCsrf, isMutatingMethod } from "@/lib/csrf";
import { safeInternalPath } from "@/lib/safe-redirect";
import {
  checkRateLimit,
  rateLimitClientKey,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { applyNoStoreHeaders, applySecurityHeaders, NO_STORE } from "@/lib/security-headers";
import {
  DIRECTOR_WORKER_RUN_ONCE_PATH,
  isDirectorWorkerRunOncePost,
} from "@/lib/internal-routes";

/**
 * Proxy (Next.js 16 — ex-middleware).
 * Fail-closed shared-password gate (VHS-002 / Phase 7).
 *
 * Public (minimal):
 * - /login
 * - POST /api/login
 * - /offline (shell only)
 * - static allowlist in matcher
 * - POST /api/internal/director-worker/run-once ONLY (worker secret — cookie never grants access)
 * - GET /api/version (public build metadata only)
 *
 * No wildcard /api/internal/** exemption.
 */

function withSecurity(res: NextResponse, { noStore = false } = {}): NextResponse {
  applySecurityHeaders(res.headers);
  if (noStore) applyNoStoreHeaders(res.headers);
  return res;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function isPublicPath(pathname: string, method: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/offline") return true;
  if (pathname === "/api/login" && method === "POST") return true;
  if (pathname === "/api/version" && method === "GET") return true;
  // Exact worker route only — never /api/internal/**
  if (isDirectorWorkerRunOncePost(pathname, method)) return true;
  return false;
}

export function rateLimitPolicyFor(
  pathname: string,
  method: string,
): { keyPrefix: string; policy: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS] } | null {
  if (pathname === "/api/login") return { keyPrefix: "login", policy: RATE_LIMITS.login };
  if (pathname === "/api/version" && method === "GET") {
    return { keyPrefix: "version", policy: RATE_LIMITS.version };
  }
  if (isDirectorWorkerRunOncePost(pathname, method)) {
    return { keyPrefix: "worker", policy: RATE_LIMITS.worker };
  }
  if (pathname.startsWith("/api/generate")) {
    return { keyPrefix: "generate", policy: RATE_LIMITS.generate };
  }
  if (pathname.startsWith("/api/director")) {
    return { keyPrefix: "director", policy: RATE_LIMITS.director };
  }
  if (pathname.startsWith("/api/aiccos")) {
    return { keyPrefix: "aiccos", policy: RATE_LIMITS.aiccos };
  }
  return null;
}

export function shouldApplyRateLimit(pathname: string, method: string): boolean {
  if (!rateLimitPolicyFor(pathname, method)) return false;
  if (pathname === "/api/version" && method === "GET") return true;
  return isMutatingMethod(method);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();
  const config = resolveAuthConfig();

  // --- Rate limiting (best-effort, in-memory) ---
  const rl = rateLimitPolicyFor(pathname, method);
  if (rl && shouldApplyRateLimit(pathname, method)) {
    const key = `${rl.keyPrefix}:${rateLimitClientKey(clientIp(req))}`;
    const hit = checkRateLimit(key, rl.policy);
    if (!hit.ok) {
      const res = NextResponse.json(
        { error: "Trop de requêtes. Réessayez plus tard." },
        { status: 429 },
      );
      res.headers.set("Retry-After", String(hit.retryAfterSeconds));
      res.headers.set("Cache-Control", NO_STORE);
      return withSecurity(res, { noStore: true });
    }
  }

  // --- Public paths ---
  if (isPublicPath(pathname, method)) {
    if (pathname === "/api/login" && method === "POST") {
      const csrf = assertCsrf(
        {
          origin: req.headers.get("origin"),
          referer: req.headers.get("referer"),
          host: req.headers.get("host"),
          "x-forwarded-host": req.headers.get("x-forwarded-host"),
        },
        { requireOrigin: false },
      );
      if (!csrf.ok && csrf.reason === "origin_mismatch") {
        return withSecurity(
          NextResponse.json({ error: "Requête refusée." }, { status: 403 }),
          { noStore: true },
        );
      }
    }
    return withSecurity(NextResponse.next());
  }

  // Worker GET (or wrong method) is not cookie-exempt — refuse as API
  if (pathname === DIRECTOR_WORKER_RUN_ONCE_PATH && method !== "POST") {
    return withSecurity(
      NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 }),
      { noStore: true },
    );
  }

  if (pathname === "/api/logout" && method === "GET") {
    return withSecurity(
      NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 }),
      { noStore: true },
    );
  }

  const isApi = pathname.startsWith("/api/");

  // --- Fail-closed: config invalid ---
  if (!config.ok) {
    if (isApi) {
      return withSecurity(
        NextResponse.json(
          { error: "Service temporairement indisponible." },
          { status: 503 },
        ),
        { noStore: true },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", safeInternalPath(pathname + req.nextUrl.search));
    url.searchParams.set("e", "config");
    return withSecurity(NextResponse.redirect(url), { noStore: true });
  }

  // --- CSRF for cookie mutations (worker POST already returned above) ---
  if (isMutatingMethod(method) && isApi) {
    const csrf = assertCsrf(
      {
        origin: req.headers.get("origin"),
        referer: req.headers.get("referer"),
        host: req.headers.get("host"),
        "x-forwarded-host": req.headers.get("x-forwarded-host"),
      },
      { requireOrigin: true },
    );
    if (!csrf.ok) {
      return withSecurity(
        NextResponse.json({ error: "Requête refusée." }, { status: 403 }),
        { noStore: true },
      );
    }
  }

  // --- Session ---
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = await verifySessionToken(token, config);
  if (session.ok) {
    return withSecurity(NextResponse.next());
  }

  if (isApi) {
    return withSecurity(
      NextResponse.json(
        { error: "Accès protégé — connexion requise." },
        { status: 401 },
      ),
      { noStore: true },
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", safeInternalPath(pathname + req.nextUrl.search));
  return withSecurity(NextResponse.redirect(url), { noStore: true });
}

export const config = {
  matcher: [
    "/((?!_next/|icons/|screenshots/|manifest.webmanifest|sw.js|icon.svg|favicon.ico|apple-touch-icon.png).*)",
  ],
};

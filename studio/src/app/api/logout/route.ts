/**
 * POST /api/logout — clear session cookie (VHS-002 / Phase 7).
 * Idempotent. CSRF enforced by proxy for cookie mutations.
 */

import { NextResponse } from "next/server";
import { AUTH_COOKIE, authCookieOptions } from "@/lib/auth";
import { applyNoStoreHeaders, applySecurityHeaders } from "@/lib/security-headers";

export const dynamic = "force-dynamic";

function cleared(): NextResponse {
  const res = NextResponse.json({ ok: true });
  applySecurityHeaders(res.headers);
  applyNoStoreHeaders(res.headers);
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set(AUTH_COOKIE, "", authCookieOptions(0, isProd));
  return res;
}

export async function POST() {
  return cleared();
}

export async function GET() {
  const res = NextResponse.json({ error: "Méthode non autorisée." }, { status: 405 });
  applySecurityHeaders(res.headers);
  applyNoStoreHeaders(res.headers);
  res.headers.set("Allow", "POST");
  return res;
}

/**
 * Shared-password session auth (VHS-002 / Phase 7) — fail-closed.
 *
 * Session cookie is an HMAC-signed, time-bounded token — NOT a permanent
 * hash of APP_PASSWORD (that allowed indefinite replay).
 *
 * Edge + Node safe (Web Crypto only).
 */

import {
  resolveAuthConfig,
  SESSION_TTL_SECONDS,
  type AuthConfig,
} from "@/lib/auth-config";
import {
  hmacSha256Hex,
  passwordsEqual,
  sha256Hex,
  timingSafeEqualString,
} from "@/lib/secure-compare";

export const AUTH_COOKIE = "vh_auth";
export { resolveAuthConfig, SESSION_TTL_SECONDS, authEnabled } from "@/lib/auth-config";

const SESSION_VERSION = "vh1";

export type SessionCreateResult =
  | { ok: true; token: string; maxAge: number; expiresAt: number }
  | { ok: false; reason: "config_invalid" };

export type SessionVerifyResult =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: "config_invalid" | "missing" | "malformed" | "bad_signature" | "expired" };

function b64urlEncode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const bin = atob(padded + pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function passwordBinding(password: string): Promise<string> {
  // Bind session to current password without storing it — rotation invalidates.
  return sha256Hex(`vh-pw-bind::${password}`);
}

async function signPayload(
  sessionSecret: string,
  password: string,
  payloadB64: string,
): Promise<string> {
  const bind = await passwordBinding(password);
  return hmacSha256Hex(sessionSecret, `${SESSION_VERSION}.${payloadB64}.${bind}`);
}

export async function createSessionToken(
  config: AuthConfig,
  opts: { nowMs?: number; ttlSeconds?: number } = {},
): Promise<SessionCreateResult> {
  if (!config.ok) return { ok: false, reason: "config_invalid" };
  const nowMs = opts.nowMs ?? Date.now();
  const ttl = opts.ttlSeconds ?? SESSION_TTL_SECONDS;
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ttl;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const payloadB64 = b64urlEncode(JSON.stringify({ v: 1, iat, exp, n: nonce }));
  const sig = await signPayload(config.sessionSecret, config.password, payloadB64);
  return {
    ok: true,
    token: `${SESSION_VERSION}.${payloadB64}.${sig}`,
    maxAge: ttl,
    expiresAt: exp,
  };
}

export async function verifySessionToken(
  token: string | null | undefined,
  config: AuthConfig,
  opts: { nowMs?: number } = {},
): Promise<SessionVerifyResult> {
  if (!config.ok) return { ok: false, reason: "config_invalid" };
  if (token == null || token === "") return { ok: false, reason: "missing" };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [ver, payloadB64, sig] = parts;
  if (ver !== SESSION_VERSION || !payloadB64 || !sig) {
    return { ok: false, reason: "malformed" };
  }
  if (sig.length !== 64 || !/^[0-9a-f]+$/i.test(sig)) {
    return { ok: false, reason: "malformed" };
  }

  const expectedSig = await signPayload(config.sessionSecret, config.password, payloadB64);
  if (!timingSafeEqualString(sig.toLowerCase(), expectedSig.toLowerCase())) {
    return { ok: false, reason: "bad_signature" };
  }

  const json = b64urlDecode(payloadB64);
  if (!json) return { ok: false, reason: "malformed" };
  let parsed: { exp?: unknown; iat?: unknown; v?: unknown };
  try {
    parsed = JSON.parse(json) as { exp?: unknown; iat?: unknown; v?: unknown };
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (parsed.v !== 1 || typeof parsed.exp !== "number" || typeof parsed.iat !== "number") {
    return { ok: false, reason: "malformed" };
  }
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (parsed.exp <= nowSec || parsed.iat > nowSec + 60) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, expiresAt: parsed.exp };
}

/** Cookie options for set/clear — keep attributes identical on logout. */
export function authCookieOptions(maxAge: number, isProd: boolean) {
  // Local Playwright harness runs `next start` (NODE_ENV=production) over http://127.0.0.1
  // — Secure cookies would be dropped by the browser. Never enable this on Vercel.
  const e2eHarnessHttp =
    process.env.DIRECTOR_V2_E2E_HARNESS === "1" &&
    process.env.VERCEL !== "1";
  return {
    httpOnly: true as const,
    secure: isProd && !e2eHarnessHttp,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function verifyLoginPassword(
  candidate: string,
  config: AuthConfig,
): Promise<boolean> {
  if (!config.ok) {
    // Dummy compare to reduce timing oracle when misconfigured
    await passwordsEqual(candidate || "x", "y".repeat(16));
    return false;
  }
  if (!candidate || candidate.length > 256) {
    await passwordsEqual("x", config.password);
    return false;
  }
  return passwordsEqual(candidate, config.password);
}

/**
 * Legacy helpers — kept so older imports compile during transition.
 * @deprecated Prefer resolveAuthConfig + createSessionToken / verifySessionToken.
 */
export async function sessionToken(password: string): Promise<string> {
  const config = resolveAuthConfig({
    APP_PASSWORD: password,
    APP_SESSION_SECRET: process.env.APP_SESSION_SECRET,
  });
  // If only password passed (legacy), cannot create signed session without secret.
  if (!config.ok) {
    const hex = await sha256Hex(`vh-studio::${password}`);
    return hex;
  }
  const created = await createSessionToken(config);
  return created.ok ? created.token : "";
}

/** @deprecated */
export async function expectedToken(): Promise<string | null> {
  const config = resolveAuthConfig();
  if (!config.ok) return null;
  // No stable "expected" token anymore — sessions are unique.
  return null;
}

/**
 * Fail-closed auth configuration (VHS-002 / Phase 7).
 * Edge + Node safe — no Node-only imports.
 */

export const APP_PASSWORD_MIN_LEN = 12;
export const APP_PASSWORD_MAX_LEN = 256;
export const APP_SESSION_SECRET_MIN_LEN = 32;
export const APP_SESSION_SECRET_MAX_LEN = 512;

/** Session TTL — not infinite; password/secret rotation invalidates sooner. */
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

const PLACEHOLDER_PASSWORDS = new Set(
  [
    "password",
    "changeme",
    "change-me",
    "secret",
    "admin",
    "test",
    "testing",
    "app_password",
    "app-password",
    "your-password",
    "your_password",
    "motdepasse",
    "mot-de-passe",
    "un-mot-de-passe-solide",
    "xxxxxxxxxxxx",
    "123456789012",
  ].map((s) => s.toLowerCase()),
);

export type AuthConfigFailureReason =
  | "missing_password"
  | "invalid_password"
  | "missing_session_secret"
  | "invalid_session_secret";

export type AuthConfig =
  | { ok: true; password: string; sessionSecret: string }
  | { ok: false; reason: AuthConfigFailureReason };

function isPlaceholderPassword(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (PLACEHOLDER_PASSWORDS.has(normalized)) return true;
  if (/^(.)\1{11,}$/.test(normalized)) return true; // aaaaaaaaaaaa
  if (/^x{8,}$/i.test(normalized)) return true;
  return false;
}

export function validateAppPassword(raw: string | undefined | null): {
  ok: boolean;
  reason?: "missing_password" | "invalid_password";
} {
  if (raw == null || raw.length === 0) return { ok: false, reason: "missing_password" };
  if (raw.length < APP_PASSWORD_MIN_LEN || raw.length > APP_PASSWORD_MAX_LEN) {
    return { ok: false, reason: "invalid_password" };
  }
  if (isPlaceholderPassword(raw)) return { ok: false, reason: "invalid_password" };
  // Reject whitespace-only / control chars
  if (/^\s+$/.test(raw) || /[\0\r\n]/.test(raw)) {
    return { ok: false, reason: "invalid_password" };
  }
  return { ok: true };
}

export function validateSessionSecret(raw: string | undefined | null): {
  ok: boolean;
  reason?: "missing_session_secret" | "invalid_session_secret";
} {
  if (raw == null || raw.length === 0) {
    return { ok: false, reason: "missing_session_secret" };
  }
  if (raw.length < APP_SESSION_SECRET_MIN_LEN || raw.length > APP_SESSION_SECRET_MAX_LEN) {
    return { ok: false, reason: "invalid_session_secret" };
  }
  if (/^\s+$/.test(raw) || /[\0\r\n]/.test(raw)) {
    return { ok: false, reason: "invalid_session_secret" };
  }
  const lower = raw.trim().toLowerCase();
  if (
    lower === "changeme" ||
    lower === "session-secret" ||
    lower === "app_session_secret" ||
    /^(.)\1{31,}$/.test(lower)
  ) {
    return { ok: false, reason: "invalid_session_secret" };
  }
  return { ok: true };
}

/**
 * Resolve auth config from env. Fail-closed: both secrets required and valid.
 * Never logs or returns secret values in failure reasons.
 */
export function resolveAuthConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): AuthConfig {
  const pwCheck = validateAppPassword(env.APP_PASSWORD);
  if (!pwCheck.ok) {
    return { ok: false, reason: pwCheck.reason ?? "missing_password" };
  }
  const secretCheck = validateSessionSecret(env.APP_SESSION_SECRET);
  if (!secretCheck.ok) {
    return { ok: false, reason: secretCheck.reason ?? "missing_session_secret" };
  }
  return {
    ok: true,
    password: env.APP_PASSWORD!,
    sessionSecret: env.APP_SESSION_SECRET!,
  };
}

/** @deprecated Use resolveAuthConfig — name kept for migration clarity. */
export function authEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return resolveAuthConfig(env).ok;
}

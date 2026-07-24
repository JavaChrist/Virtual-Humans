/* Porte d'accès simple par mot de passe unique.
 *
 * - La protection ne s'active QUE si `APP_PASSWORD` est défini (ex. sur Vercel).
 *   En local sans cette variable, l'accès reste ouvert (pas de friction en dev).
 * - Le cookie de session ne contient jamais le mot de passe : c'est un hash
 *   SHA-256 dérivé, recalculé et comparé par le middleware.
 * - Web Crypto (`crypto.subtle`) est disponible côté Edge (middleware) ET Node
 *   (routes API), donc la même fonction sert partout.
 */

export const AUTH_COOKIE = "vh_auth";

export function authEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0);
}

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`vh-studio::${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token attendu pour la session, ou `null` si la protection est désactivée. */
export async function expectedToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return sessionToken(pw);
}

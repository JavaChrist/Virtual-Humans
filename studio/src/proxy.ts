import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

/**
 * Proxy (ex-middleware, renommé selon la convention Next.js 16).
 * Porte d'accès par mot de passe : n'agit que si APP_PASSWORD est défini.
 */
export async function proxy(req: NextRequest) {
  const expected = await expectedToken();
  // Protection désactivée (pas de APP_PASSWORD) : on laisse tout passer.
  if (!expected) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // La page de connexion et sa route API doivent rester accessibles.
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === expected) return NextResponse.next();

  // Non authentifié : 401 pour les API (protège les générations payantes),
  // redirection vers /login pour les pages.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accès protégé — connexion requise." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // On protège tout SAUF les internes Next et les assets publics nécessaires
  // avant connexion (styles, manifeste PWA, service worker, icônes).
  matcher: ["/((?!_next/|icons/|screenshots/|manifest.webmanifest|sw.js|icon.svg|favicon.ico|apple-touch-icon.png).*)"],
};

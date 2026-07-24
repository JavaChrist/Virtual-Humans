/* Virtual Humans Studio — service worker (PWA offline shell).
 * Safe by design: never touches /api/* or cross-origin requests
 * (fal.ai, Supabase, OpenAI, ElevenLabs), so generation always hits the network.
 */
const CACHE = "vh-studio-v4";
const APP_SHELL = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin GETs. Leave provider calls (Supabase/fal/OpenAI) alone.
  if (url.origin !== self.location.origin) return;
  // Never cache API routes (generation, budget, assets, products…).
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, fall back to a cached page then /offline.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          // CRITIQUE : si le serveur a redirigé (ex. garde d'auth "/" → "/login"),
          // fetch() suit la redirection en silence et renverrait le HTML de /login
          // SANS changer l'URL. On renvoie donc une vraie redirection pour que le
          // navigateur re-navigue vers l'URL finale (URL correcte + routage sain).
          if (res.redirected) return Response.redirect(res.url, 302);
          return res;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match("/offline")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first with background fill.
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
  }
});

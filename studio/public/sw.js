/* Virtual Humans Studio — service worker (PWA offline shell).
 * Safe by design: never touches /api/* or cross-origin requests
 * (fal.ai, Supabase, OpenAI, ElevenLabs), so generation always hits the network.
 */
const CACHE = "vh-studio-v12";
/* Never cache /api/*, /director, /login, or authenticated HTML shells as public. */
const APP_SHELL = [
  "/offline",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // On NE fait PAS skipWaiting ici : la nouvelle version reste "waiting" tant que
  // l'utilisateur n'a pas confirmé via la mini-modale (message "SKIP_WAITING").
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  // Purge TOUS les anciens caches (sinon d'anciens chunks /_next restent servis).
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
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  // Ne jamais intercepter le SW lui-même.
  if (url.pathname === "/sw.js") return;
  // Auth-sensitive navigations: network only — no offline cache of protected HTML.
  if (
    request.mode === "navigate" &&
    (url.pathname.startsWith("/director") ||
      url.pathname === "/login" ||
      url.pathname.startsWith("/settings") ||
      url.pathname.startsWith("/budget"))
  ) {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match("/offline")) || Response.error()),
    );
    return;
  }

  // Navigations: network-first.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res.redirected) return Response.redirect(res.url, 302);
          return res;
        } catch {
          return (
            (await caches.match("/offline")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // Bundles Next : NETWORK-FIRST (sinon l'UI reste figée sur une vieille version).
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        } catch {
          return (await caches.match(request)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Icônes / manifest : cache-first OK.
  if (
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

"use client";

import { useEffect, useState } from "react";

/**
 * Enregistre le service worker (installable + offline) ET propose une mini-modale
 * "Mise à jour disponible" quand un nouveau déploiement est prêt.
 *
 * Mécanisme : le nouveau SW s'installe puis reste en "waiting" (sw.js ne fait plus
 * skipWaiting automatiquement). Dès qu'il est prêt, on affiche la modale. Au clic
 * sur « Mettre à jour », on envoie SKIP_WAITING → le SW s'active → controllerchange
 * → rechargement unique sur la nouvelle version.
 *
 * Ne s'exécute qu'en production (pas d'interférence avec le HMR de `next dev`).
 */
export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const host = window.location.hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^(10|127|192\.168)\./.test(host) ||
      host.endsWith(".local");

    // En dev ou sur localhost : on N'ENREGISTRE PAS de SW, et surtout on NETTOIE tout
    // SW résiduel + ses caches. Sinon un ancien SW (d'un build prod testé en local)
    // continue de resservir d'anciennes icônes/pages en cache-first, ce qui survit
    // au Ctrl+Shift+R et au vidage de cache classique.
    if (process.env.NODE_ENV !== "production" || isLocal) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

    // Rechargement unique quand le nouveau SW prend le contrôle.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let updateTimer: ReturnType<typeof setInterval> | null = null;

    const watchRegistration = (reg: ServiceWorkerRegistration) => {
      const showIfWaiting = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaiting(reg.waiting);
        }
      };
      showIfWaiting();

      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          // "installed" + un contrôleur existant = MISE À JOUR (pas le 1er install).
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(nw);
          }
        });
      });

      // Poll + check au retour sur l'onglet (sinon on rate les déploiements).
      const check = () => reg.update().then(showIfWaiting).catch(() => {});
      check();
      updateTimer = setInterval(check, 60 * 1000);
      const onVisible = () => {
        if (document.visibilityState === "visible") check();
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", check);

      return () => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", check);
      };
    };

    let stopWatch: (() => void) | undefined;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          stopWatch = watchRegistration(reg);
        })
        .catch(() => {
          /* registration best-effort */
        });
    };
    window.addEventListener("load", onLoad);

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (updateTimer) clearInterval(updateTimer);
      stopWatch?.();
    };
  }, []);

  function applyUpdate() {
    if (waiting) waiting.postMessage("SKIP_WAITING");
    // Le rechargement est déclenché par l'événement controllerchange.
  }

  if (!waiting) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
    >
      <div className="card w-full max-w-sm p-5 animate-[fadeIn_0.15s_ease-out]">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>🚀</span>
          <div className="flex-1">
            <h2 id="pwa-update-title" className="text-base font-semibold">
              Mise à jour disponible
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Une nouvelle version de Virtual Humans Studio est prête. Mets à jour pour profiter des
              dernières améliorations.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setWaiting(null)}>
            Plus tard
          </button>
          <button className="btn btn-primary" onClick={applyUpdate}>
            Mettre à jour
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Enregistre le service worker (installable + offline) ET propose une mini-modale
 * "Mise à jour disponible" quand un nouveau déploiement est prêt.
 *
 * Politique locale :
 * - `next dev` : SW OFF par défaut (évite les caches qui combattent HMR/Turbopack).
 * - `next start` / Production : SW ON même sur localhost (modale testable).
 * - Opt-in dev : NEXT_PUBLIC_VH_PWA_LOCAL=1|true pour forcer le SW en `next dev`.
 *
 * Important : en Next.js le useEffect tourne souvent APRÈS l'événement window "load".
 * Il ne faut donc PAS attendre "load" sinon update() ne part jamais et l'UI reste
 * coincée sur une vieille version en cache.
 */
function shouldRegisterServiceWorker(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const raw = process.env.NEXT_PUBLIC_VH_PWA_LOCAL?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

async function clearLocalServiceWorkers(): Promise<void> {
  const regs = await navigator.serviceWorker.getRegistrations?.();
  regs?.forEach((r) => r.unregister());
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export function PwaRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (!shouldRegisterServiceWorker()) {
      void clearLocalServiceWorkers();
      return;
    }

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let updateTimer: ReturnType<typeof setInterval> | null = null;
    let stopWatch: (() => void) | undefined;

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
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(nw);
          }
        });
      });

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

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        stopWatch = watchRegistration(reg);
      })
      .catch(() => {
        /* registration best-effort */
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      if (updateTimer) clearInterval(updateTimer);
      stopWatch?.();
    };
  }, []);

  function applyUpdate() {
    if (waiting) waiting.postMessage("SKIP_WAITING");
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
          <span className="text-2xl" aria-hidden>
            🚀
          </span>
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
          <button type="button" className="btn btn-ghost" onClick={() => setWaiting(null)}>
            Plus tard
          </button>
          <button type="button" className="btn btn-primary" onClick={applyUpdate}>
            Mettre à jour
          </button>
        </div>
      </div>
    </div>
  );
}

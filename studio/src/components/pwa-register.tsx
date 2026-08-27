"use client";

import { useEffect, useRef, useState } from "react";
import { APP_VERSION_PATH } from "@/lib/app-version";
import {
  APP_UPDATE_CHANNEL,
  APP_UPDATE_STORAGE_FALLBACK_KEY,
  APP_VERSION_POLL_MS,
  createAppUpdateSession,
  fetchAppVersionInit,
  type AppUpdateChannelMessage,
  type AppUpdateUxState,
} from "@/lib/app-update-client";
import { getActiveUpdateBlockers, subscribeToUpdateBlockers } from "@/lib/update-blockers";

/**
 * Enregistre le service worker (installable + offline) ET propose une mini-modale
 * "Mise à jour disponible" quand un nouveau déploiement est prêt.
 *
 * Politique locale :
 * - `next dev` : SW OFF par défaut (évite les caches qui combattent HMR/Turbopack).
 * - `next start` / Production : SW ON même sur localhost (modale testable).
 * - Opt-in dev : NEXT_PUBLIC_VH_PWA_LOCAL=1|true pour forcer le SW en `next dev`.
 *
 * Versionnage : poll GET /api/version (120 s + focus/visibilité), intégré ici.
 * Important : en Next.js le useEffect tourne souvent APRÈS l'événement window "load".
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

function modalVisible(ux: AppUpdateUxState): boolean {
  return (
    ux === "available" ||
    ux === "preparing" ||
    ux === "installing" ||
    ux === "blocked"
  );
}

export function PwaRegister() {
  const [ux, setUx] = useState<AppUpdateUxState>("idle");
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);
  const sessionRef = useRef<ReturnType<typeof createAppUpdateSession> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storage =
      typeof sessionStorage !== "undefined" ? sessionStorage : undefined;
    let channel: BroadcastChannel | null = null;
    let blockedAck = false;
    let registration: ServiceWorkerRegistration | null = null;

    const broadcast = (msg: AppUpdateChannelMessage) => {
      try {
        channel?.postMessage(msg);
      } catch {
        /* channel closed */
      }
      try {
        localStorage.setItem(
          APP_UPDATE_STORAGE_FALLBACK_KEY,
          JSON.stringify({ ...msg, t: Date.now() }),
        );
      } catch {
        /* private mode */
      }
    };

    const session = createAppUpdateSession({
      fetchVersion: async () => {
        const res = await fetch(APP_VERSION_PATH, fetchAppVersionInit());
        if (!res.ok) throw new Error("version");
        return res.json();
      },
      isOnline: () => navigator.onLine !== false,
      getBlockers: () => getActiveUpdateBlockers(),
      reload: () => {
        window.location.reload();
      },
      storage,
      updateRegistration: async () => {
        await registration?.update();
      },
      broadcast,
      waitForBlockedAck: async (ms) => {
        blockedAck = false;
        await new Promise((resolve) => setTimeout(resolve, ms));
        return blockedAck;
      },
    });
    sessionRef.current = session;

    const sync = () => {
      const state = session.getState();
      setUx(state.ux);
      setBlockedReasons(state.blockedReasons);
    };

    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(APP_UPDATE_CHANNEL);
      channel.onmessage = (event: MessageEvent<AppUpdateChannelMessage>) => {
        const msg = event.data;
        if (msg?.type === "blocked") blockedAck = true;
        session.handleChannel(msg);
        sync();
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== APP_UPDATE_STORAGE_FALLBACK_KEY || !event.newValue) return;
      try {
        const msg = JSON.parse(event.newValue) as AppUpdateChannelMessage;
        if (msg?.type === "blocked") blockedAck = true;
        session.handleChannel(msg);
        sync();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);

    const onControllerChange = () => {
      session.onControllerChange();
      sync();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    const unsubBlockers = subscribeToUpdateBlockers(sync);

    let updateTimer: ReturnType<typeof setInterval> | null = null;
    let stopWatch: (() => void) | undefined;

    const runPoll = () => {
      void (async () => {
        if (registration) {
          try {
            await registration.update();
          } catch {
            /* offline / SW */
          }
          session.setWaiting(registration.waiting ?? null);
        }
        await session.poll();
        sync();
      })();
    };

    const watchRegistration = (reg: ServiceWorkerRegistration) => {
      registration = reg;
      const showIfWaiting = () => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          session.setWaiting(reg.waiting);
          sync();
        }
      };
      showIfWaiting();

      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            session.setWaiting(nw);
            sync();
          }
        });
      });

      return () => {
        registration = null;
      };
    };

    if ("serviceWorker" in navigator && shouldRegisterServiceWorker()) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          stopWatch = watchRegistration(reg);
          runPoll();
        })
        .catch(() => {
          runPoll();
        });
    } else {
      if ("serviceWorker" in navigator && !shouldRegisterServiceWorker()) {
        void clearLocalServiceWorkers();
      }
      runPoll();
    }

    updateTimer = setInterval(runPoll, APP_VERSION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") runPoll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", runPoll);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", runPoll);
      document.removeEventListener("visibilitychange", onVisible);
      if (updateTimer) clearInterval(updateTimer);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      }
      unsubBlockers();
      stopWatch?.();
    };
  }, []);

  function applyUpdate() {
    void sessionRef.current?.apply().then(() => {
      const state = sessionRef.current?.getState();
      if (state) {
        setUx(state.ux);
        setBlockedReasons(state.blockedReasons);
      }
    });
  }

  function deferUpdate() {
    sessionRef.current?.defer();
    const state = sessionRef.current?.getState();
    if (state) setUx(state.ux);
  }

  if (!modalVisible(ux)) return null;

  const installing = ux === "installing";
  const blocked = ux === "blocked";
  const preparing = ux === "preparing";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-desc"
    >
      <div className="card w-full max-w-sm p-5 animate-[fadeIn_0.15s_ease-out]">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>
            🚀
          </span>
          <div className="flex-1">
            <h2 id="pwa-update-title" className="text-base font-semibold">
              {blocked ? "Mise à jour différée" : "Mise à jour disponible"}
            </h2>
            <p id="pwa-update-desc" className="mt-1 text-sm text-[var(--muted)]">
              {blocked
                ? `Termine d’abord : ${blockedReasons.join(" · ") || "une action est en cours"}.`
                : preparing
                  ? "Une nouvelle version est détectée. Tu peux l’appliquer maintenant."
                  : installing
                    ? "Installation en cours…"
                    : "Une nouvelle version de Virtual Humans Studio est prête. Mets à jour pour profiter des dernières améliorations."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={deferUpdate}
            disabled={installing}
          >
            Plus tard
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={applyUpdate}
            disabled={installing}
          >
            {installing ? "Installation…" : blocked ? "Réessayer" : "Mettre à jour"}
          </button>
        </div>
      </div>
    </div>
  );
}

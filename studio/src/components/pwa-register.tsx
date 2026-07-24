"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so the Studio is installable and works offline.
 * Only runs in production builds to avoid interfering with Next.js dev HMR.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    // Quand un nouveau service worker prend le contrôle (nouveau déploiement),
    // on recharge une seule fois pour éviter de rester sur d'anciens bundles en cache.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const onLoad = () => {
      // updateViaCache: "none" → le fichier sw.js n'est jamais servi depuis le
      // cache HTTP : le navigateur détecte tout de suite une nouvelle version.
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => reg.update().catch(() => {}))
        .catch(() => {
          /* registration is best-effort */
        });
    };
    window.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
  return null;
}

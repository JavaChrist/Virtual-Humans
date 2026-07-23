"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Modale de confirmation réutilisable — remplace window.confirm().
 * Usage : const confirm = useConfirm(); if (await confirm({ ... })) { ... }
 */

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style destructif (bouton rouge) pour les actions irréversibles. */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé dans <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  // Échap = annuler, Entrée = confirmer.
  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Voile */}
          <button
            aria-label="Fermer"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => close(false)}
          />
          {/* Boîte */}
          <div className="card relative w-full max-w-md p-6 shadow-2xl animate-[fadeIn_0.12s_ease-out]">
            {opts.title && <h2 className="text-lg font-bold mb-2">{opts.title}</h2>}
            <p className="text-sm text-[var(--muted)] leading-relaxed whitespace-pre-line">{opts.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn btn-ghost" onClick={() => close(false)}>
                {opts.cancelLabel ?? "Annuler"}
              </button>
              <button
                autoFocus
                className="btn btn-primary"
                style={
                  opts.danger
                    ? { background: "linear-gradient(135deg, var(--danger), #b91c1c)" }
                    : undefined
                }
                onClick={() => close(true)}
              >
                {opts.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

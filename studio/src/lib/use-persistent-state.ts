"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState qui se sauvegarde tout seul dans localStorage (brouillon).
 *
 * - `storageKey` peut être null (ex. personnage pas encore chargé) : dans ce cas
 *   rien n'est persisté tant que la clé n'est pas définie.
 * - Quand la clé change (ex. changement de personnage), on recharge le brouillon
 *   correspondant, sinon on repart de `initial`.
 * - L'écriture se fait DANS le setter (et non dans un effet) pour éviter toute
 *   course qui écraserait un brouillon existant au montage / au switch de clé.
 */
export function usePersistentState<T>(
  storageKey: string | null,
  initial: T,
): [T, Dispatch<SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(initial);
  const keyRef = useRef<string | null>(storageKey);
  const initialRef = useRef<T>(initial);

  useEffect(() => {
    keyRef.current = storageKey;
    if (!storageKey || typeof window === "undefined") {
      setValue(initialRef.current);
      return;
    }
    const raw = localStorage.getItem(storageKey);
    if (raw != null) {
      try {
        setValue(JSON.parse(raw) as T);
        return;
      } catch {
        /* JSON invalide : on repart de l'initial */
      }
    }
    setValue(initialRef.current);
  }, [storageKey]);

  const set = useCallback<Dispatch<SetStateAction<T>>>((updater) => {
    setValue((prev) => {
      const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
      const k = keyRef.current;
      if (k && typeof window !== "undefined") {
        try {
          localStorage.setItem(k, JSON.stringify(next));
        } catch {
          /* quota dépassé : on ignore */
        }
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    const k = keyRef.current;
    if (k && typeof window !== "undefined") localStorage.removeItem(k);
    setValue(initialRef.current);
  }, []);

  return [value, set, clear];
}

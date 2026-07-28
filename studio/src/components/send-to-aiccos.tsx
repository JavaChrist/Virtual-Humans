"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client";

interface SendToAiccosProps {
  /** URL de la vidéo générée (fal.ai). */
  videoUrl: string;
  /** Titre proposé par défaut, modifiable avant envoi. */
  defaultTitle: string;
  /** Slug produit AICCOS (optionnel) pour classer le clip. */
  productSlug?: string | null;
}

type SendState =
  | { step: "idle" }
  | { step: "editing" }
  | { step: "sending" }
  | { step: "done"; title: string }
  | { step: "error"; message: string };

/**
 * Bouton « Envoyer vers AICCOS » : pousse le clip généré dans la Médiathèque
 * d'AI Command Center OS via la route serveur /api/aiccos/send.
 */
export function SendToAiccos({ videoUrl, defaultTitle, productSlug }: SendToAiccosProps) {
  const [state, setState] = useState<SendState>({ step: "idle" });
  const [title, setTitle] = useState(defaultTitle);

  async function send() {
    setState({ step: "sending" });
    try {
      const res = await apiPost<{ clip: { title: string } }>("/api/aiccos/send", {
        videoUrl,
        title: title.trim() || defaultTitle,
        productSlug: productSlug ?? undefined,
      });
      setState({ step: "done", title: res.clip.title });
    } catch (e) {
      setState({ step: "error", message: e instanceof Error ? e.message : "Envoi impossible" });
    }
  }

  if (state.step === "done") {
    return (
      <p className="text-sm text-[var(--success)] mt-3">
        ✓ « {state.title} » est dans la Médiathèque AICCOS.
      </p>
    );
  }

  if (state.step === "idle") {
    return (
      <button type="button" className="btn btn-ghost w-full mt-3" onClick={() => setState({ step: "editing" })}>
        📤 Envoyer vers AICCOS
      </button>
    );
  }

  return (
    <div className="mt-3">
      <label className="label">Titre du clip dans la Médiathèque AICCOS</label>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          disabled={state.step === "sending"}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={state.step === "sending" || !title.trim()}
          onClick={send}
        >
          {state.step === "sending" ? "Envoi…" : "Envoyer"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={state.step === "sending"}
          onClick={() => setState({ step: "idle" })}
        >
          Annuler
        </button>
      </div>
      {state.step === "sending" && (
        <p className="text-xs text-[var(--muted)] mt-2 animate-pulse">
          Téléchargement du clip puis envoi vers la Médiathèque…
        </p>
      )}
      {state.step === "error" && (
        <p className="text-sm text-[var(--danger)] mt-2">{state.message}</p>
      )}
    </div>
  );
}

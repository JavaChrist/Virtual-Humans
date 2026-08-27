"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { PageHeader } from "@/components/page-header";
import { PromptComposer } from "@/components/prompt-composer";
import { addRefImage } from "@/lib/reflib";
import { setLastRefImage } from "@/lib/media-store";
import type { SettingsResponse } from "@/lib/types";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";

const SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
const QUALITIES = ["low", "medium", "high"] as const;

export default function ImageStudio() {
  const { characterId, characterName } = useCharacter();
  const name = characterName || "Mei";
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>("1024x1024");
  const [quality, setQuality] = useState<(typeof QUALITIES)[number]>("medium");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refLabel, setRefLabel] = useState("");
  const [savedRef, setSavedRef] = useState(false);
  useUpdateBlocker(loading, UPDATE_BLOCKER_IDS.generateImage, UPDATE_BLOCKER_REASONS.generating);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings").then((s) => setReady(s.keys.openai)).catch(() => {});
  }, []);

  useEffect(() => {
    apiPost<{ usd: number }>("/api/estimate", { type: "image", size, quality, n: 1 })
      .then((d) => setEstimate(d.usd))
      .catch(() => setEstimate(null));
  }, [size, quality]);

  async function generate() {
    setLoading(true);
    setError(null);
    setImage(null);
    try {
      const res = await apiPost<{ dataUrl: string }>("/api/generate/image", { prompt, size, quality });
      setImage(res.dataUrl);
      refreshBudget();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title="Studio Image" subtitle="OpenAI · gpt-image-1 — génération d'images du personnage" />

      {!ready && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">
            Clé <code>OPENAI_API_KEY</code> manquante. Ajoute-la dans <code>.env.local</code> (voir Réglages).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <PromptComposer categories={["image", "social", "marketing"]} characterName={name} value={prompt} onChange={setPrompt} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <div>
              <label className="label">Taille</label>
              <select className="select" value={size} onChange={(e) => setSize(e.target.value as typeof size)}>
                {SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Qualité</label>
              <select className="select" value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)}>
                {QUALITIES.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-[var(--muted)]">
              Coût estimé : <span className="text-[var(--foreground)] font-semibold">{usd(estimate)}</span>
            </div>
            <button className="btn btn-primary" disabled={!prompt || loading || !ready} onClick={generate}>
              {loading ? "Génération…" : "Générer l'image"}
            </button>
          </div>
        </div>

        <div className="card p-6 flex items-center justify-center min-h-[420px]">
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          {!error && !image && !loading && (
            <p className="text-sm text-[var(--muted)]">L&apos;image générée apparaîtra ici.</p>
          )}
          {loading && <p className="text-sm text-[var(--muted)] animate-pulse">Génération en cours…</p>}
          {image && (
            <div className="w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="résultat" className="w-full rounded-xl border border-[var(--border)]" />
              <a href={image} download="mei-image.png" className="btn btn-ghost mt-4 w-full">
                Télécharger
              </a>
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <label className="label">Ajouter à la bibliothèque de références</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    value={refLabel}
                    onChange={(e) => setRefLabel(e.target.value)}
                    placeholder={`Ex. : ${name} studio, ${name} rue, tenue rouge…`}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      addRefImage(characterId, image, refLabel || `${name}`);
                      setLastRefImage(characterId, image);
                      setRefLabel("");
                      setSavedRef(true);
                      setTimeout(() => setSavedRef(false), 2500);
                    }}
                  >
                    {savedRef ? "✓ Ajoutée" : "Enregistrer"}
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Ces images serviront à garder le visage de {name} cohérent (Seedance, image→vidéo).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

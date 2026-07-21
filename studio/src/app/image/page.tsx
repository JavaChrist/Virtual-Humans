"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd } from "@/lib/client";
import { PageHeader } from "@/components/page-header";
import { PromptComposer } from "@/components/prompt-composer";
import type { CharacterResponse, SettingsResponse } from "@/lib/types";

const SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
const QUALITIES = ["low", "medium", "high"] as const;

export default function ImageStudio() {
  const [name, setName] = useState("Mei");
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>("1024x1024");
  const [quality, setQuality] = useState<(typeof QUALITIES)[number]>("medium");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedRef, setSavedRef] = useState(false);

  useEffect(() => {
    apiGet<CharacterResponse>("/api/character").then((c) => setName(c.overview.name)).catch(() => {});
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

          <div className="grid grid-cols-2 gap-3 mt-5">
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
              <div className="flex gap-3 mt-4">
                <a href={image} download="mei-image.png" className="btn btn-ghost flex-1">
                  Télécharger
                </a>
                <button
                  className="btn btn-primary flex-1"
                  onClick={() => {
                    localStorage.setItem("mei:refImage", image);
                    setSavedRef(true);
                    setTimeout(() => setSavedRef(false), 2500);
                  }}
                >
                  {savedRef ? "✓ Enregistrée" : "Utiliser comme référence vidéo"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { getLastRefImage, setLastVideo } from "@/lib/media-store";
import { PageHeader } from "@/components/page-header";
import { PromptComposer } from "@/components/prompt-composer";
import type { SettingsResponse } from "@/lib/types";

interface VideoModel {
  id: string;
  label: string;
  engine: string;
  mode: "text-to-video" | "image-to-video" | "reference-to-video";
  audio: "native" | "silent";
  usdPerSecond: number;
  defaultSeconds: number;
  seconds: number[];
  aspectRatios: string[];
}

interface AssetItem {
  category: string;
  name: string;
  relPath: string;
}
type AssetGroups = Record<string, AssetItem[]>;

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identité (visage & corps)",
  expressions: "Expressions",
  poses: "Poses",
  outfits: "Tenues",
};

export default function VideoStudio() {
  const { characterId, characterName } = useCharacter();
  const name = characterName || "Mei";
  const [assets, setAssets] = useState<AssetGroups>({});
  const [ready, setReady] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [aspect, setAspect] = useState("9:16");
  const [imageUrl, setImageUrl] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [useRefImage, setUseRefImage] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const model = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings").then((s) => setReady(s.keys.fal)).catch(() => {});
    apiGet<{ models: VideoModel[] }>("/api/video-models").then((d) => {
      setModels(d.models);
      if (d.models[0]) {
        setModelId(d.models[0].id);
        setSeconds(d.models[0].defaultSeconds);
      }
    });
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, []);

  // Load the character's SDK assets + last generated reference image on change.
  useEffect(() => {
    if (!characterId) return;
    setSelectedRefs([]);
    setRefImage(getLastRefImage(characterId));
    apiGet<{ assets: AssetGroups }>(withCharacter("/api/assets", characterId))
      .then((d) => {
        setAssets(d.assets ?? {});
        // Pre-select a few identity shots for convenience.
        const identity = (d.assets?.identity ?? []).map((a) => a.relPath);
        const preferred = ["identity/master_face_v1.png", "identity/portrait_front.png", "identity/full_body_front.png"];
        const preselect = preferred.filter((p) => identity.includes(p));
        setSelectedRefs(preselect.length ? preselect : identity.slice(0, 3));
      })
      .catch(() => setAssets({}));
  }, [characterId]);

  useEffect(() => {
    if (!modelId) return;
    apiPost<{ usd: number }>("/api/estimate", { type: "video", model: modelId, seconds })
      .then((d) => setEstimate(d.usd))
      .catch(() => setEstimate(null));
  }, [modelId, seconds]);

  // Safety net: keep the aspect ratio valid for the current model (Veo rejects 1:1).
  useEffect(() => {
    if (model && !model.aspectRatios.includes(aspect)) {
      setAspect(model.aspectRatios[0]);
    }
  }, [model, aspect]);

  function selectModel(id: string) {
    setModelId(id);
    const m = models.find((x) => x.id === id);
    if (m) {
      setSeconds(m.defaultSeconds);
      // Reset ratio if the new model doesn't support the current one (Veo rejects 1:1).
      if (!m.aspectRatios.includes(aspect)) setAspect(m.aspectRatios[0]);
    }
  }

  const isImageToVideo = model?.mode === "image-to-video";
  const isReference = model?.mode === "reference-to-video";
  const referenceValue = useRefImage ? refImage ?? "" : imageUrl;
  const totalAssets = Object.values(assets).reduce((n, list) => n + list.length, 0);

  function assetSrc(relPath: string) {
    return `/api/asset?character=${encodeURIComponent(characterId)}&path=${encodeURIComponent(relPath)}`;
  }

  function toggleRef(relPath: string) {
    setSelectedRefs((prev) => {
      if (prev.includes(relPath)) return prev.filter((x) => x !== relPath);
      if (prev.length >= 9) return prev; // Seedance accepts up to 9 references
      return [...prev, relPath];
    });
  }

  async function generate() {
    setError(null);
    setVideoUrl(null);
    setStatus("Envoi…");
    if (polling.current) clearInterval(polling.current);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/video", {
        model: modelId,
        prompt,
        seconds,
        aspectRatio: aspect,
        imageUrl: isImageToVideo ? referenceValue || undefined : undefined,
        character: isReference ? characterId : undefined,
        assetPaths: isReference ? selectedRefs : undefined,
      });
      refreshBudget();
      setStatus("En file d'attente…");
      polling.current = setInterval(async () => {
        try {
          const res = await apiPost<{ status: string; videoUrl?: string; error?: string }>("/api/generate/status", {
            model: sub.model,
            requestId: sub.requestId,
          });
          setStatus(res.status);
          if (res.status === "FAILED") {
            if (polling.current) clearInterval(polling.current);
            setError(res.error ? `Échec fal : ${res.error}` : "Échec de la génération");
            setStatus(null);
            return;
          }
          if (res.status === "COMPLETED") {
            if (polling.current) clearInterval(polling.current);
            setVideoUrl(res.videoUrl ?? null);
            setStatus(res.videoUrl ? "Terminé" : "Terminé (pas d'URL vidéo)");
            if (res.videoUrl) setLastVideo(characterId, res.videoUrl, seconds);
          }
        } catch (e) {
          if (polling.current) clearInterval(polling.current);
          setError(e instanceof Error ? e.message : "Erreur de suivi");
          setStatus(null);
        }
      }, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setStatus(null);
    }
  }

  const busy = status !== null && status !== "Terminé" && !videoUrl && !error;

  return (
    <div className="max-w-6xl">
      <PageHeader title="Studio Vidéo" subtitle="fal.ai — Veo · Runway · Kling · MiniMax (génération asynchrone)" />

      {!ready && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">
            Clé <code>FAL_KEY</code> manquante (voir Réglages).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Moteur / modèle</label>
              <select className="select" value={modelId} onChange={(e) => selectModel(e.target.value)}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {usd(m.usdPerSecond)}/s
                  </option>
                ))}
              </select>
              {model && (
                <div className="mt-2 flex gap-2">
                  <span className="badge">
                    {model.mode === "image-to-video"
                      ? "image→vidéo"
                      : model.mode === "reference-to-video"
                        ? "réf→vidéo (identité)"
                        : "text→vidéo"}
                  </span>
                  <span className={`badge ${model.audio === "native" ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>
                    {model.audio === "native" ? "🔊 audio natif" : "🔇 muet (voix via Lip-sync)"}
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="label">Durée (s)</label>
              <select className="select" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                {(model?.seconds ?? [5]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ratio</label>
              <select className="select" value={aspect} onChange={(e) => setAspect(e.target.value)}>
                {(model?.aspectRatios ?? ["9:16", "16:9"]).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {isReference && (
            <div className="mt-3">
              <label className="label">
                Références d&apos;identité de {name} — SDK ({selectedRefs.length}/9 sélectionnée{selectedRefs.length > 1 ? "s" : ""})
              </label>
              {totalAssets === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Aucun asset trouvé pour ce personnage sous <code>characters/{characterId}/assets</code>.
                </p>
              ) : (
                <>
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
                    {["identity", "expressions", "poses", "outfits"].map((cat) => {
                      const list = assets[cat] ?? [];
                      if (list.length === 0) return null;
                      return (
                        <div key={cat}>
                          <p className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">
                            {CATEGORY_LABELS[cat] ?? cat}
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {list.map((a) => {
                              const active = selectedRefs.includes(a.relPath);
                              return (
                                <button
                                  key={a.relPath}
                                  type="button"
                                  onClick={() => toggleRef(a.relPath)}
                                  className={`relative rounded-lg overflow-hidden border-2 ${
                                    active ? "border-[var(--accent)]" : "border-[var(--border)]"
                                  }`}
                                  title={a.name}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={assetSrc(a.relPath)} alt={a.name} className="h-20 w-full object-cover" />
                                  {active && (
                                    <span className="absolute top-1 right-1 bg-[var(--accent)] text-white text-xs rounded px-1">✓</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-2">
                    Jusqu&apos;à 9 images. Combine des vues du visage (identité) + une tenue + une expression
                    pour verrouiller l&apos;apparence de {name} d&apos;un plan à l&apos;autre.
                  </p>
                </>
              )}
            </div>
          )}

          {isImageToVideo && (
            <div className="mt-3">
              <label className="label">Image de référence (requise)</label>
              {refImage && (
                <label className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2 cursor-pointer">
                  <input type="checkbox" checked={useRefImage} onChange={(e) => setUseRefImage(e.target.checked)} />
                  Utiliser la dernière image {name} générée dans le Studio Image
                </label>
              )}
              {useRefImage && refImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={refImage} alt="référence" className="h-24 rounded-lg border border-[var(--border)]" />
              ) : (
                <input
                  className="input"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…/mei-reference.png"
                />
              )}
            </div>
          )}

          <div className="mt-5">
            <PromptComposer categories={["video"]} characterName={name} value={prompt} onChange={setPrompt} />
          </div>

          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-[var(--muted)]">
              Coût estimé : <span className="text-[var(--foreground)] font-semibold">{usd(estimate)}</span>
            </div>
            <button
              className="btn btn-primary"
              disabled={
                !prompt ||
                busy ||
                !ready ||
                (isImageToVideo && !referenceValue) ||
                (isReference && selectedRefs.length === 0)
              }
              onClick={generate}
            >
              {busy ? "En cours…" : "Générer la vidéo"}
            </button>
          </div>
        </div>

        <div className="card p-6 flex flex-col items-center justify-center min-h-[420px]">
          {error && <p className="text-sm text-[var(--danger)] text-center">{error}</p>}
          {!error && status && !videoUrl && (
            <div className="text-center">
              <p className="text-sm text-[var(--muted)] animate-pulse">Statut : {status}</p>
              <p className="text-xs text-[var(--muted)] mt-2">La génération vidéo peut prendre plusieurs minutes.</p>
            </div>
          )}
          {!error && !status && !videoUrl && (
            <p className="text-sm text-[var(--muted)]">La vidéo générée apparaîtra ici.</p>
          )}
          {videoUrl && (
            <div className="w-full">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={videoUrl} controls className="w-full rounded-xl border border-[var(--border)]" />
              <div className="flex gap-3 mt-4">
                <a href={videoUrl} target="_blank" rel="noreferrer" className="btn btn-ghost flex-1">
                  Ouvrir / Télécharger
                </a>
                {model?.audio !== "native" && (
                  <Link href="/lipsync" className="btn btn-primary flex-1">
                    Ajouter la voix (Lip-sync) →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

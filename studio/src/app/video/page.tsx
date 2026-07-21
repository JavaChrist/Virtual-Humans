"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd } from "@/lib/client";
import { PageHeader } from "@/components/page-header";
import { PromptComposer } from "@/components/prompt-composer";
import type { CharacterResponse, SettingsResponse } from "@/lib/types";

interface VideoModel {
  id: string;
  label: string;
  engine: string;
  mode: "text-to-video" | "image-to-video";
  audio: "native" | "silent";
  usdPerSecond: number;
  defaultSeconds: number;
  seconds: number[];
}

const ASPECTS = ["9:16", "16:9", "1:1"];

export default function VideoStudio() {
  const [name, setName] = useState("Mei");
  const [ready, setReady] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [aspect, setAspect] = useState("9:16");
  const [imageUrl, setImageUrl] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [useRefImage, setUseRefImage] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [estimate, setEstimate] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const model = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);

  useEffect(() => {
    apiGet<CharacterResponse>("/api/character").then((c) => setName(c.overview.name)).catch(() => {});
    apiGet<SettingsResponse>("/api/settings").then((s) => setReady(s.keys.fal)).catch(() => {});
    apiGet<{ models: VideoModel[] }>("/api/video-models").then((d) => {
      setModels(d.models);
      if (d.models[0]) {
        setModelId(d.models[0].id);
        setSeconds(d.models[0].defaultSeconds);
      }
    });
    if (typeof window !== "undefined") setRefImage(localStorage.getItem("mei:refImage"));
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, []);

  useEffect(() => {
    if (!modelId) return;
    apiPost<{ usd: number }>("/api/estimate", { type: "video", model: modelId, seconds })
      .then((d) => setEstimate(d.usd))
      .catch(() => setEstimate(null));
  }, [modelId, seconds]);

  function selectModel(id: string) {
    setModelId(id);
    const m = models.find((x) => x.id === id);
    if (m) setSeconds(m.defaultSeconds);
  }

  const isImageToVideo = model?.mode === "image-to-video";
  const referenceValue = useRefImage ? refImage ?? "" : imageUrl;

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
      });
      refreshBudget();
      setStatus("En file d'attente…");
      polling.current = setInterval(async () => {
        try {
          const res = await apiPost<{ status: string; videoUrl?: string }>("/api/generate/status", {
            model: sub.model,
            requestId: sub.requestId,
          });
          setStatus(res.status);
          if (res.status === "COMPLETED") {
            if (polling.current) clearInterval(polling.current);
            setVideoUrl(res.videoUrl ?? null);
            setStatus(res.videoUrl ? "Terminé" : "Terminé (pas d'URL vidéo)");
            if (res.videoUrl && typeof window !== "undefined") {
              localStorage.setItem("mei:lastVideo", res.videoUrl);
              localStorage.setItem("mei:lastVideoSeconds", String(seconds));
            }
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
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
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
                  <span className="badge">{model.mode === "image-to-video" ? "image→vidéo" : "text→vidéo"}</span>
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
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

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
              disabled={!prompt || busy || !ready || (isImageToVideo && !referenceValue)}
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

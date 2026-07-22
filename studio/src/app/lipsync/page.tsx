"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { getLastVideo } from "@/lib/media-store";
import { PageHeader } from "@/components/page-header";
import type { SettingsResponse } from "@/lib/types";

interface LipsyncModel {
  id: string;
  label: string;
  usdPerMinute: number;
}

export default function LipsyncStudio() {
  const { characterId, characterName } = useCharacter();
  const [ready, setReady] = useState({ fal: false, eleven: false });
  const [models, setModels] = useState<LipsyncModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [seconds, setSeconds] = useState(8);
  const [text, setText] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings")
      .then((s) => setReady({ fal: s.keys.fal, eleven: s.keys.elevenlabs }))
      .catch(() => {});
    apiGet<{ lipsyncModels: LipsyncModel[] }>("/api/video-models").then((d) => {
      setModels(d.lipsyncModels);
      if (d.lipsyncModels[0]) setModelId(d.lipsyncModels[0].id);
    });
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, []);

  // Prefill with the active character's last generated video.
  useEffect(() => {
    const last = getLastVideo(characterId);
    if (last) {
      setVideoUrl(last.url);
      setSeconds(last.seconds);
    }
  }, [characterId]);

  useEffect(() => {
    if (!modelId) return;
    apiPost<{ usd: number }>("/api/estimate", { type: "lipsync", model: modelId, seconds })
      .then((d) => setEstimate(d.usd))
      .catch(() => setEstimate(null));
  }, [modelId, seconds]);

  async function makeVoice() {
    setVoiceBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ dataUrl: string }>("/api/generate/voice", { text, character: characterId });
      setAudioDataUrl(res.dataUrl);
      refreshBudget();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur voix");
    } finally {
      setVoiceBusy(false);
    }
  }

  async function run() {
    setError(null);
    setResultUrl(null);
    setStatus("Envoi…");
    if (polling.current) clearInterval(polling.current);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/lipsync", {
        model: modelId,
        videoUrl,
        audioDataUrl,
        seconds,
      });
      refreshBudget();
      setStatus("En file d'attente…");
      polling.current = setInterval(async () => {
        try {
          const r = await apiPost<{ status: string; videoUrl?: string; error?: string }>("/api/generate/status", {
            model: sub.model,
            requestId: sub.requestId,
          });
          setStatus(r.status);
          if (r.status === "FAILED") {
            if (polling.current) clearInterval(polling.current);
            setError(r.error ? `Échec fal : ${r.error}` : "Échec");
            setStatus(null);
            return;
          }
          if (r.status === "COMPLETED") {
            if (polling.current) clearInterval(polling.current);
            setResultUrl(r.videoUrl ?? null);
            setStatus(r.videoUrl ? "Terminé" : "Terminé (pas d'URL)");
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

  const busy = status !== null && status !== "Terminé" && !resultUrl && !error;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Studio Lip-sync"
        subtitle="Cale les lèvres d'une vidéo muette sur une voix ElevenLabs — la vraie voix de ton influenceuse"
      />

      {(!ready.fal || !ready.eleven) && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">
            Clés requises : {!ready.fal && <code>FAL_KEY</code>} {!ready.eleven && <code>ELEVENLABS_API_KEY</code>} (voir Réglages).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-5">
          <div>
            <label className="label">1. Vidéo source (muette)</label>
            <input
              className="input"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="URL de la vidéo (pré-remplie depuis le Studio Vidéo)"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Astuce : génère un plan dans le Studio Vidéo, il est repris ici automatiquement.
            </p>
          </div>

          <div>
            <label className="label">2. Réplique de {characterName || "ton personnage"} (voix ElevenLabs)</label>
            <textarea
              className="input min-h-[90px]"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ex. : Salut ! Je teste les meilleures apps tech du moment. Tu connais celle-ci ?"
            />
            <div className="flex items-center gap-3 mt-2">
              <button className="btn btn-ghost" disabled={!text || voiceBusy || !ready.eleven} onClick={makeVoice}>
                {voiceBusy ? "Génération…" : "Générer la voix"}
              </button>
              {audioDataUrl && (
                <>
                  <span className="badge text-[var(--success)]">✓ voix prête</span>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={audioDataUrl} controls className="h-8" />
                </>
              )}
            </div>
          </div>

          <div>
            <label className="label">3. Modèle de lip-sync</label>
            <select className="select" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {usd(m.usdPerMinute)}/min
                </option>
              ))}
            </select>
            <label className="label mt-3">Durée de la vidéo (s) — pour l&apos;estimation</label>
            <input
              className="input"
              type="number"
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <div className="text-sm text-[var(--muted)]">
              Coût estimé : <span className="text-[var(--foreground)] font-semibold">{usd(estimate)}</span>
            </div>
            <button
              className="btn btn-primary"
              disabled={!videoUrl || !audioDataUrl || busy || !ready.fal}
              onClick={run}
            >
              {busy ? "Synchronisation…" : "Synchroniser les lèvres"}
            </button>
          </div>
        </div>

        <div className="card p-6 flex flex-col items-center justify-center min-h-[420px]">
          {error && <p className="text-sm text-[var(--danger)] text-center">{error}</p>}
          {!error && status && !resultUrl && (
            <p className="text-sm text-[var(--muted)] animate-pulse">Statut : {status}</p>
          )}
          {!error && !status && !resultUrl && (
            <p className="text-sm text-[var(--muted)]">La vidéo synchronisée apparaîtra ici.</p>
          )}
          {resultUrl && (
            <div className="w-full">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={resultUrl} controls className="w-full rounded-xl border border-[var(--border)]" />
              <a href={resultUrl} target="_blank" rel="noreferrer" className="btn btn-ghost mt-4 w-full">
                Ouvrir / Télécharger
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

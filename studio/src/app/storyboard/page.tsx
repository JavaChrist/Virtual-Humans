"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd } from "@/lib/client";
import { PageHeader } from "@/components/page-header";
import type { SettingsResponse } from "@/lib/types";

interface VideoModel {
  id: string;
  label: string;
  audio: "native" | "silent";
  usdPerSecond: number;
  defaultSeconds: number;
  seconds: number[];
}

interface Shot {
  title: string;
  prompt: string;
  seconds: number;
  status: string | null;
  requestId?: string;
  model?: string;
  videoUrl?: string | null;
  error?: string | null;
}

const MICRO_TROTTOIR: Omit<Shot, "status">[] = [
  { title: "1. Hook caméra", prompt: "Mei, jeune femme tech influenceuse, parle face caméra dans une rue animée, sourire énergique : « J'ai testé 100 apps cette semaine, une seule m'a bluffée. »", seconds: 8 },
  { title: "2. Question passant #1", prompt: "Mei tend un micro à un passant dans la rue et demande avec enthousiasme : « Tu utilises quoi comme app pour t'organiser ? »", seconds: 8 },
  { title: "3. Question passant #2", prompt: "Mei interpelle un autre passant, ambiance micro-trottoir, lumière naturelle : « Et toi, tu connais une app qui te fait vraiment gagner du temps ? »", seconds: 8 },
  { title: "4. Réaction / B-roll", prompt: "Plan d'illustration : mains tenant un smartphone montrant une interface d'application épurée, arrière-plan urbain flou.", seconds: 6 },
  { title: "5. Démo de l'app", prompt: "Mei montre l'écran de son téléphone face caméra, désigne l'application avec le doigt, expression convaincue.", seconds: 10 },
  { title: "6. Punchline", prompt: "Mei, gros plan visage, clin d'œil complice : « Franchement, celle-là, elle change tout. »", seconds: 6 },
  { title: "7. CTA", prompt: "Mei face caméra, pouce levé, énergie positive : « Le lien est en bio, teste-la et dis-moi ce que t'en penses ! »", seconds: 8 },
];

export default function Storyboard() {
  const [ready, setReady] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [aspect, setAspect] = useState("9:16");
  const [shots, setShots] = useState<Shot[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  const model = models.find((m) => m.id === modelId);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings").then((s) => setReady(s.keys.fal)).catch(() => {});
    apiGet<{ models: VideoModel[] }>("/api/video-models").then((d) => {
      setModels(d.models);
      if (d.models[0]) setModelId(d.models[0].id);
    });
    return () => Object.values(timers.current).forEach(clearInterval);
  }, []);

  function loadPreset() {
    setShots(MICRO_TROTTOIR.map((s) => ({ ...s, status: null })));
  }

  function addShot() {
    setShots((prev) => [...prev, { title: `Plan ${prev.length + 1}`, prompt: "", seconds: model?.defaultSeconds ?? 6, status: null }]);
  }

  function update(i: number, patch: Partial<Shot>) {
    setShots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function remove(i: number) {
    setShots((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalSeconds = shots.reduce((a, s) => a + (s.seconds || 0), 0);
  const totalCost = model ? +(model.usdPerSecond * totalSeconds).toFixed(2) : 0;

  async function generateShot(i: number) {
    const shot = shots[i];
    if (!shot.prompt) return;
    update(i, { status: "Envoi…", videoUrl: null, error: null });
    if (timers.current[i]) clearInterval(timers.current[i]);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/video", {
        model: modelId,
        prompt: shot.prompt,
        seconds: shot.seconds,
        aspectRatio: aspect,
      });
      refreshBudget();
      update(i, { status: "En file…", requestId: sub.requestId, model: sub.model });
      timers.current[i] = setInterval(async () => {
        try {
          const r = await apiPost<{ status: string; videoUrl?: string }>("/api/generate/status", {
            model: sub.model,
            requestId: sub.requestId,
          });
          update(i, { status: r.status });
          if (r.status === "COMPLETED") {
            clearInterval(timers.current[i]);
            update(i, { status: r.videoUrl ? "Terminé" : "Terminé (pas d'URL)", videoUrl: r.videoUrl ?? null });
          }
        } catch (e) {
          clearInterval(timers.current[i]);
          update(i, { status: null, error: e instanceof Error ? e.message : "Erreur" });
        }
      }, 4000);
    } catch (e) {
      update(i, { status: null, error: e instanceof Error ? e.message : "Erreur" });
    }
  }

  async function generateAll() {
    for (let i = 0; i < shots.length; i++) {
      if (!shots[i].videoUrl) await generateShot(i);
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Storyboard 60 s"
        subtitle="Découpe ta vidéo en plans, génère-les un par un, suis le budget cumulé — puis assemble au montage"
      />

      {!ready && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">Clé <code>FAL_KEY</code> manquante (voir Réglages).</p>
        </div>
      )}

      <div className="card p-5 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="label">Moteur (appliqué à tous les plans)</label>
          <select className="select" value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label} — {usd(m.usdPerSecond)}/s</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ratio</label>
          <select className="select" value={aspect} onChange={(e) => setAspect(e.target.value)}>
            {["9:16", "16:9", "1:1"].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={loadPreset}>Charger le modèle micro-trottoir</button>
        <button className="btn btn-ghost" onClick={addShot}>+ Ajouter un plan</button>
      </div>

      {model?.audio !== "native" && shots.length > 0 && (
        <div className="card p-4 mb-6">
          <p className="text-sm text-[var(--muted)]">
            🔇 Ce moteur est muet. Après génération, passe chaque plan (ou le montage) dans le <strong>Studio Lip-sync</strong> pour ajouter la voix de {`{character}`}.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {shots.map((shot, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <input
                className="input flex-1"
                value={shot.title}
                onChange={(e) => update(i, { title: e.target.value })}
              />
              <select
                className="select w-24"
                value={shot.seconds}
                onChange={(e) => update(i, { seconds: Number(e.target.value) })}
              >
                {(model?.seconds ?? [5, 6, 8, 10]).map((s) => <option key={s} value={s}>{s}s</option>)}
              </select>
              <button className="btn btn-ghost" onClick={() => remove(i)}>✕</button>
            </div>
            <textarea
              className="input min-h-[70px]"
              value={shot.prompt}
              onChange={(e) => update(i, { prompt: e.target.value })}
              placeholder="Décris ce plan…"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm">
                {shot.error && <span className="text-[var(--danger)]">{shot.error}</span>}
                {!shot.error && shot.status && <span className="text-[var(--muted)]">Statut : {shot.status}</span>}
                {shot.videoUrl && (
                  <a href={shot.videoUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline ml-2">
                    voir le plan
                  </a>
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={!shot.prompt || !ready || (!!shot.status && !shot.videoUrl && !shot.error)}
                onClick={() => generateShot(i)}
              >
                Générer ce plan
              </button>
            </div>
            {shot.videoUrl && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={shot.videoUrl} controls className="w-full rounded-lg border border-[var(--border)] mt-3 max-h-64" />
            )}
          </div>
        ))}
      </div>

      {shots.length > 0 && (
        <div className="card p-5 mt-6 flex flex-wrap items-center justify-between gap-4 sticky bottom-4">
          <div className="text-sm text-[var(--muted)]">
            {shots.length} plans · {totalSeconds}s au total ·{" "}
            <span className="text-[var(--foreground)] font-semibold">budget estimé {usd(totalCost)}</span>
            {totalSeconds < 60 && <span className="ml-2 text-[var(--muted)]">(vise ~60s)</span>}
          </div>
          <button className="btn btn-primary" disabled={!ready} onClick={generateAll}>
            Générer tous les plans restants
          </button>
        </div>
      )}

      {shots.length === 0 && (
        <div className="card p-8 text-center text-sm text-[var(--muted)]">
          Charge le modèle micro-trottoir ou ajoute des plans pour commencer.
          <br />
          Assemblage final : télécharge chaque plan puis monte-les (CapCut, Premiere, DaVinci) pour obtenir la vidéo 60 s.
        </div>
      )}
    </div>
  );
}

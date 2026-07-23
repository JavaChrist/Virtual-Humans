"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { PageHeader } from "@/components/page-header";
import type { SettingsResponse } from "@/lib/types";

interface VideoModel {
  id: string;
  label: string;
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

interface Shot {
  title: string;
  prompt: string;
  seconds: number;
  status: string | null;
  requestId?: string;
  model?: string;
  videoUrl?: string | null;
  error?: string | null;
  // Décor : lieu + image fixe (identité préservée) servant de frame de départ.
  location?: string;
  sceneImageUrl?: string | null;
  sceneBusy?: boolean;
  sceneError?: string | null;
}

// IMAGE→VIDÉO : les prompts NE décrivent PAS l'apparence/le genre du personnage
// (déjà présent sur l'image de départ) — sinon le modèle "morphe" et change le
// visage/la tenue. On décrit uniquement l'ACTION + on force la cohérence.
const CONSISTENCY = "Exactement la même personne et la même tenue que sur l'image, identité inchangée, une seule personne, aucun changement de vêtements.";
const MICRO_TROTTOIR: Omit<Shot, "status">[] = [
  { title: "1. Hook caméra", prompt: `Parle face caméra avec un sourire énergique, léger geste de la main. ${CONSISTENCY}`, seconds: 5, location: "rue animée" },
  { title: "2. Question passant #1", prompt: `Tend un micro comme en micro-trottoir, attitude enthousiaste, regard caméra. ${CONSISTENCY}`, seconds: 5, location: "rue animée" },
  { title: "3. Question passant #2", prompt: `Interpelle quelqu'un, hoche la tête, écoute attentivement, micro en main. ${CONSISTENCY}`, seconds: 5, location: "trottoir de centre-ville" },
  { title: "4. Réaction / B-roll", prompt: "Plan d'illustration : une main tient un smartphone montrant une interface d'application épurée, arrière-plan flou. Aucun visage.", seconds: 5, location: "" },
  { title: "5. Démo de l'app", prompt: `Montre l'écran du téléphone face caméra, désigne l'application du doigt, expression convaincue. ${CONSISTENCY}`, seconds: 10, location: "rue animée" },
  { title: "6. Punchline", prompt: `Sourire complice, clin d'œil, léger mouvement de tête. ${CONSISTENCY}`, seconds: 5, location: "rue animée" },
  { title: "7. CTA", prompt: `Pouce levé, énergie positive, regard caméra. ${CONSISTENCY}`, seconds: 5, location: "rue animée" },
];

export default function Storyboard() {
  const { characterId, characterName } = useCharacter();
  const [ready, setReady] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [aspect, setAspect] = useState("9:16");
  const [assets, setAssets] = useState<AssetGroups>({});
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const mergeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const model = models.find((m) => m.id === modelId);

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings").then((s) => setReady(s.keys.fal)).catch(() => {});
    apiGet<{ models: VideoModel[] }>("/api/video-models").then((d) => {
      setModels(d.models);
      // Défaut : Kling image→vidéo (identité verrouillée par la 1re frame).
      const def =
        d.models.find((m) => m.id === "fal-ai/kling-video/v2/master/image-to-video") ??
        d.models.find((m) => m.mode === "image-to-video") ??
        d.models[0];
      if (def) setModelId(def.id);
    });
    const timersSnapshot = timers.current;
    return () => {
      Object.values(timersSnapshot).forEach(clearInterval);
      if (mergeTimer.current) clearInterval(mergeTimer.current);
    };
  }, []);

  // Load the character's SDK assets (for identity-consistent engines like Seedance).
  useEffect(() => {
    if (!characterId) return;
    apiGet<{ assets: AssetGroups }>(withCharacter("/api/assets", characterId))
      .then((d) => {
        setAssets(d.assets ?? {});
        const identity = (d.assets?.identity ?? []).map((a) => a.relPath);
        // Portrait d'abord : bon cadrage "parole" (tête + épaules) pour l'image→vidéo.
        const preferred = ["identity/portrait_front.png", "identity/master_face_v1.png", "identity/full_body_front.png"];
        const preselect = preferred.filter((p) => identity.includes(p));
        setSelectedRefs(preselect.length ? preselect : identity.slice(0, 3));
      })
      .catch(() => setAssets({}));
  }, [characterId]);

  const isReference = model?.mode === "reference-to-video";
  const needsStartImage = model?.mode === "image-to-video";
  const needsImages = isReference || needsStartImage;
  // La frame de départ envoyée à Kling est la 1re image sélectionnée.
  const startFrame = selectedRefs[0];
  const totalAssets = Object.values(assets).reduce((n, list) => n + list.length, 0);

  function assetSrc(relPath: string) {
    return `/api/asset?character=${encodeURIComponent(characterId)}&path=${encodeURIComponent(relPath)}`;
  }

  function toggleRef(relPath: string) {
    // Image→vidéo : une seule frame de départ (sélection unique).
    if (needsStartImage) {
      setSelectedRefs((prev) => (prev[0] === relPath ? [] : [relPath]));
      return;
    }
    setSelectedRefs((prev) => {
      if (prev.includes(relPath)) return prev.filter((x) => x !== relPath);
      if (prev.length >= 9) return prev;
      return [...prev, relPath];
    });
  }

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

  async function makeShotDecor(i: number) {
    const shot = shots[i];
    const loc = (shot.location ?? "").trim();
    if (!loc) return;
    update(i, { sceneBusy: true, sceneError: null });
    try {
      const imageSize = aspect === "16:9" ? "landscape_16_9" : aspect === "1:1" ? "square_hd" : "portrait_16_9";
      const res = await apiPost<{ imageUrl: string }>("/api/generate/scene-image", {
        character: characterId,
        refPath: "identity/portrait_front.png",
        prompt: `Cette personne, dans ${loc}, présente face caméra, ambiance micro-trottoir, lumière naturelle, photoréaliste, cadrage taille.`,
        imageSize,
      });
      update(i, { sceneImageUrl: res.imageUrl, sceneBusy: false });
      refreshBudget();
    } catch (e) {
      update(i, { sceneBusy: false, sceneError: e instanceof Error ? e.message : "Erreur décor" });
    }
  }

  async function generateShot(i: number) {
    const shot = shots[i];
    if (!shot.prompt) return;
    update(i, { status: "Envoi…", videoUrl: null, error: null });
    if (timers.current[i]) clearInterval(timers.current[i]);
    try {
      // Priorité à l'image de décor du plan (si générée) comme frame de départ.
      const shotStart = shot.sceneImageUrl || null;
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/video", {
        model: modelId,
        prompt: shot.prompt,
        seconds: shot.seconds,
        aspectRatio: aspect,
        character: needsImages ? characterId : undefined,
        imageUrl: needsStartImage && shotStart ? shotStart : undefined,
        assetPaths: needsStartImage
          ? shotStart
            ? undefined
            : startFrame
              ? [startFrame]
              : []
          : needsImages
            ? selectedRefs
            : undefined,
      });
      refreshBudget();
      update(i, { status: "En file…", requestId: sub.requestId, model: sub.model });
      timers.current[i] = setInterval(async () => {
        try {
          const r = await apiPost<{ status: string; videoUrl?: string; error?: string }>("/api/generate/status", {
            model: sub.model,
            requestId: sub.requestId,
          });
          update(i, { status: r.status });
          if (r.status === "FAILED") {
            clearInterval(timers.current[i]);
            update(i, { status: null, error: r.error ? `Échec : ${r.error}` : "Échec" });
            return;
          }
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

  const readyClips = shots.filter((s) => s.videoUrl).map((s) => s.videoUrl as string);

  async function assemble() {
    setMergeError(null);
    setMergedUrl(null);
    setMergeStatus("Envoi…");
    if (mergeTimer.current) clearInterval(mergeTimer.current);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/merge", {
        videoUrls: readyClips,
        totalSeconds,
      });
      refreshBudget();
      setMergeStatus("Assemblage…");
      mergeTimer.current = setInterval(async () => {
        try {
          const r = await apiPost<{ status: string; videoUrl?: string; error?: string }>("/api/generate/status", {
            model: sub.model,
            requestId: sub.requestId,
          });
          setMergeStatus(r.status);
          if (r.status === "FAILED") {
            if (mergeTimer.current) clearInterval(mergeTimer.current);
            setMergeError(r.error ? `Échec : ${r.error}` : "Échec de l'assemblage");
            setMergeStatus(null);
            return;
          }
          if (r.status === "COMPLETED") {
            if (mergeTimer.current) clearInterval(mergeTimer.current);
            setMergedUrl(r.videoUrl ?? null);
            setMergeStatus(r.videoUrl ? "Terminé" : "Terminé (pas d'URL)");
          }
        } catch (e) {
          if (mergeTimer.current) clearInterval(mergeTimer.current);
          setMergeError(e instanceof Error ? e.message : "Erreur");
          setMergeStatus(null);
        }
      }, 3000);
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : "Erreur");
      setMergeStatus(null);
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
          <select
            className="select"
            value={modelId}
            onChange={(e) => {
              setModelId(e.target.value);
              const m = models.find((x) => x.id === e.target.value);
              if (m && !m.aspectRatios.includes(aspect)) setAspect(m.aspectRatios[0]);
            }}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label} — {usd(m.usdPerSecond)}/s</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ratio</label>
          <select className="select" value={aspect} onChange={(e) => setAspect(e.target.value)}>
            {(model?.aspectRatios ?? ["9:16", "16:9"]).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={loadPreset}>Charger le modèle micro-trottoir</button>
        <button className="btn btn-ghost" onClick={addShot}>+ Ajouter un plan</button>
      </div>

      {needsImages && (
        <div className="card p-5 mb-6">
          <label className="label">
            {needsStartImage
              ? `Frame de départ — verrouille l'identité sur tous les plans (1 image)`
              : `Références d'identité (appliquées à tous les plans) — ${selectedRefs.length}/9 sélectionnée${selectedRefs.length > 1 ? "s" : ""}`}
          </label>
          {totalAssets === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Aucun asset trouvé sous <code>characters/{characterId}/assets</code>.
            </p>
          ) : (
            <>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {["identity", "expressions", "poses", "outfits"].map((cat) => {
                  const list = assets[cat] ?? [];
                  if (list.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">
                        {CATEGORY_LABELS[cat] ?? cat}
                      </p>
                      <div className="grid grid-cols-6 gap-2">
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
                              <img src={assetSrc(a.relPath)} alt={a.name} className="h-16 w-full object-cover" />
                              {active && (
                                <span className="absolute top-0.5 right-0.5 bg-[var(--accent)] text-white text-[10px] rounded px-1">✓</span>
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
                {needsStartImage
                  ? "Frame de départ par défaut (fond studio) pour les plans sans décor. Pour un vrai décor (rue, café…), renseigne le « Décor du plan » ci-dessous : le personnage y sera placé, identité préservée."
                  : "Ces images verrouillent l'apparence du personnage sur l'ensemble des plans (visage cohérent)."}
              </p>
            </>
          )}
        </div>
      )}

      {model?.audio !== "native" && shots.length > 0 && (
        <div className="card p-4 mb-6">
          <p className="text-sm text-[var(--muted)]">
            🔇 Ce moteur est muet. Après génération, passe chaque plan (ou le montage) dans le <strong>Studio Lip-sync</strong> pour ajouter la voix de {characterName || "ton personnage"}.
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

            {needsStartImage && (
              <div className="mt-3 rounded-lg border border-[var(--border)] p-3 bg-[var(--surface-2)]/30">
                <label className="label mb-1 block">Décor du plan (optionnel) — {characterName || "le perso"} placé dans le lieu, identité préservée</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    value={shot.location ?? ""}
                    onChange={(e) => update(i, { location: e.target.value, sceneImageUrl: null })}
                    placeholder="ex. rue animée, café, studio…"
                  />
                  <button
                    className="btn btn-ghost whitespace-nowrap"
                    disabled={!ready || !(shot.location ?? "").trim() || shot.sceneBusy}
                    onClick={() => makeShotDecor(i)}
                  >
                    {shot.sceneBusy ? "Génération…" : shot.sceneImageUrl ? "Régénérer le décor" : "Générer le décor"}
                  </button>
                </div>
                {shot.sceneError && <p className="text-xs text-[var(--danger)] mt-1">{shot.sceneError}</p>}
                {shot.sceneImageUrl && (
                  <div className="flex items-center gap-3 mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.sceneImageUrl} alt="Décor du plan" className="h-20 rounded-lg border border-[var(--border)]" />
                    <div className="text-xs text-[var(--muted)]">
                      ✓ Décor prêt — sert de 1re frame.
                      <button className="block text-[var(--muted)] hover:text-[var(--danger)] mt-1" onClick={() => update(i, { sceneImageUrl: null })}>
                        retirer (repartir de la frame de départ)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                disabled={
                  !shot.prompt ||
                  !ready ||
                  (!!shot.status && !shot.videoUrl && !shot.error) ||
                  (needsImages && selectedRefs.length === 0 && !shot.sceneImageUrl)
                }
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
          <div className="flex gap-3">
            <button className="btn btn-ghost" disabled={!ready} onClick={generateAll}>
              Générer les plans restants
            </button>
            <button
              className="btn btn-primary"
              disabled={readyClips.length < 2 || (!!mergeStatus && !mergedUrl && !mergeError)}
              onClick={assemble}
              title={readyClips.length < 2 ? "Génère au moins 2 plans d'abord" : ""}
            >
              {mergeStatus && !mergedUrl && !mergeError ? "Assemblage…" : `Assembler ${readyClips.length} plans en 60 s`}
            </button>
          </div>
        </div>
      )}

      {(mergeStatus || mergedUrl || mergeError) && (
        <div className="card p-5 mt-4">
          <div className="label mb-2">Vidéo assemblée</div>
          {mergeError && <p className="text-sm text-[var(--danger)]">{mergeError}</p>}
          {!mergeError && mergeStatus && !mergedUrl && (
            <p className="text-sm text-[var(--muted)] animate-pulse">Statut : {mergeStatus}</p>
          )}
          {mergedUrl && (
            <div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={mergedUrl} controls className="w-full rounded-lg border border-[var(--border)]" />
              <a href={mergedUrl} target="_blank" rel="noreferrer" className="btn btn-primary mt-3 w-full">
                Ouvrir / Télécharger la vidéo finale
              </a>
            </div>
          )}
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

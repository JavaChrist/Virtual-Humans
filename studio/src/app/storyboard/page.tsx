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

interface Outfit {
  id: string;
  name: string;
  description?: string;
  clothing?: Record<string, string>;
  thumbPath: string;
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

// Traductions FR pour les expressions (sinon on retombe sur le nom brut du fichier).
const EXPRESSION_FR: Record<string, string> = {
  neutral: "neutre",
  smile: "souriante",
  big_smile: "grand sourire chaleureux",
  serious: "sérieuse",
  surprised: "surprise",
  thinking: "pensive",
  laugh: "rieuse",
  wink: "clin d'œil complice",
  excited: "enthousiaste",
  confused: "perplexe",
  sad: "triste",
};

// IMAGE→VIDÉO : les prompts NE décrivent PAS l'apparence/le genre du personnage
// (déjà présent sur l'image de départ) — sinon le modèle "morphe" et change le
// visage/la tenue. On décrit uniquement l'ACTION + on force la cohérence.
const CONSISTENCY = "Exactement la même personne et la même tenue que sur l'image, identité inchangée, une seule personne, aucun changement de vêtements.";
const MICRO_TROTTOIR: Omit<Shot, "status">[] = [
  { title: "1. Hook caméra", prompt: `Parle face caméra avec un sourire énergique, léger geste de la main. ${CONSISTENCY}`, seconds: 5 },
  { title: "2. Question passant #1", prompt: `Tend un micro comme en micro-trottoir, attitude enthousiaste, regard caméra. ${CONSISTENCY}`, seconds: 5 },
  { title: "3. Question passant #2", prompt: `Interpelle quelqu'un, hoche la tête, écoute attentivement, micro en main. ${CONSISTENCY}`, seconds: 5 },
  { title: "4. Réaction / B-roll", prompt: "Plan d'illustration : une main tient un smartphone montrant une interface d'application épurée, arrière-plan flou. Aucun visage.", seconds: 5 },
  { title: "5. Démo de l'app", prompt: `Montre l'écran du téléphone face caméra, désigne l'application du doigt, expression convaincue. ${CONSISTENCY}`, seconds: 10 },
  { title: "6. Punchline", prompt: `Sourire complice, clin d'œil, léger mouvement de tête. ${CONSISTENCY}`, seconds: 5 },
  { title: "7. CTA", prompt: `Pouce levé, énergie positive, regard caméra. ${CONSISTENCY}`, seconds: 5 },
];

function expressionLabel(a: AssetItem): string {
  const key = a.relPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? a.name;
  return EXPRESSION_FR[key] ?? key.replace(/_/g, " ");
}

export default function Storyboard() {
  const { characterId, characterName } = useCharacter();
  const [ready, setReady] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [aspect, setAspect] = useState("9:16");

  // Assets du personnage (identité + expressions) et tenues (avec description).
  const [assets, setAssets] = useState<AssetGroups>({});
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  // --- Configuration personnage GLOBALE (définie une fois, appliquée partout) ---
  const [identityRef, setIdentityRef] = useState("");
  const [expressionRef, setExpressionRef] = useState(""); // vide = aucune
  const [outfitId, setOutfitId] = useState("");
  const [decor, setDecor] = useState("rue animée");
  const [masterUrl, setMasterUrl] = useState<string | null>(null);
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  const [shots, setShots] = useState<Shot[]>([]);
  const timers = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const mergeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const model = models.find((m) => m.id === modelId);
  const identityList = assets.identity ?? [];
  const expressionList = assets.expressions ?? [];
  const outfit = outfits.find((o) => o.id === outfitId);
  const needsStartImage = model?.mode === "image-to-video";

  useEffect(() => {
    apiGet<SettingsResponse>("/api/settings").then((s) => setReady(s.keys.fal)).catch(() => {});
    apiGet<{ models: VideoModel[] }>("/api/video-models").then((d) => {
      setModels(d.models);
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

  useEffect(() => {
    if (!characterId) return;
    setMasterUrl(null);
    apiGet<{ assets: AssetGroups }>(withCharacter("/api/assets", characterId))
      .then((d) => {
        setAssets(d.assets ?? {});
        const identity = (d.assets?.identity ?? []).map((a) => a.relPath);
        const preferred = ["identity/portrait_front.png", "identity/master_face_v1.png", "identity/full_body_front.png"];
        setIdentityRef(preferred.find((p) => identity.includes(p)) ?? identity[0] ?? "");
      })
      .catch(() => setAssets({}));
    apiGet<{ outfits: Outfit[] }>(withCharacter("/api/outfits", characterId))
      .then((d) => {
        setOutfits(d.outfits ?? []);
        setOutfitId(d.outfits?.[0]?.id ?? "");
      })
      .catch(() => setOutfits([]));
  }, [characterId]);

  function assetSrc(relPath: string) {
    return `/api/asset?character=${encodeURIComponent(characterId)}&path=${encodeURIComponent(relPath)}`;
  }

  // Changer un paramètre du personnage invalide l'image de référence : il faut la régénérer.
  function resetMaster() {
    setMasterUrl(null);
  }

  async function makeMaster() {
    if (!identityRef) return;
    setMasterBusy(true);
    setMasterError(null);
    try {
      const imageSize = aspect === "16:9" ? "landscape_16_9" : aspect === "1:1" ? "square_hd" : "portrait_16_9";
      const clothing = outfit?.clothing ? Object.values(outfit.clothing).join(", ") : outfit?.description ?? "";
      const expr = expressionRef ? expressionList.find((e) => e.relPath === expressionRef) : undefined;
      const parts = [
        "Cette personne",
        clothing ? `portant ${clothing}` : "",
        expr ? `expression ${expressionLabel(expr)}` : "",
        decor.trim() ? `dans ${decor.trim()}` : "en studio épuré",
        "présente face caméra, plan taille (visage et buste bien cadrés, centrés), lumière naturelle, photoréaliste, une seule personne, identité et tenue inchangées",
      ].filter(Boolean);
      const res = await apiPost<{ imageUrl: string }>("/api/generate/scene-image", {
        character: characterId,
        refPath: identityRef,
        prompt: parts.join(", ") + ".",
        imageSize,
      });
      setMasterUrl(res.imageUrl);
      refreshBudget();
    } catch (e) {
      setMasterError(e instanceof Error ? e.message : "Échec de génération du personnage de référence");
    } finally {
      setMasterBusy(false);
    }
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
  // Frame de départ commune : l'image de référence générée, sinon l'image d'identité brute.
  const startFrame = masterUrl ? null : identityRef || null;

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
        character: needsStartImage ? characterId : undefined,
        imageUrl: needsStartImage && masterUrl ? masterUrl : undefined,
        assetPaths: needsStartImage && !masterUrl && startFrame ? [startFrame] : undefined,
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

  // Un plan est prêt à générer si identité verrouillée (frame de référence OU image d'identité).
  const identityReady = !needsStartImage || Boolean(masterUrl || startFrame);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Storyboard 60 s"
        subtitle="Définis le personnage une fois, découpe ta vidéo en plans, génère-les, puis assemble automatiquement"
      />

      {!ready && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">Clé <code>FAL_KEY</code> manquante (voir Réglages).</p>
        </div>
      )}

      {/* 1) Réglages communs à tous les plans */}
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
          <select
            className="select"
            value={aspect}
            onChange={(e) => {
              setAspect(e.target.value);
              resetMaster();
            }}
          >
            {(model?.aspectRatios ?? ["9:16", "16:9"]).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={loadPreset}>Charger le modèle micro-trottoir</button>
        <button className="btn btn-ghost" onClick={addShot}>+ Ajouter un plan</button>
      </div>

      {/* 2) Personnage de référence — défini UNE fois, appliqué à TOUS les plans */}
      {needsStartImage && (
        <div className="card p-5 mb-6">
          <div className="label mb-1">Personnage de référence (verrouillé sur tous les plans)</div>
          <p className="text-xs text-[var(--muted)] mb-4">
            Choisis l&apos;identité, l&apos;expression, la tenue et le décor <strong>une seule fois</strong>, puis génère l&apos;image
            de référence. Tous les plans partent de cette même image : {characterName || "le personnage"} garde exactement le
            même visage et la même tenue.
          </p>

          {identityList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Aucun asset sous <code>characters/{characterId}/assets</code>.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Colonne gauche : les choix */}
              <div className="space-y-4">
                <div>
                  <label className="label">Identité (visage &amp; corps)</label>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {identityList.map((a) => {
                      const active = identityRef === a.relPath;
                      return (
                        <button
                          key={a.relPath}
                          type="button"
                          onClick={() => { setIdentityRef(a.relPath); resetMaster(); }}
                          className={`relative rounded-lg overflow-hidden border-2 ${active ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                          title={a.name}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={assetSrc(a.relPath)} alt={a.name} className="h-24 w-full object-contain bg-[var(--surface-2)]" />
                          {active && <span className="absolute top-0.5 right-0.5 bg-[var(--accent)] text-white text-[10px] rounded px-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {expressionList.length > 0 && (
                  <div>
                    <label className="label">Expression (optionnelle)</label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      <button
                        type="button"
                        onClick={() => { setExpressionRef(""); resetMaster(); }}
                        className={`rounded-lg border-2 h-16 text-xs ${expressionRef === "" ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                      >
                        aucune
                      </button>
                      {expressionList.map((a) => {
                        const active = expressionRef === a.relPath;
                        return (
                          <button
                            key={a.relPath}
                            type="button"
                            onClick={() => { setExpressionRef(a.relPath); resetMaster(); }}
                            className={`relative rounded-lg overflow-hidden border-2 ${active ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                            title={expressionLabel(a)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={assetSrc(a.relPath)} alt={a.name} className="h-16 w-full object-contain bg-[var(--surface-2)]" />
                            {active && <span className="absolute top-0.5 right-0.5 bg-[var(--accent)] text-white text-[10px] rounded px-1">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Tenue</label>
                    <select
                      className="select"
                      value={outfitId}
                      onChange={(e) => { setOutfitId(e.target.value); resetMaster(); }}
                    >
                      {outfits.length === 0 && <option value="">—</option>}
                      {outfits.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Décor (commun à tous les plans)</label>
                    <input
                      className="input"
                      list="decor-presets"
                      value={decor}
                      onChange={(e) => { setDecor(e.target.value); resetMaster(); }}
                      placeholder="ex. rue animée, café, studio…"
                    />
                    <datalist id="decor-presets">
                      {["rue animée", "studio épuré", "café branché", "bureau moderne", "parc urbain", "centre commercial"].map((l) => (
                        <option key={l} value={l} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <button className="btn btn-primary" disabled={!ready || !identityRef || masterBusy} onClick={makeMaster}>
                  {masterBusy ? "Génération…" : masterUrl ? "Régénérer le personnage de référence" : "Générer le personnage de référence"}
                </button>
                {masterError && <p className="text-sm text-[var(--danger)]">{masterError}</p>}
              </div>

              {/* Colonne droite : aperçu de la frame de référence */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/30 p-3 flex flex-col items-center justify-center min-h-[220px]">
                {masterUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={masterUrl} alt="Personnage de référence" className="max-h-80 w-auto rounded-lg border border-[var(--border)]" />
                    <p className="text-xs text-[var(--success)] mt-2">✓ Cette image sert de 1re frame à tous les plans.</p>
                  </>
                ) : (
                  <div className="text-center text-sm text-[var(--muted)] px-4">
                    {masterBusy
                      ? "Génération de l'image de référence…"
                      : "Aperçu de la frame de référence.\nRègle l'identité, l'expression, la tenue et le décor, puis clique sur « Générer le personnage de référence »."}
                    {!masterBusy && identityRef && (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={assetSrc(identityRef)} alt="identité" className="max-h-40 w-auto mx-auto rounded-lg border border-[var(--border)] opacity-70" />
                        <p className="text-[11px] mt-1">Sans image de référence, les plans partiront directement de cette photo d&apos;identité.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
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

      {/* 3) Les plans : uniquement l'action + la durée */}
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
              placeholder="Décris l'action de ce plan (le personnage et la tenue restent ceux de l'image de référence)…"
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
                disabled={!shot.prompt || !ready || !identityReady || (!!shot.status && !shot.videoUrl && !shot.error)}
                onClick={() => generateShot(i)}
                title={!identityReady ? "Génère d'abord le personnage de référence" : ""}
              >
                Générer ce plan
              </button>
            </div>
            {shot.videoUrl && (
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
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-ghost" disabled={!ready || !identityReady} onClick={generateAll}>
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
        </div>
      )}
    </div>
  );
}

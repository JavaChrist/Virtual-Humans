"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { setLastVideo, setLastVoice } from "@/lib/media-store";
import { usePersistentState } from "@/lib/use-persistent-state";
import { PageHeader } from "@/components/page-header";
import { useConfirm } from "@/components/confirm";
import { LOCATION_PRESETS } from "@/lib/location-presets";
import type { CharacterResponse } from "@/lib/types";

interface SavedScene {
  id: string;
  name: string;
  characterId: string;
  config: Record<string, unknown>;
  createdAt: number;
}

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

interface Outfit {
  id: string;
  name: string;
  description?: string;
  clothing?: Record<string, string>;
  locations?: string[];
  lookPath: string;
  thumbPath: string;
}

interface Product {
  id: string;
  name: string;
  pitch?: string;
  screens: string[];
}

/** 3 parcours fiables — ordre demandé : plein pied → (micro-trottoir = Storyboard) → talking-head. */
type SceneFormat = "plein-pied" | "talking-head";

const FORMAT_META: Record<
  SceneFormat,
  { label: string; blurb: string; decorRequired: boolean }
> = {
  "plein-pied": {
    label: "1. Présentation plein pied",
    blurb: "Une seule personne en pied dans un décor, présente ton app. Décor obligatoire (évite les clones).",
    decorRequired: true,
  },
  "talking-head": {
    label: "3. Gros plan qui parle",
    blurb: "Visage / buste face caméra — idéal pour la voix + lip-sync. Le micro-trottoir (2) est dans le Storyboard.",
    decorRequired: false,
  },
};

export default function SceneStudio() {
  const { characterId, characterName } = useCharacter();
  const name = characterName || "Mei";

  const [models, setModels] = useState<VideoModel[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [behaviors, setBehaviors] = useState<{ id: string; name: string }[]>([]);
  const [ready, setReady] = useState(false);

  // Brouillon auto (persistant par personnage) pour ne rien perdre en changeant de page.
  const dkey = (field: string) => (characterId ? `vh:draft:scene:${characterId}:${field}` : null);
  const [format, setFormat] = usePersistentState<SceneFormat>(dkey("format"), "plein-pied");
  const [outfitId, setOutfitId] = useState("");
  const [location, setLocation] = usePersistentState(dkey("location"), "rue animée");
  const [tone, setTone] = useState("");
  const [productId, setProductId] = useState("");
  const [pitch, setPitch] = usePersistentState(dkey("pitch"), "");
  const [script, setScript] = usePersistentState(dkey("script"), "");
  const [seconds, setSeconds] = useState(5);
  const [aspect] = useState("9:16");

  const [estimate, setEstimate] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bibliothèque de scènes enregistrées (Supabase).
  const confirm = useConfirm();
  const [scenes, setScenes] = useState<SavedScene[]>([]);
  const [sceneName, setSceneName] = useState("");
  const [sceneMsg, setSceneMsg] = useState<string | null>(null);

  // Décor : image fixe du perso placé dans un lieu (identité préservée, PuLID),
  // utilisée ensuite comme frame de départ pour l'animation.
  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
  const [sceneImgBusy, setSceneImgBusy] = useState(false);

  // Kling image→vidéo : identité verrouillée par la 1re frame (photo du perso).
  // Seedance (reference/image-to-video) est refusé par la modération FAL sur les
  // visages humains ("likenesses of real people") — vérifié en réel.
  const model = useMemo(
    () =>
      models.find((m) => m.id === "fal-ai/kling-video/v2/master/image-to-video") ??
      models.find((m) => m.mode === "image-to-video") ??
      models[0],
    [models],
  );
  const outfit = outfits.find((o) => o.id === outfitId);
  const product = products.find((p) => p.id === productId);

  useEffect(() => {
    apiGet<{ models: VideoModel[] }>("/api/video-models").then((d) => setModels(d.models)).catch(() => {});
    apiGet<{ products: Product[] }>("/api/products").then((d) => setProducts(d.products)).catch(() => {});
    apiGet<{ keys: { fal: boolean } }>("/api/settings").then((s) => setReady(s.keys.fal)).catch(() => {});
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, []);

  useEffect(() => {
    if (!characterId) return;
    apiGet<{ scenes: SavedScene[] }>(`/api/scenes?character=${encodeURIComponent(characterId)}`)
      .then((d) => setScenes(d.scenes ?? []))
      .catch(() => setScenes([]));
  }, [characterId]);

  async function saveCurrentScene() {
    const nm = sceneName.trim();
    if (!nm || !characterId) return;
    try {
      const res = await apiPost<{ scene: SavedScene }>("/api/scenes", {
        name: nm,
        character: characterId,
        config: { outfitId, location, tone, productId, pitch, script, seconds, format },
      });
      setScenes((prev) => [res.scene, ...prev]);
      setSceneName("");
      setSceneMsg("Scène enregistrée ✓");
      setTimeout(() => setSceneMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    }
  }

  function loadScene(s: SavedScene) {
    const c = s.config ?? {};
    if (c.format === "plein-pied" || c.format === "talking-head") setFormat(c.format);
    if (typeof c.outfitId === "string") setOutfitId(c.outfitId);
    if (typeof c.location === "string") setLocation(c.location);
    if (typeof c.tone === "string") setTone(c.tone);
    if (typeof c.productId === "string") setProductId(c.productId);
    if (typeof c.pitch === "string") setPitch(c.pitch);
    if (typeof c.script === "string") setScript(c.script);
    if (typeof c.seconds === "number") setSeconds(c.seconds);
  }

  async function removeScene(s: SavedScene) {
    const ok = await confirm({
      title: "Supprimer la scène",
      message: `Supprimer « ${s.name} » ? Cette action est définitive.`,
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await fetch(`/api/scenes?id=${encodeURIComponent(s.id)}`, { method: "DELETE" });
      setScenes((prev) => prev.filter((x) => x.id !== s.id));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!characterId) return;
    apiGet<{ outfits: Outfit[] }>(withCharacter("/api/outfits", characterId))
      .then((d) => {
        setOutfits(d.outfits);
        if (d.outfits[0]) setOutfitId(d.outfits[0].id);
      })
      .catch(() => setOutfits([]));
    apiGet<CharacterResponse>(withCharacter("/api/character", characterId))
      .then((c) => {
        setBehaviors(c.behaviors);
        if (c.behaviors[0]) setTone(c.behaviors[0].name);
      })
      .catch(() => {});
  }, [characterId]);

  useEffect(() => {
    if (!model) return;
    apiPost<{ usd: number }>("/api/estimate", { type: "video", model: model.id, seconds })
      .then((d) => setEstimate(d.usd))
      .catch(() => setEstimate(null));
  }, [model, seconds]);

  // IMAGE→VIDÉO : le prompt ne doit PAS re-décrire l'apparence/la tenue (elle est
  // déjà sur l'image de départ) sous peine de morphing. On force la cohérence +
  // un mouvement subtil. (Le décor vient de l'image ; le champ "lieu" n'agit pas
  // ici — il reste utile pour le script et les évolutions futures.)
  const prompt = useMemo(() => {
    const appName = product?.name ?? "l'application";
    const appPitch = pitch || product?.pitch || "";
    const antiClone =
      "UNE SEULE personne dans le cadre. Pas de deuxième personne, pas de clone, pas de jumeau. Arrière-plan stable, aucun changement de vêtements, aucun texte ni logo.";
    const identity = `Exactement la même personne et la même identité que sur l'image, sans aucune variation.`;
    if (format === "talking-head") {
      return [
        `${name} parle face caméra, cadrage buste (visage et épaules bien visibles).`,
        identity,
        tone ? `Ton ${tone.toLowerCase()}.` : "",
        appPitch ? `Elle présente ${appName} : ${appPitch}.` : `Elle présente ${appName}.`,
        `Mouvement subtil : elle parle, cligne des yeux, légers mouvements de tête, lumière stable.`,
        antiClone,
      ]
        .filter(Boolean)
        .join(" ");
    }
    // Parcours 1 — plein pied + décor
    return [
      `${name}, présentatrice en pied dans ${location}, présente ${appName} face caméra.`,
      identity,
      tone ? `Ton ${tone.toLowerCase()}.` : "",
      appPitch ? `Message : ${appPitch}.` : "",
      `Mouvement subtil et naturel : elle parle, léger geste, tient un smartphone, regard caméra, lumière stable.`,
      antiClone,
    ]
      .filter(Boolean)
      .join(" ");
  }, [name, product, pitch, tone, location, format]);

  // Frame de secours (si pas de décor) : portrait pour talking-head, tenue pour plein pied.
  const assetPaths = useMemo(() => {
    if (format === "talking-head") return ["identity/portrait_front.png"];
    return outfit ? [outfit.lookPath] : ["identity/portrait_front.png"];
  }, [outfit, format]);

  const safeFormat: SceneFormat = format === "talking-head" ? "talking-head" : "plein-pied";
  const formatMeta = FORMAT_META[safeFormat];
  const canGenerate =
    !!outfit &&
    !!ready &&
    !(formatMeta.decorRequired && !sceneImageUrl);

  // Ajuste la durée aux valeurs acceptées par le modèle courant.
  useEffect(() => {
    if (model && !model.seconds.includes(seconds)) setSeconds(model.defaultSeconds);
  }, [model, seconds]);

  // Prompt décor (EN) : Flux/PuLID suit beaucoup mieux l'anglais + le LIEU en tête.
  // On décrit la tenue dans le texte (réf = portrait visage, pas la photo studio blanche).
  const clothingHint = outfit?.clothing
    ? Object.values(outfit.clothing).filter(Boolean).join(", ")
    : outfit?.name ?? "";
  const [decorPrompt, setDecorPrompt] = useState("");
  useEffect(() => {
    if (format === "talking-head") {
      setDecorPrompt(
        `Photorealistic medium close-up of the EXACT same person as the reference (same face, gender, age, ethnicity), looking at camera in ${location}. Soft natural light, background of ${location} visible. Single person only. Do not invent a different person.`,
      );
    } else {
      const wear = clothingHint ? ` Wearing ${clothingHint}.` : "";
      setDecorPrompt(
        `Photorealistic medium shot of the EXACT same person as the reference (same face, gender, age, ethnicity).${wear} Standing in ${location}; the environment fills the background (NOT a white studio). Holds a smartphone, presents to camera, natural daylight. Only ONE person. Do not invent a different person.`,
      );
    }
    setSceneImageUrl(null);
  }, [location, format, clothingHint]);

  async function makeSceneImage() {
    if (!decorPrompt.trim()) return;
    setSceneImgBusy(true);
    setError(null);
    try {
      const imageSize = aspect === "16:9" ? "landscape_16_9" : aspect === "1:1" ? "square_hd" : "portrait_16_9";
      // Toujours le portrait visage en réf PuLID (pas la photo de tenue fond blanc),
      // sinon le modèle recolle le studio blanc. La tenue est dans le prompt.
      const res = await apiPost<{ imageUrl: string }>("/api/generate/scene-image", {
        character: characterId,
        refPath: "identity/portrait_front.png",
        prompt: decorPrompt,
        imageSize,
      });
      setSceneImageUrl(res.imageUrl);
      refreshBudget();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur image décor");
    } finally {
      setSceneImgBusy(false);
    }
  }

  async function makeVoice() {
    if (!script.trim()) return;
    setVoiceBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ dataUrl: string }>("/api/generate/voice", { text: script, character: characterId });
      setAudioUrl(res.dataUrl);
      // Mémorise script + voix pour les réutiliser directement dans le Studio Lip-sync.
      setLastVoice(characterId, script, res.dataUrl);
      refreshBudget();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur voix");
    } finally {
      setVoiceBusy(false);
    }
  }

  async function generate() {
    if (!model) return;
    if (formatMeta.decorRequired && !sceneImageUrl) {
      setError("Parcours plein pied : génère d'abord l'image de décor (une seule personne en pied dans le lieu).");
      return;
    }
    setError(null);
    setVideoUrl(null);
    setStatus("Envoi…");
    if (polling.current) clearInterval(polling.current);
    try {
      // Si une image de décor a été générée, elle sert de frame de départ
      // (priorité côté route) ; sinon on retombe sur la photo de tenue SDK.
      const useImages = model.mode === "reference-to-video" || model.mode === "image-to-video";
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/video", {
        model: model.id,
        prompt,
        seconds,
        aspectRatio: aspect,
        character: characterId,
        imageUrl: useImages && sceneImageUrl ? sceneImageUrl : undefined,
        assetPaths: useImages && !sceneImageUrl ? assetPaths : undefined,
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
            setVideoUrl(r.videoUrl ?? null);
            setStatus(r.videoUrl ? "Terminé" : "Terminé (pas d'URL)");
            if (r.videoUrl) setLastVideo(characterId, r.videoUrl, seconds);
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

  // Compteur de temps écoulé pour rassurer (Kling ≈ 3–4 min pour 5 s).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Studio Scène"
        subtitle={`${name} présente ton app. Choisis un parcours fiable, génère le plan, puis ajoute la voix via Lip-sync. Le micro-trottoir (présentateur + passant) est dans le Storyboard.`}
      />

      {!ready && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">Clé <code>FAL_KEY</code> manquante (voir Réglages).</p>
        </div>
      )}

      {/* Choix du parcours */}
      <div className="card p-5 mb-6 space-y-3">
        <div className="label">Parcours</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(FORMAT_META) as SceneFormat[]).map((id) => {
            const m = FORMAT_META[id];
            const active = format === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFormat(id)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--border)] hover:border-[var(--muted)]"
                }`}
              >
                <div className="font-semibold text-sm">{m.label}</div>
                <p className="text-xs text-[var(--muted)] mt-1">{m.blurb}</p>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)]">
          <Link href="/storyboard" className="text-[var(--accent)] underline">
            2. Micro-trottoir (présentateur + passant)
          </Link>{" "}
          — champ / contre-champ dans le Storyboard (style « Micro-trottoir »).
        </p>
      </div>

      {/* Bibliothèque de scènes enregistrées (enregistrer / charger / supprimer) */}
      <div className="card p-5 mb-6">
        <div className="label mb-2">Scènes enregistrées</div>
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Nom de la scène</label>
            <input
              className="input"
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              placeholder={`ex. Promo ${product?.name ?? "app"} — ${location}`}
            />
          </div>
          <button className="btn btn-primary" disabled={!sceneName.trim() || !characterId} onClick={saveCurrentScene}>
            Enregistrer la scène actuelle
          </button>
          {sceneMsg && <span className="text-sm text-[var(--success)]">{sceneMsg}</span>}
        </div>
        {scenes.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">
            Aucune scène enregistrée pour {name}. Renseigne les champs ci-dessous puis « Enregistrer ».
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {scenes.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                <button
                  className="text-left text-sm hover:text-[var(--accent)] flex-1 truncate"
                  onClick={() => loadScene(s)}
                  title="Charger cette scène dans les champs"
                >
                  {s.name}
                </button>
                <button
                  className="text-xs text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                  onClick={() => removeScene(s)}
                >
                  supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <div>
            <label className="label">Tenue (SDK)</label>
            <select className="select" value={outfitId} onChange={(e) => setOutfitId(e.target.value)}>
              {outfits.map((o) => (
                <option key={o.id} value={o.id}>{o.id} — {o.name}</option>
              ))}
            </select>
            {outfit && (
              <div className="flex gap-3 mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/asset?character=${encodeURIComponent(characterId)}&path=${encodeURIComponent(outfit.thumbPath)}`}
                  alt={outfit.name}
                  className="h-20 w-20 object-cover rounded-lg border border-[var(--border)]"
                />
                <p className="text-xs text-[var(--muted)] flex-1">
                  {outfit.clothing ? Object.values(outfit.clothing).join(" · ") : outfit.description}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Lieu (texte)</label>
              <input
                className="input"
                list="loc-presets"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex. rue animée, front de mer, rooftop, parc…"
              />
              <datalist id="loc-presets">
                {[...LOCATION_PRESETS, ...(outfit?.locations ?? [])].map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Ce n&apos;est qu&apos;un texte : il alimente le prompt ci-dessous. Le fond réel se crée avec le bouton « Générer l&apos;image de décor ».
              </p>
            </div>
            <div>
              <label className="label">Ton / personnalité</label>
              <select className="select" value={tone} onChange={(e) => setTone(e.target.value)}>
                {behaviors.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Application à présenter</label>
              <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— aucune —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Durée (s)</label>
              <select className="select" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
                {(model?.seconds ?? [4, 6, 8, 10]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Kling génère 10 s max par clip. Pour 15–60 s, passe par le Storyboard (plusieurs plans assemblés).
              </p>
            </div>
          </div>

          <div>
            <label className="label">Argumentaire de la scène</label>
            <input className="input" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={product?.pitch || `Ce que ${name} doit mettre en avant…`} />
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <label className="label">
              {format === "talking-head"
                ? `Image de décor (optionnel) — buste de ${name} dans « ${location} »`
                : `Image de décor — obligatoire : ${name} EN PIED dans « ${location} »`}
            </label>
            <p className="text-xs text-[var(--muted)] mb-2">
              Étape qui crée vraiment le fond. Sans ce bouton, la vidéo part d&apos;une photo studio (fond blanc).
            </p>
            <textarea className="input min-h-[60px]" value={decorPrompt} onChange={(e) => setDecorPrompt(e.target.value)} />
            <div className="flex items-center gap-3 mt-2">
              <button className="btn btn-primary" disabled={!decorPrompt.trim() || sceneImgBusy || !ready} onClick={makeSceneImage}>
                {sceneImgBusy ? "Génération de l'image…" : sceneImageUrl ? "Régénérer l'image de décor" : "1) Générer l'image de décor"}
              </button>
              {sceneImageUrl && (
                <>
                  <span className="badge text-[var(--success)]">✓ décor prêt</span>
                  {!formatMeta.decorRequired && (
                    <button className="btn btn-ghost text-xs" onClick={() => setSceneImageUrl(null)}>
                      utiliser le portrait SDK
                    </button>
                  )}
                </>
              )}
            </div>
            {sceneImageUrl && (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sceneImageUrl} alt="Décor généré" className="max-h-64 rounded-lg border border-[var(--border)]" />
                <p className="text-xs text-[var(--muted)] mt-1">Cette image sert de 1re frame : {name} sera animé dans ce décor.</p>
              </div>
            )}
            <p className="text-xs text-[var(--muted)] mt-2">
              {format === "talking-head"
                ? `Sans décor, on part du portrait SDK (visage assez grand pour le lip-sync).`
                : `Étape obligatoire (~2 min) : l'aperçu doit montrer ${name} DANS le lieu (pas un fond blanc). Si fond blanc → Régénérer le décor avant d'animer.`}
            </p>
          </div>

          {products.length === 0 && (
            <p className="text-xs text-[var(--muted)]">
              Aucune app enregistrée. Ajoute tes captures dans{" "}
              <Link href="/products" className="text-[var(--accent)] underline">Produits / Apps</Link>.
            </p>
          )}

          <div>
            <label className="label">Prompt généré (modifiable via les champs)</label>
            <textarea className="textarea" rows={4} readOnly value={prompt} />
          </div>

          <div>
            <label className="label">Script (voix de {name})</label>
            <textarea className="input min-h-[70px]" value={script} onChange={(e) => setScript(e.target.value)} placeholder="Ce que Mei dit à voix haute…" />
            <div className="flex items-center gap-3 mt-2">
              <button className="btn btn-ghost" disabled={!script.trim() || voiceBusy} onClick={makeVoice}>
                {voiceBusy ? "Génération…" : "Générer la voix"}
              </button>
              {audioUrl && (
                <>
                  <span className="badge text-[var(--success)]">✓ voix prête</span>
                  <audio src={audioUrl} controls className="h-8" />
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <div className="text-sm text-[var(--muted)]">
              Coût estimé : <span className="text-[var(--foreground)] font-semibold">{usd(estimate)}</span>
            </div>
            <button
              className="btn btn-primary"
              disabled={busy || !canGenerate}
              onClick={generate}
              title={
                formatMeta.decorRequired && !sceneImageUrl
                  ? "Génère d'abord l'image de décor"
                  : !outfit
                    ? "Choisis une tenue"
                    : ""
              }
            >
              {busy
                ? "En cours…"
                : formatMeta.decorRequired
                  ? "2) Animer le plan"
                  : "Générer le plan"}
            </button>
          </div>
        </div>

        <div className="card p-6 flex flex-col min-h-[420px]">
          {error && <p className="text-sm text-[var(--danger)] text-center">{error}</p>}
          {!error && status && !videoUrl && (
            <div className="text-center m-auto">
              <p className="text-sm text-[var(--muted)] animate-pulse">
                Statut : {status} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
              </p>
              <p className="text-xs text-[var(--muted)] mt-2">
                Kling génère ~3–4 min pour 5 s. C&apos;est normal, ne ferme pas l&apos;onglet.
              </p>
            </div>
          )}
          {!error && !status && !videoUrl && (
            <p className="text-sm text-[var(--muted)] m-auto">Le plan de présentation apparaîtra ici.</p>
          )}
          {videoUrl && (
            <div className="w-full">
              <video src={videoUrl} controls className="w-full rounded-xl border border-[var(--border)]" />
              <div className="flex gap-3 mt-4">
                <Link href="/lipsync" className="btn btn-primary flex-1">Ajouter la voix (Lip-sync) →</Link>
                <Link href="/storyboard" className="btn btn-ghost flex-1">Monter en 60 s →</Link>
              </div>
            </div>
          )}

          {product && product.screens.length > 0 && (
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <div className="label mb-2">Captures de {product.name} (pour l&apos;insert téléphone à venir)</div>
              <div className="grid grid-cols-5 gap-2">
                {product.screens.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={s}
                    src={`/api/product-screen?product=${encodeURIComponent(product.id)}&name=${encodeURIComponent(s)}`}
                    alt={s}
                    className="h-24 w-full object-cover rounded-lg border border-[var(--border)]"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

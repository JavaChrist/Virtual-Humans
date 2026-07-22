"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, refreshBudget, usd, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { setLastVideo } from "@/lib/media-store";
import { PageHeader } from "@/components/page-header";
import type { CharacterResponse } from "@/lib/types";

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

const LOCATION_PRESETS = ["rue animée", "studio épuré", "café branché", "bureau moderne", "parc urbain", "centre commercial"];

export default function SceneStudio() {
  const { characterId, characterName } = useCharacter();
  const name = characterName || "Mei";

  const [models, setModels] = useState<VideoModel[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [behaviors, setBehaviors] = useState<{ id: string; name: string }[]>([]);
  const [ready, setReady] = useState(false);

  const [outfitId, setOutfitId] = useState("");
  const [location, setLocation] = useState("rue animée");
  const [tone, setTone] = useState("");
  const [productId, setProductId] = useState("");
  const [pitch, setPitch] = useState("");
  const [script, setScript] = useState("");
  const [seconds, setSeconds] = useState(8);
  const [aspect, setAspect] = useState("9:16");

  const [estimate, setEstimate] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  // Seedance = identity + outfit consistency.
  const model = useMemo(() => models.find((m) => m.mode === "reference-to-video") ?? models[0], [models]);
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

  const prompt = useMemo(() => {
    const clothing = outfit?.clothing
      ? Object.values(outfit.clothing).join(", ")
      : outfit?.name ?? "";
    const appName = product?.name ?? "l'application";
    const appPitch = pitch || product?.pitch || "";
    return [
      `${name}, influenceuse tech, porte ${clothing}, dans ${location}.`,
      `Elle présente ${appName} face caméra${tone ? `, ton ${tone.toLowerCase()}` : ""}.`,
      appPitch ? `Message : ${appPitch}` : "",
      `Elle tient un smartphone dernier modèle, geste naturel, regard caméra, lumière naturelle.`,
      `Aucun texte ni logo incrusté dans l'image.`,
    ]
      .filter(Boolean)
      .join(" ");
  }, [name, outfit, product, pitch, location, tone]);

  const assetPaths = useMemo(() => {
    const refs = ["identity/master_face_v1.png", "identity/portrait_front.png"];
    if (outfit) refs.push(outfit.lookPath);
    return refs;
  }, [outfit]);

  async function makeVoice() {
    if (!script.trim()) return;
    setVoiceBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ dataUrl: string }>("/api/generate/voice", { text: script, character: characterId });
      setAudioUrl(res.dataUrl);
      refreshBudget();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur voix");
    } finally {
      setVoiceBusy(false);
    }
  }

  async function generate() {
    if (!model) return;
    setError(null);
    setVideoUrl(null);
    setStatus("Envoi…");
    if (polling.current) clearInterval(polling.current);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/video", {
        model: model.id,
        prompt,
        seconds,
        aspectRatio: aspect,
        character: characterId,
        assetPaths: model.mode === "reference-to-video" ? assetPaths : undefined,
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

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Studio Scène"
        subtitle={`Compose une scène pub : ${name} présente ton app (tenue + lieu + ton + script), identité verrouillée`}
      />

      {!ready && (
        <div className="card p-4 mb-6 border-[var(--danger)]">
          <p className="text-sm text-[var(--danger)]">Clé <code>FAL_KEY</code> manquante (voir Réglages).</p>
        </div>
      )}

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lieu / décor</label>
              <input className="input" list="loc-presets" value={location} onChange={(e) => setLocation(e.target.value)} />
              <datalist id="loc-presets">
                {[...LOCATION_PRESETS, ...(outfit?.locations ?? [])].map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
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

          <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>

          <div>
            <label className="label">Pitch de la scène</label>
            <input className="input" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={product?.pitch || "Ce que Mei doit mettre en avant…"} />
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
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio src={audioUrl} controls className="h-8" />
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <div className="text-sm text-[var(--muted)]">
              Coût estimé : <span className="text-[var(--foreground)] font-semibold">{usd(estimate)}</span>
            </div>
            <button className="btn btn-primary" disabled={busy || !ready || !outfit} onClick={generate}>
              {busy ? "En cours…" : "Générer le plan de présentation"}
            </button>
          </div>
        </div>

        <div className="card p-6 flex flex-col min-h-[420px]">
          {error && <p className="text-sm text-[var(--danger)] text-center">{error}</p>}
          {!error && status && !videoUrl && (
            <div className="text-center m-auto">
              <p className="text-sm text-[var(--muted)] animate-pulse">Statut : {status}</p>
              <p className="text-xs text-[var(--muted)] mt-2">La génération peut prendre plusieurs minutes.</p>
            </div>
          )}
          {!error && !status && !videoUrl && (
            <p className="text-sm text-[var(--muted)] m-auto">Le plan de présentation apparaîtra ici.</p>
          )}
          {videoUrl && (
            <div className="w-full">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
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

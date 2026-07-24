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
  // "video" = plan animé (Kling) ; "carousel" = diaporama des vraies captures produit.
  kind?: "video" | "carousel";
  productId?: string;
  // Présentateur assigné à ce plan (Route A duo/multi). Vide = présentateur principal.
  speakerId?: string;
  // Route B : image de départ imposée (frame "duo" combinant plusieurs présentateurs).
  startImageUrl?: string;
}

interface Product {
  id: string;
  name: string;
  screens: string[];
}

// Route A (duo/multi) : un présentateur additionnel avec sa propre référence.
interface Partner {
  characterId: string;
  identityList: string[];
  identityRef: string;
  masterUrl: string | null;
  busy: boolean;
  error: string | null;
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
// MOTION : on demande un mouvement MINIMAL pour éviter la déformation en gros plan.
const CONSISTENCY = "Exactement la même personne et la même tenue que sur l'image, identité inchangée, une seule personne au premier plan, aucun changement de vêtements.";
const MOTION = "Mouvement subtil et naturel, caméra fixe et stable, aucun mouvement brusque ni zoom rapide.";

interface Preset {
  id: string;
  label: string;
  decor?: string;
  note?: string;
  shots: Omit<Shot, "status">[];
}

const PRESETS: Preset[] = [
  {
    id: "micro-trottoir",
    label: "Micro-trottoir (rue)",
    decor: "rue animée",
    shots: [
      { title: "1. Accroche caméra", prompt: `Regarde la caméra et parle avec un sourire, très léger hochement de tête. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "2. Question micro-trottoir", prompt: `Tient un micro près du visage, attitude enthousiaste, léger mouvement des lèvres. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "3. Écoute / réaction", prompt: `Hoche la tête en écoutant, sourit, expression engageante. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "4. Argument", prompt: `Explique face caméra, gestes discrets des mains près du buste. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "5. Punchline", prompt: `Sourire complice, léger clin d'œil, petit mouvement de tête. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "6. CTA", prompt: `Pouce levé près du buste, sourire chaleureux, regard caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
    ],
  },
  {
    id: "table-ronde",
    label: "Plateau / table ronde",
    decor: "plateau TV moderne, assis à une table ronde",
    note: "Les invités autour de la table sont générés par l'IA et varient d'un plan à l'autre : garde le personnage seul au premier plan.",
    shots: [
      { title: "1. Intro plateau", prompt: `Assis à une table ronde en plateau TV, parle face caméra avec un sourire, léger geste. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "2. Prise de parole", prompt: `Explique un point, mains posées calmement sur la table, regard vers la caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "3. Écoute", prompt: `Écoute en hochant la tête, sourit, tourne très légèrement la tête. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "4. Conclusion", prompt: `Conclut face caméra, sourire chaleureux. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
    ],
  },
  {
    id: "interview",
    label: "Interview (présentateur + invité)",
    decor: "studio d'interview, deux fauteuils, ambiance chaleureuse",
    note: "L'invité est généré par l'IA et n'est pas cohérent entre les plans : privilégie les plans centrés sur le présentateur.",
    shots: [
      { title: "1. Accueil", prompt: `Assis en studio d'interview, souhaite la bienvenue face caméra, sourire. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "2. Question", prompt: `Pose une question, léger geste de la main, regard vers la caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "3. Écoute attentive", prompt: `Écoute attentivement, hoche la tête, sourit. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "4. Conclusion", prompt: `Remercie et conclut face caméra, sourire. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
    ],
  },
  {
    id: "duo",
    label: "Duo / interview (2 présentateurs)",
    decor: "studio d'interview, deux fauteuils, ambiance chaleureuse",
    note: "Champ / contre-champ : chaque plan est assigné à UN présentateur (identité parfaite). Ajoute un 2e présentateur dans le casting, puis « Charger ce style » alterne automatiquement les plans.",
    shots: [
      { title: "1. Accueil (A)", prompt: `Assis en studio, souhaite la bienvenue face caméra, sourire chaleureux. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "2. Réponse (B)", prompt: `Répond avec enthousiasme face caméra, léger geste de la main. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "3. Question (A)", prompt: `Pose une question, regard vers l'invité puis vers la caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "4. Réponse (B)", prompt: `Explique un point, sourit, hoche la tête. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
      { title: "5. Conclusion (A)", prompt: `Conclut et remercie face caméra, sourire. ${MOTION} ${CONSISTENCY}`, seconds: 5 },
    ],
  },
];

function expressionLabel(a: AssetItem): string {
  const key = a.relPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? a.name;
  return EXPRESSION_FR[key] ?? key.replace(/_/g, " ");
}

export default function Storyboard() {
  const { characterId, characterName, characters } = useCharacter();
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
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  // Route B (prototype) : frame combinant plusieurs présentateurs.
  const [duoBusy, setDuoBusy] = useState(false);
  const [duoUrl, setDuoUrl] = useState<string | null>(null);
  const [duoError, setDuoError] = useState<string | null>(null);
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
    apiGet<{ products: Product[] }>("/api/products").then((d) => setProducts(d.products ?? [])).catch(() => {});
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

  function nameOf(id: string): string {
    return characters.find((c) => c.id === id)?.name ?? id;
  }

  // Casting = présentateur principal (contexte) + partenaires ajoutés.
  const cast = [
    { id: characterId, name: characterName || nameOf(characterId) },
    ...partners.map((p) => ({ id: p.characterId, name: nameOf(p.characterId) })),
  ];
  const availableToAdd = characters.filter(
    (c) => c.id !== characterId && !partners.some((p) => p.characterId === c.id),
  );

  async function addPartner(id: string) {
    if (!id || partners.some((p) => p.characterId === id)) return;
    let identityList: string[] = [];
    try {
      const d = await apiGet<{ assets: AssetGroups }>(withCharacter("/api/assets", id));
      identityList = (d.assets?.identity ?? []).map((a) => a.relPath);
    } catch {}
    const preferred = ["identity/portrait_front.png", "identity/master_face_v1.png", "identity/full_body_front.png"];
    const identityRef = preferred.find((p) => identityList.includes(p)) ?? identityList[0] ?? "";
    setPartners((prev) => [...prev, { characterId: id, identityList, identityRef, masterUrl: null, busy: false, error: null }]);
  }

  function removePartner(id: string) {
    setPartners((prev) => prev.filter((p) => p.characterId !== id));
    setShots((prev) => prev.map((s) => (s.speakerId === id ? { ...s, speakerId: characterId } : s)));
  }

  function updatePartner(id: string, patch: Partial<Partner>) {
    setPartners((prev) => prev.map((p) => (p.characterId === id ? { ...p, ...patch } : p)));
  }

  function partnerAssetSrc(id: string, relPath: string) {
    return `/api/asset?character=${encodeURIComponent(id)}&path=${encodeURIComponent(relPath)}`;
  }

  async function makePartnerMaster(id: string) {
    const p = partners.find((x) => x.characterId === id);
    if (!p || !p.identityRef) return;
    updatePartner(id, { busy: true, error: null });
    try {
      const imageSize = aspect === "16:9" ? "landscape_16_9" : aspect === "1:1" ? "square_hd" : "portrait_16_9";
      const parts = [
        "Cette personne",
        decor.trim() ? `dans ${decor.trim()}` : "en studio épuré",
        "présente face caméra, plan taille (visage et buste bien cadrés, centrés), lumière naturelle, photoréaliste, une seule personne, identité inchangée",
      ].filter(Boolean);
      const res = await apiPost<{ imageUrl: string }>("/api/generate/scene-image", {
        character: id,
        refPath: p.identityRef,
        prompt: parts.join(", ") + ".",
        imageSize,
      });
      updatePartner(id, { masterUrl: res.imageUrl, busy: false });
      refreshBudget();
    } catch (e) {
      updatePartner(id, { busy: false, error: e instanceof Error ? e.message : "Échec de génération" });
    }
  }

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];

  function loadPreset() {
    const base: Shot[] = preset.shots.map((s) => ({ ...s, kind: "video", status: null }));
    // Préréglage duo : on alterne les présentateurs du casting (champ / contre-champ).
    if (preset.id === "duo" && cast.length > 1) {
      base.forEach((s, idx) => { s.speakerId = cast[idx % cast.length].id; });
    }
    setShots(base);
    if (preset.decor) { setDecor(preset.decor); resetMaster(); }
  }

  function addShot() {
    setShots((prev) => [...prev, { title: `Plan ${prev.length + 1}`, prompt: "", seconds: model?.defaultSeconds ?? 6, status: null, kind: "video" }]);
  }

  function addCarousel() {
    setShots((prev) => [
      ...prev,
      { title: `Démo produit (carrousel)`, prompt: "", seconds: 6, status: null, kind: "carousel", productId: products[0]?.id ?? "" },
    ]);
  }

  function update(i: number, patch: Partial<Shot>) {
    setShots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function remove(i: number) {
    setShots((prev) => prev.filter((_, idx) => idx !== i));
  }

  const totalSeconds = shots.reduce((a, s) => a + (s.seconds || 0), 0);
  const videoSeconds = shots.filter((s) => s.kind !== "carousel").reduce((a, s) => a + (s.seconds || 0), 0);
  const carouselCount = shots.filter((s) => s.kind === "carousel").length;
  // Carrousel = compute ffmpeg (~négligeable) ; plans vidéo = tarif du moteur.
  const totalCost = model ? +(model.usdPerSecond * videoSeconds + carouselCount * 0.02).toFixed(2) : 0;
  // Frame de départ commune : l'image de référence générée, sinon l'image d'identité brute.
  const startFrame = masterUrl ? null : identityRef || null;

  function poll(i: number, sub: { requestId: string; model: string }) {
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
  }

  async function generateCarousel(i: number) {
    const shot = shots[i];
    if (!shot.productId) return update(i, { error: "Choisis un produit" });
    update(i, { status: "Envoi…", videoUrl: null, error: null });
    if (timers.current[i]) clearInterval(timers.current[i]);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/carousel", {
        product: shot.productId,
        seconds: shot.seconds,
      });
      refreshBudget();
      poll(i, sub);
    } catch (e) {
      update(i, { status: null, error: e instanceof Error ? e.message : "Erreur" });
    }
  }

  async function makeDuoFrame() {
    const refs = [
      { character: characterId, refPath: identityRef },
      ...partners.map((p) => ({ character: p.characterId, refPath: p.identityRef })),
    ].filter((r) => r.refPath);
    if (refs.length < 2) return;
    setDuoBusy(true);
    setDuoError(null);
    try {
      const res = await apiPost<{ imageUrl: string }>("/api/generate/duo-frame", {
        characters: refs,
        decor: decor.trim(),
        aspectRatio: aspect,
      });
      setDuoUrl(res.imageUrl);
      refreshBudget();
    } catch (e) {
      setDuoError(e instanceof Error ? e.message : "Échec de génération de l'image duo");
    } finally {
      setDuoBusy(false);
    }
  }

  function addDuoShot() {
    if (!duoUrl) return;
    setShots((prev) => [
      ...prev,
      {
        title: `Plan duo (${cast.map((c) => c.name).join(" + ")})`,
        prompt: `Les personnes discutent naturellement face caméra, légers gestes. ${MOTION} ${CONSISTENCY}`,
        seconds: 5,
        status: null,
        kind: "video",
        startImageUrl: duoUrl,
      },
    ]);
  }

  // Référence à utiliser pour un plan selon le présentateur assigné.
  function speakerRef(shot: Shot): { char?: string; imageUrl?: string; assetPaths?: string[] } {
    // Route B : image de départ imposée (duo) — prioritaire.
    if (shot.startImageUrl) return { char: undefined, imageUrl: shot.startImageUrl, assetPaths: undefined };
    const speakerId = shot.speakerId ?? characterId;
    if (speakerId === characterId) {
      return {
        char: characterId,
        imageUrl: masterUrl ?? undefined,
        assetPaths: !masterUrl && startFrame ? [startFrame] : undefined,
      };
    }
    const p = partners.find((x) => x.characterId === speakerId);
    return {
      char: speakerId,
      imageUrl: p?.masterUrl ?? undefined,
      assetPaths: p && !p.masterUrl && p.identityRef ? [p.identityRef] : undefined,
    };
  }

  function shotReady(shot: Shot): boolean {
    if (shot.kind === "carousel") return Boolean(shot.productId);
    if (!needsStartImage) return true;
    const ref = speakerRef(shot);
    return Boolean(ref.imageUrl || (ref.assetPaths && ref.assetPaths.length));
  }

  async function generateShot(i: number) {
    const shot = shots[i];
    if (shot.kind === "carousel") return generateCarousel(i);
    if (!shot.prompt) return;
    update(i, { status: "Envoi…", videoUrl: null, error: null });
    if (timers.current[i]) clearInterval(timers.current[i]);
    try {
      const ref = speakerRef(shot);
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/video", {
        model: modelId,
        prompt: shot.prompt,
        seconds: shot.seconds,
        aspectRatio: aspect,
        character: needsStartImage ? ref.char : undefined,
        imageUrl: needsStartImage ? ref.imageUrl : undefined,
        assetPaths: needsStartImage ? ref.assetPaths : undefined,
      });
      refreshBudget();
      poll(i, sub);
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
        <div className="min-w-[200px]">
          <label className="label">Style de scène</label>
          <select className="select" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={loadPreset}>Charger ce style</button>
        <button className="btn btn-ghost" onClick={addShot}>+ Plan vidéo</button>
        <button className="btn btn-ghost" onClick={addCarousel} title="Diaporama de tes vraies captures d'écran">+ Carrousel captures</button>
      </div>

      {preset.note && (
        <div className="card p-3 mb-6 border-[var(--warning)]/40">
          <p className="text-xs text-[var(--muted)]">ⓘ {preset.note}</p>
        </div>
      )}

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

      {/* 2b) Casting — autres présentateurs (Route A : plans alternés, identité parfaite) */}
      {needsStartImage && (
        <div className="card p-5 mb-6">
          <div className="label mb-1">Casting — autres présentateurs (optionnel)</div>
          <p className="text-xs text-[var(--muted)] mb-4">
            Ajoute un ou plusieurs présentateurs pour un <strong>duo / plateau</strong>. On alterne les plans
            (champ&nbsp;/&nbsp;contre-champ) : chaque plan est assigné à un présentateur, avec <strong>sa propre référence</strong>
            → identités parfaites. Utilise le style <em>Duo / interview</em> pour l&apos;alternance automatique.
          </p>

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="min-w-[220px]">
              <label className="label">Ajouter un présentateur</label>
              <select
                className="select"
                value=""
                onChange={(e) => { if (e.target.value) addPartner(e.target.value); }}
                disabled={availableToAdd.length === 0}
              >
                <option value="">{availableToAdd.length ? "Choisir…" : "Aucun autre personnage disponible"}</option>
                {availableToAdd.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-[var(--muted)]">Présentateur principal : <strong>{characterName || "—"}</strong> (réglé ci-dessus).</p>
          </div>

          {partners.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partners.map((p) => (
                <div key={p.characterId} className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">🎤 {nameOf(p.characterId)}</div>
                    <button className="btn btn-ghost text-xs px-2 py-1" onClick={() => removePartner(p.characterId)}>Retirer</button>
                  </div>
                  {p.identityList.length === 0 ? (
                    <p className="text-xs text-[var(--danger)]">Aucun asset d&apos;identité pour ce personnage.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-2">
                        {p.identityList.map((rel) => {
                          const active = p.identityRef === rel;
                          return (
                            <button
                              key={rel}
                              type="button"
                              onClick={() => updatePartner(p.characterId, { identityRef: rel, masterUrl: null })}
                              className={`relative rounded-lg overflow-hidden border-2 ${active ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={partnerAssetSrc(p.characterId, rel)} alt="" className="h-20 w-full object-contain bg-[var(--surface-2)]" />
                              {active && <span className="absolute top-0.5 right-0.5 bg-[var(--accent)] text-white text-[10px] rounded px-1">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="btn btn-ghost text-xs px-2 py-1"
                          disabled={!ready || !p.identityRef || p.busy}
                          onClick={() => makePartnerMaster(p.characterId)}
                        >
                          {p.busy ? "Génération…" : p.masterUrl ? "Régénérer réf." : "Générer réf. (décor commun)"}
                        </button>
                        {p.masterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.masterUrl} alt="réf" className="h-16 w-auto rounded border border-[var(--border)]" />
                        ) : (
                          <span className="text-xs text-[var(--muted)]">Sinon la photo d&apos;identité sert de 1re frame.</span>
                        )}
                      </div>
                      {p.error && <p className="text-xs text-[var(--danger)] mt-1">{p.error}</p>}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2c) Route B (prototype) : les présentateurs dans le MÊME cadre */}
      {needsStartImage && partners.length > 0 && (
        <div className="card p-5 mb-6 border-[var(--accent)]/40">
          <div className="label mb-1">🧪 Prototype — les deux dans le même cadre (Route B)</div>
          <p className="text-xs text-[var(--muted)] mb-4">
            Combine les photos de {cast.map((c) => c.name).join(" + ")} en <strong>une seule image</strong> (modèle multi-références),
            puis anime-la avec Kling. Plus spectaculaire, mais la fidélité des visages à plusieurs est <strong>moins garantie</strong> :
            regarde le rendu avant de l&apos;utiliser. (Utilise l&apos;identité choisie pour chaque présentateur + le décor commun.)
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button className="btn btn-primary" disabled={!ready || duoBusy} onClick={makeDuoFrame}>
              {duoBusy ? "Génération…" : duoUrl ? "Régénérer l'image duo" : "Générer une image duo"}
            </button>
            {duoUrl && (
              <button className="btn btn-ghost" onClick={addDuoShot}>+ Ajouter un plan avec cette image</button>
            )}
            {duoError && <span className="text-sm text-[var(--danger)]">{duoError}</span>}
          </div>
          {duoUrl && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={duoUrl} alt="image duo" className="max-h-80 w-auto rounded-lg border border-[var(--border)]" />
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
              {shot.kind !== "carousel" && !shot.startImageUrl && cast.length > 1 && (
                <select
                  className="select w-40"
                  value={shot.speakerId ?? characterId}
                  onChange={(e) => update(i, { speakerId: e.target.value })}
                  title="Présentateur de ce plan"
                >
                  {cast.map((c) => <option key={c.id} value={c.id}>🎤 {c.name}</option>)}
                </select>
              )}
              <select
                className="select w-24"
                value={shot.seconds}
                onChange={(e) => update(i, { seconds: Number(e.target.value) })}
              >
                {(model?.seconds ?? [5, 6, 8, 10]).map((s) => <option key={s} value={s}>{s}s</option>)}
              </select>
              <button className="btn btn-ghost" onClick={() => remove(i)}>✕</button>
            </div>
            {shot.kind === "carousel" ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-3 space-y-2">
                <p className="text-xs text-[var(--muted)]">
                  📱 Diaporama de tes <strong>vraies captures d&apos;écran</strong> (pas d&apos;IA). Chaque capture est affichée
                  ~{products.find((p) => p.id === shot.productId)?.screens.length
                    ? (shot.seconds / (products.find((p) => p.id === shot.productId)!.screens.length || 1)).toFixed(1)
                    : "?"}s. Place ce plan entre deux plans du présentateur (intro / conclusion).
                </p>
                <select
                  className="select"
                  value={shot.productId ?? ""}
                  onChange={(e) => update(i, { productId: e.target.value })}
                >
                  {products.length === 0 && <option value="">Aucun produit — ajoute des captures dans Produits / Apps</option>}
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.screens.length} captures)</option>
                  ))}
                </select>
              </div>
            ) : (
              <textarea
                className="input min-h-[70px]"
                value={shot.prompt}
                onChange={(e) => update(i, { prompt: e.target.value })}
                placeholder="Décris l'action de ce plan (le personnage et la tenue restent ceux de l'image de référence)…"
              />
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
              {shot.kind === "carousel" ? (
                <button
                  className="btn btn-primary"
                  disabled={!ready || !shot.productId || (!!shot.status && !shot.videoUrl && !shot.error)}
                  onClick={() => generateShot(i)}
                >
                  Générer le carrousel
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={!shot.prompt || !ready || !shotReady(shot) || (!!shot.status && !shot.videoUrl && !shot.error)}
                  onClick={() => generateShot(i)}
                  title={!shotReady(shot) ? "Génère d'abord la référence de ce présentateur" : ""}
                >
                  Générer ce plan
                </button>
              )}
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
          Choisis un style et clique « Charger ce style », ou ajoute des plans pour commencer.
        </div>
      )}
    </div>
  );
}

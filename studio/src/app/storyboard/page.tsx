"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { apiGet, apiPost, refreshBudget, usd, withCharacter } from "@/lib/client";
import { useCharacter } from "@/lib/character-context";
import { usePersistentState } from "@/lib/use-persistent-state";
import { setLastVideo } from "@/lib/media-store";
import { PageHeader } from "@/components/page-header";
import { SendToAiccos } from "@/components/send-to-aiccos";
import { useConfirm } from "@/components/confirm";
import { LOCATION_PRESETS } from "@/lib/location-presets";
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
  perImage?: number; // carrousel : temps d'affichage (s) par capture
  // Présentateur assigné à ce plan (Route A duo/multi). Vide = présentateur principal.
  speakerId?: string;
  // Route B : image de départ imposée (frame "duo" combinant plusieurs présentateurs).
  startImageUrl?: string;
  // --- Voix + lip-sync PAR PLAN (1 visage continu = lèvres nettes) ---
  line?: string; // réplique dite par le présentateur dans ce plan
  audioUrl?: string | null; // voix générée (data URL)
  voiceBusy?: boolean;
  voiceError?: string | null;
  syncedUrl?: string | null; // plan lip-syncé (avec voix), utilisé pour l'assemblage
  syncStatus?: string | null;
  syncError?: string | null;
  syncRequestId?: string;
  syncModel?: string;
  silent?: boolean; // plan volontairement muet (ambiance / duo) : exclu de l'alerte "sans voix"
  // Micro-trottoir : "guest" = passant généré sans identité SDK (text→vidéo).
  role?: "host" | "guest";
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

// speakerSlot : 0 = présentateur principal (contexte), 1 = 1er partenaire, etc.
type PresetShot = Omit<Shot, "status"> & { speakerSlot?: number };

interface Preset {
  id: string;
  label: string;
  group: "extérieurs" | "studio" | "multi";
  decor?: string;
  note?: string;
  aspect?: string; // ratio imposé par le style (ex. "16:9" plateau TV, "9:16" réseaux)
  shots: PresetShot[];
}

// Plans du plateau produit (dialogue Mei ↔ Tom + démo carrousel), partagés par les
// variantes verticale (9:16) et horizontale (16:9).
const TALKSHOW_SHOTS: PresetShot[] = [
  { title: "1. Accueil — Mei", speakerSlot: 0, prompt: `Sur un plateau de talk-show, souhaite la bienvenue face caméra, sourire chaleureux, léger geste d'accueil. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Bonjour à tous et bienvenue sur le plateau ! Aujourd'hui, avec Tom, on vous présente [produit]." },
  { title: "2. Présentation — Tom", speakerSlot: 1, prompt: `Présente le sujet face caméra, léger geste de la main vers l'écran. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Merci Mei ! Alors [produit], c'est l'application qui permet de…" },
  { title: "3. Démo à l'écran (carrousel)", kind: "carousel", prompt: "", seconds: 8, perImage: 2.5 },
  { title: "4. Question — Mei", speakerSlot: 0, prompt: `Se tourne légèrement puis regarde la caméra, pose une question, attitude curieuse. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Tom, concrètement, qu'est-ce que ça change pour l'utilisateur au quotidien ?" },
  { title: "5. Réponse — Tom", speakerSlot: 1, prompt: `Répond avec enthousiasme face caméra, hoche la tête, mains calmes. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Très bonne question. En fait, ce qui change vraiment, c'est…" },
  { title: "6. Relance — Mei", speakerSlot: 0, prompt: `Pose une seconde question, sourire, léger geste. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Et côté prix / abonnement, comment ça se passe ?" },
  { title: "7. Réponse — Tom", speakerSlot: 1, prompt: `Explique un point, regard caméra, geste discret. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "C'est simple :…" },
  { title: "8. Conclusion — Mei", speakerSlot: 0, prompt: `Conclut et remercie face caméra, sourire chaleureux, invite à s'abonner. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Merci Tom ! Testez [produit], le lien est en description. À très vite !" },
];

const PRESETS: Preset[] = [
  {
    id: "micro-trottoir",
    label: "Micro-trottoir (présentateur + passant)",
    group: "extérieurs",
    decor: "rue animée en ville, jour, lumière naturelle",
    note:
      "Champ / contre-champ fiable : plans PRÉSENTATEUR (identité verrouillée + lip-sync) alternés avec plans PASSANT (générés sans identité SDK, text→vidéo). Un seul visage par plan. Génère d'abord le personnage de référence dans le décor, puis chaque plan.",
    shots: [
      {
        title: "1. Accroche — présentateur",
        role: "host",
        speakerSlot: 0,
        prompt: `Cadrage buste, regarde la caméra et parle avec un sourire, très léger hochement de tête. ${MOTION} ${CONSISTENCY}`,
        seconds: 5,
        line: "Salut ! Aujourd'hui je suis dans la rue pour vous faire découvrir [produit].",
      },
      {
        title: "2. Question — présentateur",
        role: "host",
        speakerSlot: 0,
        prompt: `Cadrage buste, tient un micro près du visage, attitude enthousiaste, parle face caméra. ${MOTION} ${CONSISTENCY}`,
        seconds: 5,
        line: "Excusez-moi, vous connaissez [produit] ?",
      },
      {
        title: "3. Réponse — passant",
        role: "guest",
        prompt:
          "Street interview: a single random passerby (not a celebrity), medium close-up, looking slightly off-camera as if answering an interviewer on a busy city street, natural daylight, photorealistic. Only one person in frame. Subtle natural motion, talking, blinking. No text, no logos.",
        seconds: 5,
        line: "Ah oui, j'en ai entendu parler, ça a l'air pratique !",
        silent: false,
      },
      {
        title: "4. Argument — présentateur",
        role: "host",
        speakerSlot: 0,
        prompt: `Cadrage buste, explique face caméra, gestes discrets des mains près du buste. ${MOTION} ${CONSISTENCY}`,
        seconds: 5,
        line: "Exactement — [produit] te permet de… en quelques secondes.",
      },
      {
        title: "5. Réaction — passant",
        role: "guest",
        prompt:
          "Street interview: a different single passerby, medium close-up, nodding and smiling while answering, busy city street background, natural daylight, photorealistic. Only one person in frame. Subtle motion. No text, no logos.",
        seconds: 5,
        line: "Carrément, je vais essayer !",
      },
      {
        title: "6. Appel à l'action — présentateur",
        role: "host",
        speakerSlot: 0,
        prompt: `Cadrage buste, pouce levé près du buste, sourire chaleureux, regard caméra. ${MOTION} ${CONSISTENCY}`,
        seconds: 5,
        line: "Le lien est en description — teste [produit] dès maintenant. À bientôt !",
      },
    ],
  },
  {
    id: "exterieur-rue",
    label: "Présentation rue",
    group: "extérieurs",
    decor: "rue animée en ville, jour, lumière naturelle",
    note: "Présentateur seul en extérieur (identité verrouillée). Idéal pour une promo app en ville. Remplace [produit] dans les répliques.",
    shots: [
      { title: "1. Accroche rue", role: "host", speakerSlot: 0, prompt: `Cadrage buste en rue, sourit à la caméra, léger hochement de tête. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Salut ! Je suis dehors aujourd'hui pour te parler de [produit]." },
      { title: "2. Problème", role: "host", speakerSlot: 0, prompt: `Cadrage buste, explique un problème face caméra, geste discret. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Tu connais ce moment où… ?" },
      { title: "3. Solution", role: "host", speakerSlot: 0, prompt: `Cadrage buste, présente le produit avec enthousiasme, tient un smartphone. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Avec [produit], c'est simple :…" },
      { title: "4. Bénéfice", role: "host", speakerSlot: 0, prompt: `Cadrage buste, argumente face caméra, sourire. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "En concrètement, ça te fait gagner…" },
      { title: "5. Appel à l'action", role: "host", speakerSlot: 0, prompt: `Cadrage buste, pouce levé, regard caméra, sourire chaleureux. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Le lien est en description — teste [produit] maintenant !" },
    ],
  },
  {
    id: "exterieur-promenade",
    label: "Promenade urbaine",
    group: "extérieurs",
    decor: "trottoir en ville, jour, lumière naturelle, passants en arrière-plan flou",
    note: "Ambiance « en marchant » (mouvement subtil, pas de course). Un seul présentateur, plans buste.",
    shots: [
      { title: "1. Accroche en marchant", role: "host", speakerSlot: 0, prompt: `Cadrage buste, marche très lentement vers la caméra puis s'arrête, parle avec un sourire. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Hey, je te montre un truc pendant ma balade…" },
      { title: "2. Découverte", role: "host", speakerSlot: 0, prompt: `Cadrage buste, montre un smartphone, regard caméra, geste naturel. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "[produit], c'est l'app qui…" },
      { title: "3. Démo orale", role: "host", speakerSlot: 0, prompt: `Cadrage buste, explique face caméra, légers gestes des mains. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Tu ouvres, tu fais ça, et hop…" },
      { title: "4. Conclusion", role: "host", speakerSlot: 0, prompt: `Cadrage buste, clin d'œil discret, sourire, regard caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Essaie [produit] — lien en bio. À plus !" },
    ],
  },
  {
    id: "exterieur-terrasse",
    label: "Terrasse / rooftop",
    group: "extérieurs",
    decor: "terrasse rooftop avec vue sur la ville, jour, ciel clair, lumière douce",
    note: "Ambiance lifestyle / premium. Présentateur seul face caméra.",
    shots: [
      { title: "1. Accueil terrasse", role: "host", speakerSlot: 0, prompt: `Cadrage buste sur une terrasse, sourit à la caméra, lumière douce. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Belle vue, non ? Parlons de [produit]." },
      { title: "2. Pitch", role: "host", speakerSlot: 0, prompt: `Cadrage buste, présente le produit calmement, geste discret. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "[produit] t'aide à… sans prise de tête." },
      { title: "3. Preuve", role: "host", speakerSlot: 0, prompt: `Cadrage buste, tient un smartphone, regarde brièvement l'écran puis la caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Regarde : en 30 secondes tu peux…" },
      { title: "4. Appel à l'action", role: "host", speakerSlot: 0, prompt: `Cadrage buste, sourire chaleureux, regard caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Télécharge [produit] — le lien est juste en dessous." },
    ],
  },
  {
    id: "exterieur-mer",
    label: "Front de mer",
    group: "extérieurs",
    decor: "promenade en front de mer, ciel bleu, lumière naturelle, vaguelette au loin",
    note: "Ambiance détente / vacances. Présentateur seul, cadrage buste.",
    shots: [
      { title: "1. Accroche mer", role: "host", speakerSlot: 0, prompt: `Cadrage buste en bord de mer, cheveux légèrement au vent, sourit à la caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Même en balade, je reste organisée grâce à [produit]." },
      { title: "2. Bénéfice", role: "host", speakerSlot: 0, prompt: `Cadrage buste, explique face caméra, geste naturel. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Ça me permet de… où que je sois." },
      { title: "3. Appel à l'action", role: "host", speakerSlot: 0, prompt: `Cadrage buste, pouce levé, sourire, regard caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Teste [produit] — lien en description !" },
    ],
  },
  {
    id: "exterieur-parc",
    label: "Parc / jardin",
    group: "extérieurs",
    decor: "parc urbain, allée arborée, jour, lumière naturelle douce",
    note: "Ambiance calme et accessible. Présentateur seul.",
    shots: [
      { title: "1. Accroche parc", role: "host", speakerSlot: 0, prompt: `Cadrage buste dans un parc, sourit à la caméra, lumière douce. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Petit moment dehors pour te parler de [produit]." },
      { title: "2. Explication", role: "host", speakerSlot: 0, prompt: `Cadrage buste, explique calmement, gestes discrets. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Le principe est simple :…" },
      { title: "3. Conclusion", role: "host", speakerSlot: 0, prompt: `Cadrage buste, sourire chaleureux, regard caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Essaie [produit] aujourd'hui — le lien est en bio." },
    ],
  },
  {
    id: "exterieur-marche",
    label: "Marché en plein air",
    group: "extérieurs",
    decor: "marché en plein air, étals colorés, jour, lumière naturelle",
    note: "Ambiance vivante / locale. Présentateur seul au premier plan (les passants restent flous).",
    shots: [
      { title: "1. Accroche marché", role: "host", speakerSlot: 0, prompt: `Cadrage buste sur un marché, ambiance vivante derrière, parle face caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Je suis au marché et j'ai une idée à te partager…" },
      { title: "2. Produit", role: "host", speakerSlot: 0, prompt: `Cadrage buste, présente le smartphone, enthousiasme mesuré. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "[produit], c'est pour ceux qui veulent…" },
      { title: "3. Appel à l'action", role: "host", speakerSlot: 0, prompt: `Cadrage buste, clin d'œil, sourire, regard caméra. ${MOTION} ${CONSISTENCY}`, seconds: 5, line: "Le lien est en description — à tout de suite !" },
    ],
  },
  {
    id: "table-ronde",
    label: "Plateau / table ronde",
    group: "studio",
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
    group: "studio",
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
    group: "multi",
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
  {
    id: "talkshow-produit",
    label: "Plateau produit vertical 9:16 (Mei + Tom + démo)",
    group: "multi",
    decor: "plateau de talk-show tech moderne, éclairage studio, grand écran lumineux en arrière-plan",
    aspect: "9:16",
    note:
      "Format réseaux (Reels / TikTok / Short). Dialogue en champ / contre-champ : chaque plan = UN présentateur qui parle (voix + lip-sync par plan). Le carrousel est un plan inséré = « l'écran » qui montre le produit. Ajoute Tom au casting, puis « Charger ce style ». Écris ensuite la réplique de chaque plan.",
    shots: TALKSHOW_SHOTS,
  },
  {
    id: "talkshow-produit-16-9",
    label: "Plateau produit TV 16:9 (Mei + Tom + démo)",
    group: "multi",
    decor: "plateau de talk-show tech moderne, éclairage studio, grand écran lumineux en arrière-plan",
    aspect: "16:9",
    note:
      "Format plateau TV classique (YouTube / paysage). Dialogue en champ / contre-champ : chaque plan = UN présentateur qui parle (voix + lip-sync par plan). Le carrousel est un plan inséré = « l'écran ». Ajoute Tom au casting, puis « Charger ce style », et écris la réplique de chaque plan.",
    shots: TALKSHOW_SHOTS,
  },
];

function expressionLabel(a: AssetItem): string {
  const key = a.relPath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? a.name;
  return EXPRESSION_FR[key] ?? key.replace(/_/g, " ");
}

export default function Storyboard() {
  const { characterId, characterName, characters, setCharacterId } = useCharacter();
  const confirm = useConfirm();
  const [ready, setReady] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [aspect, setAspect] = useState("9:16");

  // Assets du personnage (identité + expressions) et tenues (avec description).
  const [assets, setAssets] = useState<AssetGroups>({});
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  // Brouillon auto (persistant par personnage) : les plans et le décor survivent au changement de page.
  const dkey = (field: string) => (characterId ? `vh:draft:storyboard:${characterId}:${field}` : null);

  // --- Configuration personnage GLOBALE (définie une fois, appliquée partout) ---
  const [identityRef, setIdentityRef] = useState("");
  const [expressionRef, setExpressionRef] = useState(""); // vide = aucune
  const [outfitId, setOutfitId] = useState("");
  const [decor, setDecor] = usePersistentState(dkey("decor"), "rue animée");
  // Image de référence persistée par personnage (URL légère) : évite les boutons
  // grisés au retour sur la page (la référence n'était pas mémorisée avant).
  const [masterUrl, setMasterUrl] = usePersistentState<string | null>(dkey("master"), null);
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  // Brouillon des plans persistant, MAIS on strippe les audios (base64 lourds) pour
  // ne pas saturer le quota localStorage — sinon tout le brouillon (dont les vidéos) était perdu.
  const shotsKey = dkey("shots");
  const [shots, setShotsRaw] = useState<Shot[]>([]);
  useEffect(() => {
    if (!shotsKey || typeof window === "undefined") {
      setShotsRaw([]);
      return;
    }
    const raw = localStorage.getItem(shotsKey);
    if (raw) {
      try {
        setShotsRaw(JSON.parse(raw) as Shot[]);
        return;
      } catch {
        /* JSON invalide */
      }
    }
    setShotsRaw([]);
  }, [shotsKey]);
  const setShots = useCallback<Dispatch<SetStateAction<Shot[]>>>(
    (updater) => {
      setShotsRaw((prev) => {
        const next = typeof updater === "function" ? (updater as (p: Shot[]) => Shot[])(prev) : updater;
        if (shotsKey && typeof window !== "undefined") {
          try {
            const light = next.map((s) => (s.audioUrl ? { ...s, audioUrl: undefined } : s));
            localStorage.setItem(shotsKey, JSON.stringify(light));
          } catch {
            /* quota dépassé : on garde au moins l'état en session */
          }
        }
        return next;
      });
    },
    [shotsKey],
  );
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [products, setProducts] = useState<Product[]>([]);
  const [partners, setPartners] = usePersistentState<Partner[]>(dkey("partners"), []);
  // Route B (prototype) : frame combinant plusieurs présentateurs.
  const [duoBusy, setDuoBusy] = useState(false);
  const [duoUrl, setDuoUrl] = useState<string | null>(null);
  const [duoError, setDuoError] = useState<string | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  const syncTimers = useRef<Record<number, ReturnType<typeof setInterval>>>({});
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
    const syncSnapshot = syncTimers.current;
    return () => {
      Object.values(timersSnapshot).forEach(clearInterval);
      Object.values(syncSnapshot).forEach(clearInterval);
      if (mergeTimer.current) clearInterval(mergeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!characterId) return;
    // Ne pas réinitialiser masterUrl ici : il est persisté par personnage et rechargé
    // automatiquement (sinon la référence disparaissait au retour sur la page).
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
      const place = decor.trim() || "a lively city street";
      // Prompt EN + lieu en tête : évite le fond studio blanc recopié par PuLID.
      const prompt = [
        `Photorealistic medium shot of THIS exact person standing in ${place}.`,
        `The environment of ${place} fills the entire background (NOT a white studio, NOT a blank wall).`,
        clothing ? `Wearing ${clothing}.` : "",
        expr ? `Expression: ${expressionLabel(expr)}.` : "",
        "Looking at camera, chest-up framing, natural daylight, high detail face.",
        "Only ONE person in frame, no twin, no clone, no white backdrop.",
      ]
        .filter(Boolean)
        .join(" ");
      const res = await apiPost<{ imageUrl: string }>("/api/generate/scene-image", {
        character: characterId,
        // Portrait visage (pas photo tenue fond blanc) pour laisser le décor changer.
        refPath: identityList.some((a) => a.relPath === "identity/portrait_front.png")
          ? "identity/portrait_front.png"
          : identityRef,
        prompt,
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
      const place = decor.trim() || "a lively city street";
      const prompt = [
        `Photorealistic medium shot of THIS exact person standing in ${place}.`,
        `The environment of ${place} fills the entire background (NOT a white studio).`,
        "Looking at camera, chest-up framing, natural daylight, high detail face.",
        "Only ONE person in frame, no twin, no clone, no white backdrop.",
      ].join(" ");
      const res = await apiPost<{ imageUrl: string }>("/api/generate/scene-image", {
        character: id,
        refPath: p.identityList.includes("identity/portrait_front.png")
          ? "identity/portrait_front.png"
          : p.identityRef,
        prompt,
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
    const base: Shot[] = preset.shots.map((ps) => {
      const { speakerSlot, ...s } = ps;
      const shot: Shot = { ...s, kind: s.kind ?? "video", status: null };
      // Assignation explicite du présentateur via speakerSlot (0 = principal, 1 = partenaire…).
      if (shot.kind !== "carousel" && typeof speakerSlot === "number") {
        shot.speakerId = cast[speakerSlot]?.id ?? characterId;
      }
      return shot;
    });
    // Préréglage duo : alternance automatique si aucun speakerSlot défini.
    if (preset.id === "duo" && cast.length > 1) {
      base.forEach((s, idx) => {
        if (s.kind !== "carousel" && !s.speakerId) s.speakerId = cast[idx % cast.length].id;
      });
    }
    // Carrousel : produit par défaut + durée déduite du temps/image.
    base.forEach((s) => {
      if (s.kind === "carousel") {
        if (!s.productId) s.productId = products[0]?.id ?? "";
        s.seconds = carouselDuration(s.perImage ?? 2.5, s.productId);
      }
    });
    setShots(base);
    if (preset.decor) { setDecor(preset.decor); resetMaster(); }
    // Ratio imposé par le style (ex. plateau TV 16:9) — invalide l'image de référence.
    if (preset.aspect && model?.aspectRatios.includes(preset.aspect)) {
      setAspect(preset.aspect);
      resetMaster();
    }
  }

  function addShot() {
    setShots((prev) => [...prev, { title: `Plan ${prev.length + 1}`, prompt: "", seconds: model?.defaultSeconds ?? 6, status: null, kind: "video" }]);
  }

  function addCarousel() {
    const pid = products[0]?.id ?? "";
    const n = products[0]?.screens.length ?? 0;
    const perImage = 2.5;
    setShots((prev) => [
      ...prev,
      {
        title: `Démo produit (carrousel)`,
        prompt: "",
        seconds: Math.max(2, Math.round(perImage * (n || 1))),
        status: null,
        kind: "carousel",
        productId: pid,
        perImage,
      },
    ]);
  }

  // Recalcule la durée totale d'un carrousel = temps/image × nombre de captures.
  function carouselDuration(perImage: number, productId?: string): number {
    const n = products.find((p) => p.id === productId)?.screens.length ?? 0;
    return Math.max(2, +(perImage * (n || 1)).toFixed(1));
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
    update(i, { status: "Envoi…", videoUrl: null, syncedUrl: null, error: null });
    if (timers.current[i]) clearInterval(timers.current[i]);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/carousel", {
        product: shot.productId,
        seconds: shot.seconds,
        secondsPerImage: shot.perImage ?? 2.5,
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
    // Passant (micro-trottoir) : text→vidéo, pas besoin d'image d'identité.
    if (shot.role === "guest") return true;
    if (!needsStartImage) return true;
    const ref = speakerRef(shot);
    return Boolean(ref.imageUrl || (ref.assetPaths && ref.assetPaths.length));
  }

  const guestModelId =
    models.find((m) => m.id === "fal-ai/kling-video/v2/master/text-to-video")?.id ??
    models.find((m) => m.mode === "text-to-video")?.id;

  async function generateShot(i: number) {
    const shot = shots[i];
    if (shot.kind === "carousel") return generateCarousel(i);
    if (!shot.prompt) return;
    update(i, { status: "Envoi…", videoUrl: null, syncedUrl: null, error: null });
    if (timers.current[i]) clearInterval(timers.current[i]);
    try {
      // Passant : text→vidéo (pas d'identité SDK → pas de clone du présentateur).
      if (shot.role === "guest") {
        if (!guestModelId) {
          update(i, { status: null, error: "Aucun modèle text→vidéo disponible pour le passant" });
          return;
        }
        const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/video", {
          model: guestModelId,
          prompt: shot.prompt,
          seconds: shot.seconds,
          aspectRatio: aspect,
        });
        refreshBudget();
        poll(i, sub);
        return;
      }
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

  // --- Voix + lip-sync PAR PLAN ---
  async function makeShotVoice(i: number) {
    const shot = shots[i];
    const line = (shot.line ?? "").trim();
    if (!line) return update(i, { voiceError: "Écris d'abord la réplique de ce plan" });
    // Passant : voix générique (pas celle du présentateur SDK).
    const speaker = shot.role === "guest" ? undefined : (shot.speakerId ?? characterId);
    update(i, { voiceBusy: true, voiceError: null });
    try {
      const res = await apiPost<{ dataUrl: string }>("/api/generate/voice", {
        text: line,
        ...(speaker ? { character: speaker } : {}),
      });
      update(i, { audioUrl: res.dataUrl, voiceBusy: false });
      refreshBudget();
    } catch (e) {
      update(i, { voiceBusy: false, voiceError: e instanceof Error ? e.message : "Échec de la voix" });
    }
  }

  function pollSync(i: number, sub: { requestId: string; model: string }) {
    update(i, { syncStatus: "En file…", syncRequestId: sub.requestId, syncModel: sub.model });
    syncTimers.current[i] = setInterval(async () => {
      try {
        const r = await apiPost<{ status: string; videoUrl?: string; error?: string }>("/api/generate/status", {
          model: sub.model,
          requestId: sub.requestId,
        });
        update(i, { syncStatus: r.status });
        if (r.status === "FAILED") {
          clearInterval(syncTimers.current[i]);
          update(i, { syncStatus: null, syncError: r.error ? `Échec : ${r.error}` : "Échec du lip-sync" });
          return;
        }
        if (r.status === "COMPLETED") {
          clearInterval(syncTimers.current[i]);
          update(i, { syncStatus: r.videoUrl ? "Terminé" : "Terminé (pas d'URL)", syncedUrl: r.videoUrl ?? null });
        }
      } catch (e) {
        clearInterval(syncTimers.current[i]);
        update(i, { syncStatus: null, syncError: e instanceof Error ? e.message : "Erreur" });
      }
    }, 4000);
  }

  async function syncShot(i: number) {
    const shot = shots[i];
    if (!shot.videoUrl || !shot.audioUrl) return;
    update(i, { syncStatus: "Envoi…", syncedUrl: null, syncError: null });
    if (syncTimers.current[i]) clearInterval(syncTimers.current[i]);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/lipsync", {
        model: "veed/lipsync",
        videoUrl: shot.videoUrl,
        audioUrl: shot.audioUrl,
        seconds: shot.seconds,
      });
      refreshBudget();
      pollSync(i, sub);
    } catch (e) {
      update(i, { syncStatus: null, syncError: e instanceof Error ? e.message : "Erreur" });
    }
  }

  // Carrousel : colle la voix off (narration) sur le diaporama silencieux (mux audio+vidéo).
  async function mergeCarouselAudio(i: number) {
    const shot = shots[i];
    if (!shot.videoUrl || !shot.audioUrl) return;
    update(i, { syncStatus: "Envoi…", syncedUrl: null, syncError: null });
    if (syncTimers.current[i]) clearInterval(syncTimers.current[i]);
    try {
      const sub = await apiPost<{ requestId: string; model: string }>("/api/generate/merge-audio", {
        videoUrl: shot.videoUrl,
        audioUrl: shot.audioUrl,
        seconds: shot.seconds,
      });
      refreshBudget();
      pollSync(i, sub);
    } catch (e) {
      update(i, { syncStatus: null, syncError: e instanceof Error ? e.message : "Erreur" });
    }
  }

  // Pour l'assemblage : on préfère la version sonorisée (lip-syncée) si elle existe.
  const readyClips = shots
    .filter((s) => s.syncedUrl || s.videoUrl)
    .map((s) => (s.syncedUrl ?? s.videoUrl) as string);
  // Plans vidéo générés mais sans voix synchronisée (le carrousel + les plans marqués
  // "muet volontaire" sont exclus, ils ne doivent pas déclencher l'alerte).
  const silentShots = shots.filter(
    (s) => s.kind !== "carousel" && !s.silent && s.videoUrl && !s.syncedUrl,
  );

  async function assemble() {
    // Garde-fou : mieux vaut faire voix + lip-sync PAR PLAN avant d'assembler
    // (le lip-sync sur le montage final ne sait pas qui parle sur quel plan).
    if (silentShots.length > 0) {
      const ok = await confirm({
        title: "Assembler sans toutes les voix ?",
        message:
          `${silentShots.length} plan(s) n'ont pas encore de voix synchronisée (` +
          `${silentShots.map((s) => s.title).join(", ")}).\n\n` +
          "Conseil : génère la voix + lip-sync SUR CHAQUE PLAN (bloc « Voix & lip-sync ») avant d'assembler — " +
          "c'est le seul moyen que chaque personne dise son texte. Le lip-sync sur la vidéo déjà montée ne peut pas séparer les intervenants.\n\n" +
          "Assembler quand même ? Les plans concernés resteront muets.",
        confirmLabel: "Assembler quand même",
      });
      if (!ok) return;
    }
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
            // Transmet le montage au Studio Lip-sync (source vidéo pré-remplie).
            if (r.videoUrl) setLastVideo(characterId, r.videoUrl, totalSeconds);
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
        subtitle="Micro-trottoir (présentateur + passant), plateau produit, multi-plans. Identité une fois, puis voix + lip-sync par plan, puis assemblage."
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
        <div className="min-w-[280px] flex-1">
          <label className="label">Style de scène</label>
          <select className="select" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            <optgroup label="—— Extérieurs ——">
              {PRESETS.filter((p) => p.group === "extérieurs").map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="—— Studio / intérieur ——">
              {PRESETS.filter((p) => p.group === "studio").map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="—— Multi-présentateurs ——">
              {PRESETS.filter((p) => p.group === "multi").map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Choisis un style puis clique « Charger ce style » ({PRESETS.length} styles).
          </p>
        </div>
        <button className="btn btn-primary" onClick={loadPreset}>Charger ce style</button>
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
            Choisis le <strong>présentateur principal</strong>, puis son identité / tenue / décor. Tous les plans de ce
            présentateur partent de la même image de référence.
          </p>

          <div className="mb-4 max-w-sm">
            <label className="label">Présentateur principal</label>
            <select
              className="select"
              value={characterId}
              onChange={(e) => {
                const next = e.target.value;
                if (!next || next === characterId) return;
                // S'il était en second rôle, on le retire du casting pour éviter le doublon.
                setPartners((prev) => prev.filter((p) => p.characterId !== next));
                setCharacterId(next);
              }}
              disabled={characters.length === 0}
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  🎤 {c.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Change ici pour Tom (ou un autre) — ce choix devient aussi le personnage actif de l&apos;app.
            </p>
          </div>

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
                      {LOCATION_PRESETS.map((l) => (
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
            🔇 Ce moteur est muet. Pour chaque plan : écris la <strong>réplique</strong>, génère la <strong>voix du présentateur assigné</strong>,
            puis <strong>synchronise les lèvres</strong>. L&apos;assemblage utilisera automatiquement les plans <strong>sonorisés</strong>.
            {cast.length > 1 && " Chaque présentateur garde ainsi sa propre voix, et les lèvres restent nettes (1 visage continu par plan)."}
          </p>
        </div>
      )}

      {/* 3) Les plans : uniquement l'action + la durée */}
      <div className="space-y-4">
        {shots.map((shot, i) => (
          <div key={i} className="card p-5">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <input
                className="input flex-1 min-w-[160px]"
                value={shot.title}
                onChange={(e) => update(i, { title: e.target.value })}
              />
              {shot.kind !== "carousel" && (
                <select
                  className="select w-44"
                  value={shot.role === "guest" ? "guest" : "host"}
                  onChange={(e) => {
                    const role = e.target.value === "guest" ? "guest" : "host";
                    update(i, {
                      role,
                      // Passant : plus de speaker SDK (voix générique).
                      ...(role === "guest" ? { speakerId: undefined } : {}),
                    });
                  }}
                  title="Présentateur = identité SDK. Passant = text→vidéo sans clone."
                >
                  <option value="host">🎤 Présentateur</option>
                  <option value="guest">🚶 Passant</option>
                </select>
              )}
              {shot.kind !== "carousel" && shot.role !== "guest" && cast.length > 1 && (
                <select
                  className="select w-40"
                  value={shot.speakerId ?? characterId}
                  onChange={(e) => update(i, { speakerId: e.target.value })}
                  title={
                    shot.startImageUrl
                      ? "Qui parle sur ce plan (choisit la voix — l'image duo reste inchangée)"
                      : "Présentateur (voix + visage) de ce plan"
                  }
                >
                  {cast.map((c) => <option key={c.id} value={c.id}>🎤 {c.name}</option>)}
                </select>
              )}
              {shot.kind !== "carousel" && (
                <select
                  className="select w-24"
                  value={shot.seconds}
                  onChange={(e) => update(i, { seconds: Number(e.target.value) })}
                >
                  {(model?.seconds ?? [5, 6, 8, 10]).map((s) => <option key={s} value={s}>{s}s</option>)}
                </select>
              )}
              <button className="btn btn-ghost" onClick={() => remove(i)}>✕</button>
            </div>
            {shot.role === "guest" && (
              <p className="text-xs text-[var(--muted)] mb-2">
                Plan passant : généré en text→vidéo (visage aléatoire, 1 personne). Pas besoin de référence d&apos;identité.
              </p>
            )}
            {shot.kind === "carousel" ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-3 space-y-3">
                <p className="text-xs text-[var(--muted)]">
                  📱 Diaporama de tes <strong>vraies captures d&apos;écran</strong> (pas d&apos;IA). Règle le
                  <strong> temps par image</strong> pour que ça ne défile pas trop vite. Place ce plan entre deux plans
                  du présentateur (intro / conclusion).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Produit</label>
                    <select
                      className="select"
                      value={shot.productId ?? ""}
                      onChange={(e) =>
                        update(i, {
                          productId: e.target.value,
                          seconds: carouselDuration(shot.perImage ?? 2.5, e.target.value),
                        })
                      }
                    >
                      {products.length === 0 && <option value="">Aucun produit — ajoute des captures dans Produits / Apps</option>}
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.screens.length} captures)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Temps par image</label>
                    <select
                      className="select"
                      value={shot.perImage ?? 2.5}
                      onChange={(e) => {
                        const perImage = Number(e.target.value);
                        update(i, { perImage, seconds: carouselDuration(perImage, shot.productId) });
                      }}
                    >
                      {[1, 1.5, 2, 2.5, 3, 4, 5].map((s) => (
                        <option key={s} value={s}>{s}s / image</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {(() => {
                    const n = products.find((p) => p.id === shot.productId)?.screens.length ?? 0;
                    return n > 0
                      ? `${n} capture${n > 1 ? "s" : ""} × ${shot.perImage ?? 2.5}s ≈ durée totale ${carouselDuration(shot.perImage ?? 2.5, shot.productId)}s.`
                      : "Sélectionne un produit avec des captures.";
                  })()}
                </p>
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
                  title={
                    !shotReady(shot)
                      ? "Génère d'abord la référence de ce présentateur"
                      : shot.role === "guest"
                        ? "Passant : text→vidéo (sans identité SDK)"
                        : ""
                  }
                >
                  {shot.role === "guest" ? "Générer le passant" : "Générer ce plan"}
                </button>
              )}
            </div>
            {shot.videoUrl && !shot.syncedUrl && (
              <video src={shot.videoUrl} controls className="w-full rounded-lg border border-[var(--border)] mt-3 max-h-64" />
            )}

            {shot.kind === "carousel" && (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">🎙️ Voix off (pendant le défilement)</span>
                  <div className="flex items-center gap-2">
                    {shot.syncedUrl && <span className="badge text-[var(--success)]">carrousel sonorisé ✓</span>}
                    <label className="flex items-center gap-1 text-xs text-[var(--muted)] cursor-pointer" title="Le carrousel reste sans voix (pas d'alerte).">
                      <input
                        type="checkbox"
                        checked={!!shot.silent}
                        onChange={(e) => update(i, { silent: e.target.checked })}
                      />
                      🔇 pas de voix
                    </label>
                  </div>
                </div>
                {shot.silent ? (
                  <p className="text-xs text-[var(--muted)]">Carrousel sans voix off — il défilera en silence.</p>
                ) : (
                  <>
                    {characters.length > 1 && (
                      <div>
                        <label className="label">Voix off — qui parle&nbsp;?</label>
                        <select
                          className="select w-56"
                          value={shot.speakerId ?? characterId}
                          onChange={(e) => update(i, { speakerId: e.target.value })}
                          title="Choisis le présentateur qui narre le carrousel (sa voix)"
                        >
                          {characters.map((c) => (
                            <option key={c.id} value={c.id}>🎤 {c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <textarea
                      className="input min-h-[56px]"
                      value={shot.line ?? ""}
                      onChange={(e) => update(i, { line: e.target.value })}
                      placeholder={`Texte lu en voix off par ${nameOf(shot.speakerId ?? characterId)} pendant le carrousel…`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="btn btn-ghost"
                        disabled={!ready || !(shot.line ?? "").trim() || shot.voiceBusy}
                        onClick={() => makeShotVoice(i)}
                      >
                        {shot.voiceBusy ? "Voix…" : shot.audioUrl ? "Regénérer la voix off" : "1) Générer la voix off"}
                      </button>
                      {shot.audioUrl && <audio src={shot.audioUrl} controls className="h-8" />}
                      <button
                        className="btn btn-primary"
                        disabled={
                          !ready ||
                          !shot.videoUrl ||
                          !shot.audioUrl ||
                          (!!shot.syncStatus && !shot.syncedUrl && !shot.syncError)
                        }
                        onClick={() => mergeCarouselAudio(i)}
                        title={!shot.videoUrl ? "Génère d'abord le carrousel" : !shot.audioUrl ? "Génère d'abord la voix off" : ""}
                      >
                        {shot.syncStatus && !shot.syncedUrl && !shot.syncError ? "Ajout…" : "2) Ajouter la voix off"}
                      </button>
                    </div>
                    {shot.voiceError && <p className="text-xs text-[var(--danger)]">{shot.voiceError}</p>}
                    {shot.syncError && <p className="text-xs text-[var(--danger)]">{shot.syncError}</p>}
                    {!shot.syncError && shot.syncStatus && !shot.syncedUrl && (
                      <p className="text-xs text-[var(--muted)] animate-pulse">Voix off : {shot.syncStatus}</p>
                    )}
                    {shot.syncedUrl && (
                      <div>
                        <p className="text-xs text-[var(--muted)] mb-1">Carrousel avec voix off (utilisé pour l&apos;assemblage) :</p>
                        <video src={shot.syncedUrl} controls className="w-full rounded-lg border border-[var(--border)] max-h-64" />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {shot.kind !== "carousel" && model?.audio !== "native" && (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    🎙️ Voix &amp; lip-sync —{" "}
                    {shot.role === "guest" ? "passant (voix générique)" : nameOf(shot.speakerId ?? characterId)}
                  </span>
                  {shot.syncedUrl && <span className="badge text-[var(--success)]">plan sonorisé ✓</span>}
                </div>
                <textarea
                  className="input min-h-[56px]"
                  value={shot.line ?? ""}
                  onChange={(e) => update(i, { line: e.target.value })}
                  placeholder={
                    shot.role === "guest"
                      ? "Réplique dite par le passant dans ce plan…"
                      : `Réplique dite par ${nameOf(shot.speakerId ?? characterId)} dans ce plan…`
                  }
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="btn btn-ghost"
                    disabled={!ready || !(shot.line ?? "").trim() || shot.voiceBusy}
                    onClick={() => makeShotVoice(i)}
                  >
                    {shot.voiceBusy ? "Voix…" : shot.audioUrl ? "Regénérer la voix" : "1) Générer la voix"}
                  </button>
                  {shot.audioUrl && <audio src={shot.audioUrl} controls className="h-8" />}
                  <button
                    className="btn btn-primary"
                    disabled={
                      !ready ||
                      !shot.videoUrl ||
                      !shot.audioUrl ||
                      (!!shot.syncStatus && !shot.syncedUrl && !shot.syncError)
                    }
                    onClick={() => syncShot(i)}
                    title={!shot.videoUrl ? "Génère d'abord le plan" : !shot.audioUrl ? "Génère d'abord la voix" : ""}
                  >
                    {shot.syncStatus && !shot.syncedUrl && !shot.syncError ? "Lip-sync…" : "2) Synchroniser les lèvres"}
                  </button>
                </div>
                {shot.voiceError && <p className="text-xs text-[var(--danger)]">{shot.voiceError}</p>}
                {shot.syncError && <p className="text-xs text-[var(--danger)]">{shot.syncError}</p>}
                {!shot.syncError && shot.syncStatus && !shot.syncedUrl && (
                  <p className="text-xs text-[var(--muted)] animate-pulse">Lip-sync : {shot.syncStatus}</p>
                )}
                {shot.syncedUrl && (
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-1">Plan avec voix (utilisé pour l&apos;assemblage) :</p>
                    <video src={shot.syncedUrl} controls className="w-full rounded-lg border border-[var(--border)] max-h-64" />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {shots.length > 0 && (
        <div className="card p-5 mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-[var(--muted)]">
            {shots.length} plans · {totalSeconds}s au total ·{" "}
            <span className="text-[var(--foreground)] font-semibold">budget estimé {usd(totalCost)}</span>
            {totalSeconds < 60 && <span className="ml-2 text-[var(--muted)]">(vise ~60s)</span>}
            {silentShots.length > 0 && (
              <span className="mt-1 block text-[var(--danger)]">
                {silentShots.length} plan{silentShots.length > 1 ? "s" : ""} sans voix (
                {silentShots.map((s) => s.title).join(", ")}) — {silentShots.length > 1 ? "ils resteront muets" : "il restera muet"} dans le montage.
                Génère la voix + lip-sync sur {silentShots.length > 1 ? "ces plans" : "ce plan"}, ou ignore si {silentShots.length > 1 ? "ce sont" : "c'est"} volontaire.
              </span>
            )}
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
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <a href={mergedUrl} target="_blank" rel="noreferrer" className="btn btn-ghost flex-1">
                  Ouvrir / Télécharger
                </a>
                <Link href="/lipsync" className="btn btn-primary flex-1">
                  Ajouter la voix (Lip-sync) →
                </Link>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Le montage est envoyé au Studio Lip-sync comme vidéo source. ⚠️ Le lip-sync fonctionne mieux sur
                un plan unique face caméra : sur un montage à plusieurs plans/coupures, la synchro des lèvres
                peut être imparfaite. Pour un résultat net, applique plutôt le lip-sync plan par plan.
              </p>
              <SendToAiccos videoUrl={mergedUrl} defaultTitle={`${characterName || "Storyboard"} — clip assemblé`} />
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

import { finalizeVideoScript } from "@/domain/script";
import {
  makeScriptChain,
  makeValidScriptCandidate,
} from "@/domain/script/__tests__/fixtures";
import type { CharacterCapabilitiesSnapshot } from "../runtime-capabilities";
import type { ArtAnalysisCandidate, SegmentVisualDirection } from "../visual-direction";

export function makeArtChain(options: { withCharacter?: boolean } = {}) {
  const chain = makeScriptChain();
  let brief = chain.brief;
  if (options.withCharacter) {
    brief = { ...brief, characterId: "char-generic-01" };
  }
  const videoScript = finalizeVideoScript({
    brief,
    marketingPlan: chain.marketingPlan,
    creativeConcept: chain.creativeConcept,
    candidate: makeValidScriptCandidate(),
    metadata: {
      id: "script-1",
      createdBy: "tester",
      correlationId: "corr-script-1",
    },
  });
  return {
    brief,
    marketingPlan: chain.marketingPlan,
    creativeConcept: chain.creativeConcept,
    videoScript,
  };
}

export function makeGenericSnapshot(
  overrides: Partial<CharacterCapabilitiesSnapshot> = {},
): CharacterCapabilitiesSnapshot {
  return {
    characterId: "char-generic-01",
    snapshotVersion: "1.0.0",
    availableOutfits: [
      { id: "outfit-casual", label: "Casual day", tags: ["casual", "day"] },
      { id: "outfit-smart", label: "Smart casual", tags: ["smart"] },
    ],
    availableExpressions: [
      { id: "expression:smile", label: "smile", tags: [] },
      { id: "expression:neutral", label: "neutral", tags: [] },
    ],
    availablePoses: [
      { id: "pose:standing", label: "standing", tags: [] },
      { id: "pose:talking", label: "talking", tags: [] },
    ],
    availableReferences: [
      { id: "reference:face-front", label: "face-front", tags: ["identity"] },
    ],
    supportsVoiceReference: true,
    ...overrides,
  };
}

function segmentDirection(
  scriptSegmentId: string,
  id: string,
  opts: {
    withCharacter?: boolean;
    continuityKey?: string;
    outfitId?: string;
    textSafeArea?: SegmentVisualDirection["composition"]["textSafeArea"];
  } = {},
): SegmentVisualDirection {
  const base: SegmentVisualDirection = {
    id,
    scriptSegmentId,
    location: {
      kind: "exterior",
      description: "Rue urbaine claire, mobilité partagée visible en arrière-plan.",
      timeOfDay: "day",
      continuityKey: opts.continuityKey ?? "city-street",
    },
    camera: {
      shotSize: "medium",
      angle: "eye_level",
      movement: "static",
      depthOfField: "medium",
      intent: "Mettre le personnage et le bénéfice au centre du cadre.",
    },
    lighting: {
      source: "natural",
      quality: "soft",
      temperature: "neutral",
      contrast: "medium",
      intent: "Lumière diurne douce et crédible.",
    },
    environment: {
      description: "Environnement urbain propre, sans clutter concurrentiel.",
      productVisibility: "secondary",
      clutterLevel: "minimal",
    },
    composition: {
      subjectPosition: "left_third",
      lookDirection: "camera",
      visualHierarchy: "sujet puis produit puis texte",
      textSafeArea: opts.textSafeArea ?? "bottom",
      productPlacement: "écran téléphone en main secondaire",
    },
    transitionIntent: "cut",
  };
  if (opts.withCharacter) {
    base.character = {
      characterId: "char-generic-01",
      outfitId: opts.outfitId ?? "outfit-casual",
      expressionId: "expression:smile",
      poseId: "pose:talking",
      framingIntent: "Talking head amical, regard caméra.",
    };
  }
  return base;
}

export function makeValidArtCandidate(
  scriptSegmentIds: string[],
  options: {
    withCharacter?: boolean;
    overrides?: Partial<ArtAnalysisCandidate>;
  } = {},
): ArtAnalysisCandidate {
  const withCharacter = options.withCharacter ?? false;
  const segments = scriptSegmentIds.map((sid, i) =>
    segmentDirection(sid, `vd-${i + 1}`, {
      withCharacter,
      textSafeArea: i === 2 ? "bottom" : "none",
    }),
  );
  // seg-3 has screenText in fixtures — ensure safe area
  const withSafe = segments.map((s) => {
    if (s.scriptSegmentId === "seg-3") {
      return {
        ...s,
        composition: { ...s.composition, textSafeArea: "bottom" as const },
      };
    }
    return s;
  });

  return {
    globalStyle: {
      style: "commercial",
      mood: "énergique et rassurant",
      realism: "photorealistic",
      colorIntent: "Bleus frais et accents vifs pour la mobilité urbaine.",
      brandAlignment:
        "Soutient la grande idée : transformer l'attente urbaine en départ immédiat pour arriver plus vite.",
    },
    palette: [
      { name: "primary", hex: "#0B5FFF", role: "primary" },
      { name: "secondary", hex: "#1A2332", role: "secondary" },
      { name: "accent", hex: "#FF6A3D", role: "accent" },
      { name: "background", hex: "#F5F7FA", role: "background" },
      { name: "text", hex: "#121826", role: "text" },
    ],
    continuityRules: [
      {
        id: "cr-outfit",
        scope: "outfit",
        description: "Tenue stable sur tous les segments avec personnage.",
        appliesToSegmentIds: withSafe.map((s) => s.id),
        severity: "required",
      },
      {
        id: "cr-loc",
        scope: "location",
        description: "Lieu stable city-street sauf rupture intentionnelle documentée.",
        appliesToSegmentIds: withSafe.map((s) => s.id),
        severity: "preferred",
      },
    ],
    segments: withSafe,
    assumptions: [
      {
        id: "art-a1",
        statement: "La palette bleue est une hypothèse visuelle, pas une couleur officielle de marque.",
        status: "explicit",
        affectsFields: ["palette"],
      },
    ],
    ...options.overrides,
  };
}

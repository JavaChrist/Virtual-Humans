/**
 * Injected fake analyzers for DIRECTOR_V2_E2E_FAKE_MODE (Phase 8 / 8G-B).
 * Deterministic candidates — no network, no OpenAI.
 * Not a second business implementation: same ports as production injection.
 */

import type { MarketingAnalyzerPort } from "@/application/directors/marketing";
import type { CreativeAnalyzerPort } from "@/application/directors/creative/analyzer-port";
import { creativeFailure } from "@/application/directors/creative/failures";
import { MarketingAnalyzerError } from "@/application/directors/marketing/failures";
import type { ScriptAnalyzerPort } from "@/application/directors/script/analyzer-port";
import type { ArtAnalyzerPort } from "@/application/directors/art/analyzer-port";
import type { StoryboardAnalyzerPort } from "@/application/directors/storyboard/analyzer-port";
import type { MarketingAnalysisCandidate } from "@/domain/marketing";
import type { CreativeAnalysisCandidate } from "@/domain/creative";
import type { ScriptAnalysisCandidate } from "@/domain/script";
import type { ArtAnalysisCandidate } from "@/domain/art";
import type { StoryboardAnalysisCandidate } from "@/domain/storyboard";
import { SCRIPT_PURPOSE_TO_SCENE } from "@/domain/storyboard/scene";
import { defaultContinuityKeys } from "@/domain/storyboard/continuity";
import {
  getE2eRequestContext,
  type E2eCreativeFakeFailMode,
} from "./e2e-request-context";

export type E2eFakeAnalyzerBundle = {
  marketingAnalyzer: MarketingAnalyzerPort;
  creativeAnalyzer: CreativeAnalyzerPort;
  scriptAnalyzer: ScriptAnalyzerPort;
  artAnalyzer: ArtAnalyzerPort;
  storyboardAnalyzer: StoryboardAnalyzerPort;
};

function marketingCandidate(cta: string): MarketingAnalysisCandidate {
  return {
    marketingObjective: "conversion",
    primaryAudience: {
      label: "Navetteurs urbains E2E",
      description: "Audience synthétique pour parcours E2E local.",
      needs: ["gagner du temps", "fiabilité"],
      painPoints: ["attente longue", "imprévisibilité"],
    },
    mainProblem: "Les navetteurs perdent trop de temps à attendre un trajet fiable.",
    mainBenefit: "Arriver plus vite et avec moins de stress grâce à une mobilité partagée.",
    secondaryBenefits: ["Réservation en un geste"],
    uniqueSellingPoint: "Une mobilité partagée pensée pour réduire l'attente urbaine.",
    emotionalHook: "Et si votre trajet quotidien ne rimaait plus avec attente ?",
    videoStyle: "commercial",
    tone: "energetic",
    callToAction: cta,
    keyMessages: ["Moins d'attente", "Réservez en un geste"],
    successMetric: {
      kind: "conversion",
      description: "Téléchargements et premières réservations",
    },
    assumptions: [
      {
        id: "e2e-a1",
        statement: "Hypothèse synthétique E2E.",
        status: "explicit",
        affectsFields: ["mainBenefit"],
      },
    ],
  };
}

function creativeCandidate(): CreativeAnalysisCandidate {
  return {
    title: "Moins d'attente, plus de trajet",
    logline:
      "Un navetteur découvre qu'il peut arriver plus vite sans stress grâce à la mobilité partagée.",
    bigIdea:
      "Transformer l'attente urbaine en départ immédiat pour arriver plus vite et avec moins de stress.",
    narrativeApproach: "problem_solution",
    emotionalArc: [
      {
        order: 1,
        purpose: "attention",
        emotion: "frustration",
        description: "Reconnaître la perte de temps.",
      },
      {
        order: 2,
        purpose: "discovery",
        emotion: "espoir",
        description: "Découvrir la mobilité partagée.",
      },
      {
        order: 3,
        purpose: "desire",
        emotion: "envie",
        description: "Désirer arriver plus vite.",
      },
      {
        order: 4,
        purpose: "action",
        emotion: "détermination",
        description: "Passer à l'action via le CTA.",
      },
    ],
    openingDevice: {
      kind: "question",
      description: "Et si l'attente n'était plus le prix du trajet ?",
    },
    proofDevice: {
      kind: "demonstration",
      description: "Montrer le passage de l'attente au départ.",
    },
    endingDevice: {
      kind: "direct_address",
      description: "Renvoyer vers le CTA marketing.",
    },
    rhythm: "dynamic",
    referenceKeywords: ["energetic", "authentic"],
    assumptions: [
      {
        id: "e2e-c1",
        statement: "Contraste attente/départ lisible en 30s.",
        status: "explicit",
        affectsFields: ["bigIdea"],
      },
    ],
  };
}

function scriptCandidate(cta: string): ScriptAnalysisCandidate {
  const base = {
    emotion: "claire" as const,
    pauseAfterMs: 200,
    pronunciationNotes: [] as [],
  };
  return {
    title: "Moins d'attente",
    summary: "Narration E2E synthétique pour timing déterministe ~30s.",
    language: "fr",
    hookText: "Et si l'attente n'était plus le prix de votre trajet ?",
    callToActionText: cta,
    segments: [
      {
        ...base,
        id: "seg-1",
        order: 1,
        purpose: "hook",
        speaker: "character",
        dialogue: "Et si l'attente n'était plus le prix de votre trajet ?",
        emotion: "curieuse",
        pauseAfterMs: 250,
      },
      {
        ...base,
        id: "seg-2",
        order: 2,
        purpose: "problem",
        speaker: "voice_over",
        voiceOver: "Chaque jour, l'attente vole des minutes précieuses aux navetteurs.",
        emotion: "concernée",
      },
      {
        ...base,
        id: "seg-3",
        order: 3,
        purpose: "presentation",
        speaker: "character",
        dialogue: "Avec une mobilité partagée, vous partez plus vite, avec moins de stress.",
        screenText: "Arriver plus vite",
        emotion: "confiante",
      },
      {
        ...base,
        id: "seg-4",
        order: 4,
        purpose: "proof",
        speaker: "voice_over",
        voiceOver: "Moins d'attente. Un départ plus simple. Un trajet plus fluide.",
        emotion: "rassurante",
      },
      {
        ...base,
        id: "seg-5",
        order: 5,
        purpose: "cta",
        speaker: "character",
        dialogue: cta.endsWith(".") ? cta : `${cta}.`,
        emotion: "déterminé",
        pauseAfterMs: 100,
      },
    ],
    assumptions: [
      {
        id: "e2e-s1",
        statement: "Profil speech FR acceptable pour spot E2E.",
        status: "explicit",
        affectsFields: ["timing"],
      },
    ],
  };
}

function artCandidate(scriptSegmentIds: string[]): ArtAnalysisCandidate {
  const segments = scriptSegmentIds.map((scriptSegmentId, i) => ({
    id: `vd-${i + 1}`,
    scriptSegmentId,
    location: {
      kind: "exterior" as const,
      description: "Rue urbaine claire, mobilité partagée visible.",
      timeOfDay: "day" as const,
      continuityKey: "city-street",
    },
    camera: {
      shotSize: "medium" as const,
      angle: "eye_level" as const,
      movement: "static" as const,
      depthOfField: "medium" as const,
      intent: "Sujet et bénéfice au centre.",
    },
    lighting: {
      source: "natural" as const,
      quality: "soft" as const,
      temperature: "neutral" as const,
      contrast: "medium" as const,
      intent: "Lumière diurne douce.",
    },
    environment: {
      description: "Environnement urbain propre.",
      productVisibility: "secondary" as const,
      clutterLevel: "minimal" as const,
    },
    composition: {
      subjectPosition: "left_third" as const,
      lookDirection: "camera" as const,
      visualHierarchy: "sujet puis produit puis texte",
      textSafeArea: (scriptSegmentId === "seg-3" ? "bottom" : "none") as
        | "bottom"
        | "none",
      productPlacement: "écran téléphone secondaire",
    },
    transitionIntent: "cut" as const,
  }));
  return {
    globalStyle: {
      style: "commercial",
      mood: "énergique et rassurant",
      realism: "photorealistic",
      colorIntent: "Bleus frais et accents vifs pour la mobilité urbaine.",
      brandAlignment:
        "Soutient la grande idée : transformer l'attente urbaine en départ immédiat.",
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
        id: "cr-loc",
        scope: "location",
        description: "Lieu stable city-street (E2E).",
        appliesToSegmentIds: segments.map((s) => s.id),
        severity: "preferred",
      },
    ],
    segments,
    assumptions: [
      {
        id: "e2e-art-1",
        statement: "Palette synthétique E2E.",
        status: "explicit",
        affectsFields: ["palette"],
      },
    ],
  };
}

function throwCreativeFakeFail(mode: E2eCreativeFakeFailMode): never {
  const code =
    mode === "provider_failed"
      ? ("request_failed" as const)
      : mode === "refused"
        ? ("refused" as const)
        : mode;
  throw new MarketingAnalyzerError(
    creativeFailure(code, {
      provider: "openai",
      internalCode: `e2e_fake_${mode}`,
      httpStatus: mode === "provider_failed" ? 502 : 200,
    }),
  );
}

/**
 * @param failStage when set, the named analyzer throws a public-safe error (E2E scenario 17).
 * @param creativeFail optional default Creative fail mode (overridden by request header).
 */
export function createE2eFakeDirectorAnalyzers(options?: {
  failStage?: "marketing" | "creative" | "script" | "art" | "storyboard";
  creativeFail?: E2eCreativeFakeFailMode;
}): E2eFakeAnalyzerBundle {
  const fail = options?.failStage;

  function maybeFail(stage: typeof fail): void {
    if (fail === stage) {
      if (stage === "creative") {
        throwCreativeFakeFail("provider_failed");
      }
      const err = new Error("E2E fake provider failure (synthetic).");
      (err as Error & { code?: string }).code = "provider_failed";
      throw err;
    }
  }

  return {
    marketingAnalyzer: {
      async analyze(req) {
        maybeFail("marketing");
        const cta =
          req.brief.callToAction?.trim() ||
          "Téléchargez l'app et réservez votre premier trajet";
        return { candidate: marketingCandidate(cta) };
      },
    },
    creativeAnalyzer: {
      async analyze() {
        const mode =
          getE2eRequestContext().creativeFail ?? options?.creativeFail;
        if (mode === "invalid_candidate") {
          // Domain hard-gate path (not provider_failed): forbidden imitation phrase.
          const bad = creativeCandidate();
          bad.bigIdea =
            "Transformer l'attente dans le style de Picasso en départ immédiat.";
          return { candidate: bad };
        }
        if (mode) {
          throwCreativeFakeFail(mode);
        }
        maybeFail("creative");
        return { candidate: creativeCandidate() };
      },
    },
    scriptAnalyzer: {
      async analyze(req) {
        maybeFail("script");
        const cta =
          req.marketingPlan.callToAction?.trim() ||
          "Téléchargez l'app et réservez votre premier trajet";
        return { candidate: scriptCandidate(cta) };
      },
    },
    artAnalyzer: {
      async analyze(req) {
        maybeFail("art");
        return { candidate: artCandidate(req.videoScript.segments.map((s) => s.id)) };
      },
    },
    storyboardAnalyzer: {
      async analyze(req) {
        maybeFail("storyboard");
        const { videoScript: script, visualDirection: visual } = req;
        const scenes: StoryboardAnalysisCandidate["scenes"] = [];
        let order = 1;
        for (const seg of [...script.segments].sort((a, b) => a.order - b.order)) {
          const vd = visual.segments.find((v) => v.scriptSegmentId === seg.id);
          if (!vd) continue;
          const keys = defaultContinuityKeys(visual, vd.id);
          const purpose =
            SCRIPT_PURPOSE_TO_SCENE[
              seg.purpose as keyof typeof SCRIPT_PURPOSE_TO_SCENE
            ] ?? "presentation";
          // spokenContent must mirror script text — silent scenes with dialogue fail finalize.
          // Prefer b_roll / voice_over_visual (simple t2v[+voice]) over talking_head lipsync chains
          // when the script segment is already voice_over; character dialogue stays talking_head.
          const spoken =
            seg.speaker === "character" && seg.dialogue
              ? { kind: "dialogue" as const, sourceText: seg.dialogue }
              : seg.speaker === "voice_over" && seg.voiceOver
                ? { kind: "voice_over" as const, sourceText: seg.voiceOver }
                : { kind: "none" as const };
          const intent =
            spoken.kind === "voice_over"
              ? ("voice_over_visual" as const)
              : spoken.kind === "dialogue"
                ? ("talking_head" as const)
                : ("b_roll" as const);
          scenes.push({
            id: `sc-${order}`,
            order: order++,
            title: purpose,
            purpose,
            scriptSegmentId: seg.id,
            visualDirectionSegmentId: vd.id,
            productionIntent: intent,
            spokenContent: spoken,
            references: [],
            transition: { type: "cut" },
            continuityKeys: keys,
            ...(seg.screenText ? { screenText: seg.screenText } : {}),
          });
        }
        if (scenes.length > 0) {
          scenes[scenes.length - 1]!.transition = { type: "none" };
        }
        return {
          candidate: {
          title: script.title,
          scenes,
          assumptions: [
            {
              id: "e2e-sb-1",
              statement: "Storyboard synthétique E2E 1:1 segments.",
              status: "explicit",
              affectsFields: ["scenes"],
            },
          ],
        },
        };
      },
    },
  };
}

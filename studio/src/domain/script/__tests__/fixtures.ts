import {
  makeCreativeBrief,
  makeMarketingPlan,
  makeValidCreativeCandidate,
} from "@/domain/creative/__tests__/fixtures";
import { finalizeCreativeConcept, type CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoProjectBrief } from "@/domain/brief";
import type { ScriptAnalysisCandidate, ScriptSegment } from "../video-script";

export function makeScriptBrief(
  overrides: Partial<VideoProjectBrief> = {},
): VideoProjectBrief {
  return makeCreativeBrief(overrides);
}

export function makeScriptMarketingPlan(
  brief: VideoProjectBrief = makeScriptBrief(),
): MarketingPlan {
  return makeMarketingPlan(brief);
}

export function makeScriptCreativeConcept(
  brief: VideoProjectBrief = makeScriptBrief(),
  plan: MarketingPlan = makeScriptMarketingPlan(brief),
): CreativeConcept {
  return finalizeCreativeConcept({
    brief,
    marketingPlan: plan,
    candidate: makeValidCreativeCandidate({
      bigIdea:
        "Transformer l'attente urbaine en départ immédiat pour arriver plus vite et avec moins de stress.",
    }),
    metadata: {
      id: "concept-1",
      createdBy: "tester",
      correlationId: "corr-concept-1",
    },
  });
}

function seg(
  partial: Omit<ScriptSegment, "pronunciationNotes" | "pauseAfterMs" | "emotion"> &
    Partial<Pick<ScriptSegment, "pronunciationNotes" | "pauseAfterMs" | "emotion">>,
): ScriptSegment {
  return {
    emotion: "claire",
    pauseAfterMs: 200,
    pronunciationNotes: [],
    ...partial,
  };
}

/**
 * Candidate sized for ~30s FR (within ±10%).
 * Timing is recalculated by the domain — keep spoken content moderate.
 */
export function makeValidScriptCandidate(
  overrides: Partial<ScriptAnalysisCandidate> = {},
): ScriptAnalysisCandidate {
  return {
    title: "Moins d'attente",
    summary:
      "Narration qui porte la grande idée : transformer l'attente en départ pour arriver plus vite.",
    language: "fr",
    hookText: "Et si l'attente n'était plus le prix de votre trajet ?",
    callToActionText: "Téléchargez l'app et réservez votre premier trajet",
    segments: [
      seg({
        id: "seg-1",
        order: 1,
        purpose: "hook",
        speaker: "character",
        dialogue: "Et si l'attente n'était plus le prix de votre trajet ?",
        emotion: "curieuse",
        pauseAfterMs: 250,
      }),
      seg({
        id: "seg-2",
        order: 2,
        purpose: "problem",
        speaker: "voice_over",
        voiceOver: "Chaque jour, l'attente vole des minutes précieuses aux navetteurs.",
        emotion: "concernée",
      }),
      seg({
        id: "seg-3",
        order: 3,
        purpose: "presentation",
        speaker: "character",
        dialogue: "Avec une mobilité partagée, vous partez plus vite, avec moins de stress.",
        screenText: "Arriver plus vite",
        emotion: "confiante",
      }),
      seg({
        id: "seg-4",
        order: 4,
        purpose: "proof",
        speaker: "voice_over",
        voiceOver: "Moins d'attente. Un départ plus simple. Un trajet plus fluide.",
        emotion: "rassurante",
      }),
      seg({
        id: "seg-5",
        order: 5,
        purpose: "cta",
        speaker: "character",
        dialogue: "Téléchargez l'app et réservez votre premier trajet.",
        emotion: "déterminé",
        pauseAfterMs: 100,
      }),
    ],
    assumptions: [
      {
        id: "s-a1",
        statement: "Le rythme oral FR du profil speech-fr-v1 est acceptable pour ce spot.",
        status: "explicit",
        affectsFields: ["timing"],
      },
    ],
    ...overrides,
  };
}

export function makeScriptChain() {
  const brief = makeScriptBrief();
  const marketingPlan = makeScriptMarketingPlan(brief);
  const creativeConcept = makeScriptCreativeConcept(brief, marketingPlan);
  return { brief, marketingPlan, creativeConcept };
}

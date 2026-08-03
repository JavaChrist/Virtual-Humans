import {
  makeBrief,
  makeValidCandidate as makeMarketingCandidate,
} from "@/domain/marketing/__tests__/fixtures";
import { finalizeMarketingPlan, type MarketingPlan } from "@/domain/marketing";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeAnalysisCandidate } from "../creative-concept";

export function makeCreativeBrief(
  overrides: Partial<VideoProjectBrief> = {},
): VideoProjectBrief {
  return makeBrief(overrides);
}

export function makeMarketingPlan(
  brief: VideoProjectBrief = makeCreativeBrief(),
  planOverrides: Partial<MarketingPlan> = {},
): MarketingPlan {
  const plan = finalizeMarketingPlan({
    brief,
    candidate: makeMarketingCandidate({
      marketingObjective: brief.objective,
      tone: brief.tone,
      callToAction:
        brief.callToAction ?? "Téléchargez l'app et réservez votre premier trajet",
      successMetric:
        brief.objective === "conversion"
          ? { kind: "conversion", description: "Conversions vidéo" }
          : { kind: "view", description: "Vues" },
    }),
    metadata: {
      id: "plan-1",
      createdBy: "tester",
      correlationId: "corr-plan-1",
    },
  });
  return { ...plan, ...planOverrides };
}

export function makeValidCreativeCandidate(
  overrides: Partial<CreativeAnalysisCandidate> = {},
): CreativeAnalysisCandidate {
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
        description: "Reconnaître la perte de temps dans l'attente.",
      },
      {
        order: 2,
        purpose: "discovery",
        emotion: "espoir",
        description: "Découvrir qu'une mobilité partagée réduit l'attente.",
      },
      {
        order: 3,
        purpose: "desire",
        emotion: "envie",
        description: "Désirer arriver plus vite au quotidien.",
      },
      {
        order: 4,
        purpose: "action",
        emotion: "détermination",
        description: "Se préparer à passer à l'action via le CTA marketing.",
      },
    ],
    openingDevice: {
      kind: "question",
      description: "Et si l'attente n'était plus le prix du trajet ?",
    },
    proofDevice: {
      kind: "demonstration",
      description: "Montrer le passage de l'attente au départ fluide.",
    },
    endingDevice: {
      kind: "direct_address",
      description: "Renvoyer vers le CTA marketing sans le reformuler.",
    },
    rhythm: "dynamic",
    referenceKeywords: ["energetic", "authentic", "technological"],
    assumptions: [
      {
        id: "c-a1",
        statement: "Le contraste attente/départ est compréhensible en 30 secondes.",
        status: "explicit",
        affectsFields: ["bigIdea"],
      },
    ],
    ...overrides,
  };
}

import { finalizeBrief, type VideoProjectBrief } from "@/domain/brief";
import type { MarketingAnalysisCandidate } from "../marketing-plan";

export function makeBrief(overrides: Partial<VideoProjectBrief> = {}): VideoProjectBrief {
  const draft = {
    draftVersion: "1.0.0",
    updatedAt: new Date().toISOString(),
    currentStep: 5,
    fields: {
      projectName: "Lancement RideCloud",
      subjectType: "product" as const,
      subjectName: "RideCloud",
      subjectDescription:
        "Application de mobilité partagée qui réduit le temps d'attente urbain pour les navetteurs.",
      objective: "conversion" as const,
      platform: "instagram" as const,
      durationSeconds: 30 as const,
      aspectRatio: "9:16" as const,
      language: "fr",
      tone: "energetic" as const,
      callToAction: "Téléchargez l'app et réservez votre premier trajet",
      audienceDescription:
        "Navetteurs urbains qui perdent du temps dans les transports et cherchent une alternative fiable.",
      brandConstraints: "Pas de comparaisons concurrentielles directes.",
      mediaReferences: [
        {
          id: "media-1",
          kind: "product_screen" as const,
          label: "Écran carte",
          uri: "/assets/map-screen.png",
        },
      ],
    },
  };
  const brief = finalizeBrief(draft, {
    id: "brief-1",
    projectId: "proj-1",
    createdBy: "tester",
    correlationId: "corr-brief-1",
  });
  return { ...brief, ...overrides, mediaReferences: overrides.mediaReferences ?? brief.mediaReferences };
}

export function makeValidCandidate(
  overrides: Partial<MarketingAnalysisCandidate> = {},
): MarketingAnalysisCandidate {
  return {
    marketingObjective: "conversion",
    primaryAudience: {
      label: "Navetteurs urbains",
      description: "Personnes qui perdent du temps dans les transports quotidiens.",
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
    callToAction: "Téléchargez l'app et réservez votre premier trajet",
    keyMessages: [
      "Moins d'attente pour vos trajets quotidiens",
      "Réservez en un geste",
    ],
    successMetric: {
      kind: "conversion",
      description: "Téléchargements et premières réservations issus de la vidéo",
    },
    assumptions: [
      {
        id: "a1",
        statement: "Les navetteurs valorisent surtout le gain de temps.",
        status: "explicit",
        affectsFields: ["mainBenefit"],
      },
    ],
    ...overrides,
  };
}

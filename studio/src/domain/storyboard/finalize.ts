import { createArtifactMetadata } from "@/domain/shared";
import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import { projectContinuity, defaultContinuityKeys } from "./continuity";
import { StoryboardDomainError } from "./errors";
import { normalizeStoryboardCandidate } from "./normalization";
import { StoryboardProjectSchema } from "./schemas";
import type { StoryboardScene } from "./scene";
import {
  STORYBOARD_PROJECT_SCHEMA_VERSION,
  type StoryboardAnalysisCandidate,
  type StoryboardAssumption,
  type StoryboardProject,
} from "./storyboard-project";
import { allocateStoryboardDurations } from "./timing";
import { rebuildStoryboardEvidence, validateCandidateAgainstSources } from "./validation";

export type FinalizeStoryboardInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  visualDirection: VisualDirection;
  candidate: StoryboardAnalysisCandidate;
  metadata: {
    id: string;
    createdBy: string;
    correlationId: string;
    createdAt?: string;
    revision?: number;
  };
};

export function finalizeStoryboardProject(input: FinalizeStoryboardInput): StoryboardProject {
  const brief = {
    ...input.brief,
    mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
  };
  const plan = JSON.parse(JSON.stringify(input.marketingPlan)) as MarketingPlan;
  const concept = JSON.parse(JSON.stringify(input.creativeConcept)) as CreativeConcept;
  const script = JSON.parse(JSON.stringify(input.videoScript)) as VideoScript;
  const visual = JSON.parse(JSON.stringify(input.visualDirection)) as VisualDirection;
  const normalized = normalizeStoryboardCandidate(input.candidate);

  const { issues, missingInformation } = validateCandidateAgainstSources(
    normalized,
    brief,
    plan,
    concept,
    script,
    visual,
  );
  const blocking = issues.filter((i) =>
    [
      "invariant_violation",
      "coverage_violation",
      "continuity_violation",
      "timing_invalid",
      "spoken_reconstruction_failed",
      "responsibility_leak",
      "technical_leak",
      "incoherent_with_sources",
      "invalid_candidate",
      "reference_unavailable",
    ].includes(i.code),
  );
  if (blocking.length > 0) {
    throw new StoryboardDomainError(
      "invalid_candidate",
      blocking[0]?.message ?? "Candidat storyboard invalide.",
      blocking[0]?.field,
    );
  }
  if (missingInformation.some((m) => m.required)) {
    throw new StoryboardDomainError(
      "missing_information",
      missingInformation.find((m) => m.required)?.message ?? "Information manquante.",
      missingInformation.find((m) => m.required)?.field,
    );
  }

  const timing = allocateStoryboardDurations(
    normalized.scenes.map((sc) => ({
      id: sc.id,
      order: sc.order,
      scriptSegmentId: sc.scriptSegmentId,
      spokenContent: sc.spokenContent,
      proposedDurationSeconds: sc.durationSeconds,
    })),
    script,
  );
  if (timing.status !== "exact") {
    throw new StoryboardDomainError(
      "timing_invalid",
      "Impossible d'allouer des durées exactes.",
      "timing",
    );
  }

  const durationById = new Map(
    timing.sceneTimings.map((t) => [t.sceneId, t.durationSeconds] as const),
  );

  const scenes: StoryboardScene[] = [...normalized.scenes]
    .sort((a, b) => a.order - b.order)
    .map((sc) => {
      const keys =
        sc.continuityKeys.length > 0
          ? sc.continuityKeys
          : defaultContinuityKeys(visual, sc.visualDirectionSegmentId);
      return {
        id: sc.id,
        order: sc.order,
        title: sc.title,
        purpose: sc.purpose,
        durationSeconds: durationById.get(sc.id)!,
        scriptSegmentId: sc.scriptSegmentId,
        visualDirectionSegmentId: sc.visualDirectionSegmentId,
        productionIntent: sc.productionIntent,
        spokenContent: sc.spokenContent,
        ...(sc.screenText ? { screenText: sc.screenText } : {}),
        references: sc.references,
        transition: sc.transition,
        continuityKeys: keys,
      };
    });

  const continuity = projectContinuity(
    visual,
    scenes,
    normalized.intentionalBreaks ?? [],
  );
  if (continuity.issues.length > 0) {
    throw new StoryboardDomainError(
      "continuity_violation",
      continuity.issues[0]!.message,
      continuity.issues[0]!.field,
    );
  }

  const evidence = rebuildStoryboardEvidence(brief, plan, concept, script, visual);
  const assumptions: StoryboardAssumption[] = [...(normalized.assumptions ?? [])];
  if (assumptions.length === 0) {
    assumptions.push({
      id: "assumption-sb-timing",
      statement:
        "Les durées de scènes sont allouées de façon déterministe à partir du timing script ; les propositions candidat sont ignorées si incohérentes.",
      status: "explicit",
      affectsFields: ["timing"],
    });
  }

  const rationale = {
    summary:
      "Storyboard de tournage aligné sur le script et la direction visuelle, durées recalculées.",
    decisions: [
      {
        field: "scenes",
        summary: `${scenes.length} scènes de production`,
        evidenceRefs: ["scriptSegments"],
      },
      {
        field: "timing",
        summary: `status=${timing.status}; total=${timing.totalSceneDurationSeconds}s`,
        evidenceRefs: ["targetDuration"],
      },
      {
        field: "continuity",
        summary: `${continuity.report.projectedRuleIds.length} règles projetées`,
        evidenceRefs: ["globalStyle"],
      },
    ],
  };

  const meta = createArtifactMetadata({
    id: input.metadata.id,
    projectId: script.projectId,
    createdBy: input.metadata.createdBy,
    correlationId: input.metadata.correlationId,
    createdAt: input.metadata.createdAt,
    revision: input.metadata.revision,
    schemaVersion: STORYBOARD_PROJECT_SCHEMA_VERSION,
  });

  const project: StoryboardProject = {
    ...meta,
    videoScriptRevisionId: script.id,
    visualDirectionRevisionId: visual.id,
    title: normalized.title,
    durationSeconds: script.targetDurationSeconds,
    aspectRatio: brief.aspectRatio,
    scenes,
    timing,
    continuity: continuity.report,
    assumptions,
    evidence,
    rationale,
  };

  const parsed = StoryboardProjectSchema.safeParse(project);
  if (!parsed.success) {
    throw new StoryboardDomainError(
      "invalid_storyboard",
      parsed.error.issues[0]?.message ?? "Storyboard invalide après finalisation.",
    );
  }

  return Object.freeze(JSON.parse(JSON.stringify(parsed.data)) as StoryboardProject);
}

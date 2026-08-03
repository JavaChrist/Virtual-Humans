import { createArtifactMetadata } from "@/domain/shared";
import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import type { StoryboardProject } from "@/domain/storyboard";
import { buildBlocksForScene } from "./builders";
import { profilesForProductionIntent } from "./capability-profiles";
import { PromptDomainError } from "./errors";
import { normalizePromptCandidate } from "./normalization";
import { renderAllVariants } from "./rendering";
import { ScenePackageSchema } from "./schemas";
import {
  SCENE_PACKAGE_ARTIFACT_TYPE,
  SCENE_PACKAGE_SCHEMA_VERSION,
  type PromptAnalysisCandidate,
  type PromptDirectorOutput,
  type PromptEvidence,
  type ScenePackage,
} from "./scene-package";
import {
  validateCandidateAgainstSources,
  validateFidelity,
  validatePackageCoverage,
} from "./validation";

export type FinalizePromptPackagesInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  visualDirection: VisualDirection;
  storyboard: StoryboardProject;
  candidate: PromptAnalysisCandidate;
  metadata: {
    createdBy: string;
    correlationId: string;
    createdAt?: string;
    revision?: number;
    /** Prefix for package ids; sceneId appended. */
    idPrefix?: string;
  };
};

function evidenceFor(
  script: VideoScript,
  visual: VisualDirection,
  storyboard: StoryboardProject,
): PromptEvidence[] {
  return [
    {
      field: "storyboardScenes",
      source: "storyboard",
      summary: `${storyboard.scenes.length} scènes couvertes.`,
    },
    {
      field: "globalStyle",
      source: "visual_direction",
      summary: `${visual.globalStyle.style} / ${visual.globalStyle.mood}`,
    },
    {
      field: "callToAction",
      source: "video_script",
      summary: script.callToAction.text.slice(0, 200),
    },
  ];
}

export function finalizePromptPackages(
  input: FinalizePromptPackagesInput,
): PromptDirectorOutput {
  const brief = {
    ...input.brief,
    mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
  };
  const plan = JSON.parse(JSON.stringify(input.marketingPlan)) as MarketingPlan;
  const concept = JSON.parse(JSON.stringify(input.creativeConcept)) as CreativeConcept;
  const script = JSON.parse(JSON.stringify(input.videoScript)) as VideoScript;
  const visual = JSON.parse(JSON.stringify(input.visualDirection)) as VisualDirection;
  const storyboard = JSON.parse(JSON.stringify(input.storyboard)) as StoryboardProject;
  const candidate = normalizePromptCandidate(input.candidate);

  const { issues, missingInformation } = validateCandidateAgainstSources(
    candidate,
    brief,
    plan,
    concept,
    script,
    visual,
    storyboard,
  );
  const blocking = issues.filter((i) =>
    [
      "invariant_violation",
      "coverage_violation",
      "constraint_contradiction",
      "fidelity_violation",
      "injection_blocked",
      "responsibility_leak",
      "technical_leak",
      "incoherent_with_sources",
      "invalid_candidate",
      "reference_unavailable",
    ].includes(i.code),
  );
  if (blocking.length > 0) {
    throw new PromptDomainError(
      "invalid_candidate",
      blocking[0]?.message ?? "Candidat prompt invalide.",
      blocking[0]?.field,
    );
  }
  if (missingInformation.some((m) => m.required)) {
    throw new PromptDomainError(
      "missing_information",
      missingInformation.find((m) => m.required)?.message ?? "Information manquante.",
      missingInformation.find((m) => m.required)?.field,
    );
  }

  const evidence = evidenceFor(script, visual, storyboard);
  const prefix = input.metadata.idPrefix ?? "pkg";
  const packages: ScenePackage[] = [];

  for (const scene of [...storyboard.scenes].sort((a, b) => a.order - b.order)) {
    const blocks = buildBlocksForScene({
      scene,
      brief,
      plan,
      script,
      visual,
      storyboard,
      candidate,
    });
    const profiles = profilesForProductionIntent(scene.productionIntent);
    const variants = renderAllVariants({
      sceneId: scene.id,
      language: script.language,
      profiles,
      blocks,
    });

    const meta = createArtifactMetadata({
      id: `${prefix}_${scene.id}`,
      projectId: storyboard.projectId,
      createdBy: input.metadata.createdBy,
      correlationId: input.metadata.correlationId,
      createdAt: input.metadata.createdAt,
      revision: input.metadata.revision,
      schemaVersion: SCENE_PACKAGE_SCHEMA_VERSION,
    });

    const assumptions = [
      ...(candidate.assumptions ?? []),
      {
        id: `pa_${scene.id}`,
        statement:
          "Les prompts rendus sont abstraits ; le Model Router choisira provider/modèle plus tard.",
        status: "explicit" as const,
        affectsFields: ["variants"],
      },
    ];

    const pkg: ScenePackage = {
      ...meta,
      artifactType: SCENE_PACKAGE_ARTIFACT_TYPE,
      storyboardRevisionId: storyboard.id,
      sceneId: scene.id,
      sceneOrder: scene.order,
      productionIntent: scene.productionIntent,
      subject: blocks.subject,
      action: blocks.action,
      environment: blocks.environment,
      camera: blocks.camera,
      lighting: blocks.lighting,
      style: blocks.style,
      composition: blocks.composition,
      ...(blocks.dialogue ? { dialogue: blocks.dialogue } : {}),
      ...(blocks.audio ? { audio: blocks.audio } : {}),
      ...(blocks.screenText ? { screenText: blocks.screenText } : {}),
      references: blocks.references,
      constraints: blocks.constraints,
      variants,
      assumptions,
      evidence,
      rationale: {
        summary: `ScenePackage pour ${scene.id} (${scene.productionIntent}).`,
        decisions: [
          {
            field: "variants",
            summary: `${variants.length} variantes abstraites`,
            evidenceRefs: ["storyboardScenes"],
          },
          {
            field: "dialogue",
            summary: blocks.dialogue ? "verbatim" : "none",
            evidenceRefs: ["storyboardScenes"],
          },
        ],
      },
    };

    const parsed = ScenePackageSchema.safeParse(pkg);
    if (!parsed.success) {
      throw new PromptDomainError(
        "invalid_package",
        parsed.error.issues[0]?.message ?? "ScenePackage invalide.",
        scene.id,
      );
    }

    const fidelity = validateFidelity(parsed.data, storyboard, script, visual);
    if (fidelity.length > 0) {
      throw new PromptDomainError(
        "fidelity_violation",
        fidelity[0]!.message,
        fidelity[0]!.field,
      );
    }

    packages.push(Object.freeze(JSON.parse(JSON.stringify(parsed.data)) as ScenePackage));
  }

  const coverage = validatePackageCoverage(packages, storyboard);
  if (coverage.length > 0) {
    throw new PromptDomainError("coverage_violation", coverage[0]!.message, coverage[0]!.field);
  }

  const output: PromptDirectorOutput = {
    storyboardRevisionId: storyboard.id,
    packages,
  };
  return Object.freeze(JSON.parse(JSON.stringify(output)) as PromptDirectorOutput);
}

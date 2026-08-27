/**
 * User-facing pipeline progress. Human labels only — no artifact types, flags, or providers.
 */

export const DIRECTOR_PIPELINE_STEPS = [
  { id: "brief", label: "Brief" },
  { id: "marketing", label: "Marketing" },
  { id: "creative", label: "Création" },
  { id: "script", label: "Script" },
  { id: "voice", label: "Voix" },
  { id: "art", label: "Art" },
  { id: "storyboard", label: "Storyboard" },
  { id: "prompt", label: "Prompts" },
  { id: "routing", label: "Routage" },
  { id: "production", label: "Production" },
  { id: "lipsync", label: "Lipsync" },
  { id: "merge", label: "Assemblage" },
  { id: "export", label: "Export" },
] as const;

export type DirectorPipelineStepId = (typeof DIRECTOR_PIPELINE_STEPS)[number]["id"];

export type DirectorPipelineStepState =
  | "done"
  | "current"
  | "locked"
  | "prepared_disabled";

export type DirectorPipelineStepView = {
  id: DirectorPipelineStepId;
  label: string;
  state: DirectorPipelineStepState;
  href: string;
};

export type DirectorPipelineProgressView = {
  steps: DirectorPipelineStepView[];
  currentLabel: string;
  summary: string;
  realRuntimeOff: true;
  mergeExportAuthorized: false;
  finalMediaProduced: false;
};

const HREF: Record<DirectorPipelineStepId, string> = {
  brief: "#section-brief",
  marketing: "#section-marketing_plan",
  creative: "#section-creative_concept",
  script: "#section-video_script",
  voice: "#section-voice",
  art: "#section-visual_direction",
  storyboard: "#section-storyboard_project",
  prompt: "#section-scene_package_set",
  routing: "#section-generation_plan",
  production: "#section-production_result",
  lipsync: "#section-lipsync",
  merge: "#section-merge-export",
  export: "#section-export_package",
};

export const DIRECTOR_ARTIFACT_LABELS: Record<string, string> = {
  video_project_brief: "Brief",
  marketing_plan: "Marketing",
  creative_concept: "Création",
  video_script: "Script",
  visual_direction: "Art",
  storyboard_project: "Storyboard",
  scene_package_set: "Prompts",
  generation_plan: "Routage",
  production_result: "Production",
  export_package: "Livraison",
};

export function humanArtifactLabel(type: string): string {
  return DIRECTOR_ARTIFACT_LABELS[type] ?? "étape précédente";
}

export function buildDirectorPipelineProgress(input: {
  hasBrief?: boolean;
  hasMarketing?: boolean;
  hasCreative?: boolean;
  hasScript?: boolean;
  hasVoiceChoice?: boolean;
  hasArt?: boolean;
  hasStoryboard?: boolean;
  hasPrompts?: boolean;
  hasRouting?: boolean;
  hasProduction?: boolean;
  lipsyncPrepared?: boolean;
  mergePrepared?: boolean;
  exportPrepared?: boolean;
}): DirectorPipelineProgressView {
  const done: Record<DirectorPipelineStepId, boolean> = {
    brief: input.hasBrief !== false,
    marketing: input.hasMarketing === true,
    creative: input.hasCreative === true,
    script: input.hasScript === true,
    voice: input.hasVoiceChoice === true,
    art: input.hasArt === true,
    storyboard: input.hasStoryboard === true,
    prompt: input.hasPrompts === true,
    routing: input.hasRouting === true,
    production: input.hasProduction === true,
    lipsync: input.lipsyncPrepared === true,
    merge: input.mergePrepared === true,
    export: input.exportPrepared === true,
  };

  let currentAssigned = false;
  const steps: DirectorPipelineStepView[] = DIRECTOR_PIPELINE_STEPS.map((step) => {
    const disabledTail = step.id === "lipsync" || step.id === "merge" || step.id === "export";
    if (done[step.id] && disabledTail) {
      return { ...step, state: "prepared_disabled", href: HREF[step.id] };
    }
    if (done[step.id]) {
      return { ...step, state: "done", href: HREF[step.id] };
    }
    if (!currentAssigned) {
      currentAssigned = true;
      return {
        ...step,
        state: disabledTail ? "prepared_disabled" : "current",
        href: HREF[step.id],
      };
    }
    return {
      ...step,
      state: disabledTail ? "prepared_disabled" : "locked",
      href: HREF[step.id],
    };
  });

  const current =
    steps.find((step) => step.state === "current") ??
    steps.find((step) => step.state === "prepared_disabled");
  const doneCount = steps.filter(
    (step) => step.state === "done" || step.state === "prepared_disabled",
  ).length;
  return {
    steps,
    currentLabel: current?.label ?? "Brief",
    summary: `${doneCount}/${steps.length} étapes prêtes. Runtime réel désactivé. Export réel non autorisé. Aucun média final.`,
    realRuntimeOff: true,
    mergeExportAuthorized: false,
    finalMediaProduced: false,
  };
}

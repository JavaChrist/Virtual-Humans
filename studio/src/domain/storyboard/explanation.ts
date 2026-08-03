import type { StoryboardEvidence, StoryboardProject, StoryboardRationale } from "./storyboard-project";

export function buildStoryboardRationale(
  evidence: StoryboardEvidence[],
  decisions: Array<{ field: string; summary: string }>,
): StoryboardRationale {
  const refs = evidence.map((e) => e.field);
  return {
    summary:
      "Contrat de tournage : scènes indépendantes, durées exactes, continuité projetée.",
    decisions: decisions.map((d) => ({
      field: d.field,
      summary: d.summary,
      evidenceRefs: refs.slice(0, 4),
    })),
  };
}

export type StoryboardProjectViewModel = {
  id: string;
  projectId: string;
  title: string;
  durationSeconds: number;
  aspectRatio: string;
  sceneCount: number;
  timingStatus: string;
  rationaleSummary: string;
};

export function toStoryboardProjectViewModel(
  project: StoryboardProject,
): StoryboardProjectViewModel {
  return {
    id: project.id,
    projectId: project.projectId,
    title: project.title,
    durationSeconds: project.durationSeconds,
    aspectRatio: project.aspectRatio,
    sceneCount: project.scenes.length,
    timingStatus: project.timing.status,
    rationaleSummary: project.rationale.summary,
  };
}

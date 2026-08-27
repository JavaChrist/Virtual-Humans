import type { DirectorPipelineStepId } from "./director-pipeline-progress-model";

export const DIRECTOR_STEP_READY_EVENT = "vhs-director-step-ready";

export type DirectorPipelineReadyStep = Exclude<DirectorPipelineStepId, "brief">;

export function announceDirectorStepReady(step: DirectorPipelineReadyStep): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DIRECTOR_STEP_READY_EVENT, { detail: { step } }),
  );
}

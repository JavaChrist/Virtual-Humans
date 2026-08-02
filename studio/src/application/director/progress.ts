/**
 * Director wizard step progress (VHS-112).
 */

export const DIRECTOR_BRIEF_STEPS = [
  { id: "project", label: "Projet et sujet" },
  { id: "objective", label: "Objectif et audience" },
  { id: "format", label: "Plateforme et format" },
  { id: "voice", label: "Ton, langue et personnage" },
  { id: "extras", label: "CTA et contraintes" },
  { id: "summary", label: "Récapitulatif" },
] as const;

export type DirectorBriefStepId = (typeof DIRECTOR_BRIEF_STEPS)[number]["id"];

export const DIRECTOR_BRIEF_STEP_COUNT = DIRECTOR_BRIEF_STEPS.length;

export function clampStep(step: number): number {
  if (!Number.isFinite(step) || step < 0) return 0;
  if (step >= DIRECTOR_BRIEF_STEP_COUNT) return DIRECTOR_BRIEF_STEP_COUNT - 1;
  return Math.floor(step);
}

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function autosaveStatusLabel(status: AutosaveStatus): string {
  switch (status) {
    case "idle":
      return "Aucun brouillon";
    case "dirty":
      return "Modification en cours";
    case "saving":
      return "Sauvegarde…";
    case "saved":
      return "Brouillon sauvegardé";
    case "error":
      return "Échec de la sauvegarde locale";
  }
}

/**
 * Debounce helper with injectable timers (testable).
 */
export function createDebouncer(
  delayMs: number,
  timers: {
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  } = { setTimeout, clearTimeout },
) {
  let handle: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule(fn: () => void) {
      if (handle != null) timers.clearTimeout(handle);
      handle = timers.setTimeout(() => {
        handle = null;
        fn();
      }, delayMs);
    },
    cancel() {
      if (handle != null) {
        timers.clearTimeout(handle);
        handle = null;
      }
    },
    flush(fn: () => void) {
      this.cancel();
      fn();
    },
  };
}

export const AUTOSAVE_DEBOUNCE_MS = 400;

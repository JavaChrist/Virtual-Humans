/**
 * Shared read-only status for text Director runs (8I-B fix).
 * Source of truth: public.director_runs — no new run engine.
 */

import { publicMessageForArtFailureCode } from "@/application/directors/art/failures";
import { publicMessageForCreativeFailureCode } from "@/application/directors/creative/failures";
import { publicMessageForMarketingFailureCode } from "@/application/directors/marketing/failures";

export const TEXT_DIRECTOR_TYPES = [
  "marketing",
  "creative",
  "script",
  "art",
  "storyboard",
] as const;

export type TextDirectorType = (typeof TEXT_DIRECTOR_TYPES)[number];

export const TEXT_DIRECTOR_ACTIVE_STATUSES = [
  "pending",
  "reserved",
  "running",
] as const;

export const TEXT_DIRECTOR_TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled",
  "needs_input",
] as const;

export type TextDirectorRunStatus =
  | (typeof TEXT_DIRECTOR_ACTIVE_STATUSES)[number]
  | (typeof TEXT_DIRECTOR_TERMINAL_STATUSES)[number]
  | string;

export type TextDirectorRunView = {
  directorRunId: string;
  directorType: TextDirectorType;
  status: TextDirectorRunStatus;
  errorCode?: string | null;
  publicMessage?: string | null;
  outputArtifactId?: string | null;
  attemptNumber?: number | null;
};

export function isTextDirectorType(value: string): value is TextDirectorType {
  return (TEXT_DIRECTOR_TYPES as readonly string[]).includes(value);
}

export function isTextDirectorRunActive(status: string): boolean {
  return (TEXT_DIRECTOR_ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function isTextDirectorRunTerminal(status: string): boolean {
  return (TEXT_DIRECTOR_TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** Honest public copy from persisted error_code — never leaks payload/secrets. */
export function publicMessageForTextDirectorRun(
  directorType: TextDirectorType,
  errorCode: string | null | undefined,
): string {
  if (!errorCode) {
    return defaultTerminalFailureMessage(directorType);
  }
  if (directorType === "marketing") {
    return publicMessageForMarketingFailureCode(errorCode);
  }
  if (directorType === "creative") {
    return publicMessageForCreativeFailureCode(errorCode);
  }
  if (directorType === "art") {
    return publicMessageForArtFailureCode(errorCode);
  }
  // Script / Storyboard: no shared code table — keep generic + code-safe.
  return defaultTerminalFailureMessage(directorType);
}

function defaultTerminalFailureMessage(directorType: TextDirectorType): string {
  switch (directorType) {
    case "marketing":
      return "L’analyse marketing a échoué. Vérifiez l’état, puis réessayez explicitement.";
    case "creative":
      return "L’analyse créative a échoué. Relancez un dry-run avant une nouvelle tentative.";
    case "script":
      return "La rédaction du script a échoué. Relancez un dry-run avant une nouvelle tentative.";
    case "art":
      return "La direction art a échoué. Relancez un dry-run avant une nouvelle tentative.";
    case "storyboard":
      return "Le storyboard a échoué. Relancez un dry-run avant une nouvelle tentative.";
  }
}

export type TextDirectorRunStatusPort = {
  findActiveRun(input: {
    projectId: string;
    directorType: TextDirectorType;
  }): Promise<TextDirectorRunView | null>;
  loadRun(input: {
    projectId: string;
    directorRunId: string;
    directorType: TextDirectorType;
  }): Promise<TextDirectorRunView | null>;
};

/**
 * Shared Director processing UX contract (8I-B).
 *
 * Distinguishes local UI phases from durable server run status.
 * Never invents percentages or persisted progress that the API does not return.
 */

export type TextDirectorKind =
  | "marketing"
  | "creative"
  | "script"
  | "art"
  | "storyboard";

/**
 * Local UI machine — not all values are persisted server-side.
 *
 * - `submitting` — local: HTTP request en route after human confirm.
 * - `running` — durable active run (pending|reserved|running) or sync await.
 * - `validating` — local only: client validates a response body it already holds.
 *   Never presented as a server step that the API does not expose.
 * - `persisting` — local only: waiting on an existing GET that reloads the
 *   durable artifact after a terminal `completed` status was observed.
 * - `completed` / `failed` — terminal UI after durable terminal status (+ reload).
 */
export type DirectorUiPhase =
  | "idle"
  | "confirming"
  | "submitting"
  | "running"
  | "validating"
  | "persisting"
  | "completed"
  | "failed";

/** Durable statuses commonly returned by director APIs / production runs. */
export type DirectorPersistentStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting_provider"
  | "completed"
  | "failed"
  | "cancelled"
  | "partial";

export const DIRECTOR_RUNNING_MESSAGES: Record<TextDirectorKind, string> = {
  marketing: "Analyse de la stratégie marketing…",
  creative: "Construction du concept créatif…",
  script: "Rédaction du script…",
  art: "Définition de la direction artistique…",
  storyboard: "Construction du storyboard…",
};

const LOCAL_PHASE_MESSAGES: Partial<Record<DirectorUiPhase, string>> = {
  submitting: "Envoi de la demande…",
  validating: "Validation du résultat…",
  persisting: "Enregistrement du résultat…",
};

export function isDirectorUiBusy(phase: DirectorUiPhase): boolean {
  return (
    phase === "confirming" ||
    phase === "submitting" ||
    phase === "running" ||
    phase === "validating" ||
    phase === "persisting"
  );
}

export function isDirectorUiProcessing(phase: DirectorUiPhase): boolean {
  return (
    phase === "submitting" ||
    phase === "running" ||
    phase === "validating" ||
    phase === "persisting"
  );
}

/**
 * Honest message for the current UI phase.
 * Prefer director-specific running copy; never invent progress %.
 */
export function directorProcessingMessage(
  director: TextDirectorKind,
  phase: DirectorUiPhase,
  opts?: { override?: string | null; persistentHint?: string | null },
): string | null {
  if (opts?.override) return opts.override;
  if (phase === "idle" || phase === "confirming") return null;
  if (phase === "completed") return null;
  if (phase === "failed") return null;
  if (phase === "submitting") return LOCAL_PHASE_MESSAGES.submitting ?? null;
  if (phase === "validating") return LOCAL_PHASE_MESSAGES.validating ?? null;
  if (phase === "persisting") return LOCAL_PHASE_MESSAGES.persisting ?? null;
  if (phase === "running") {
    return opts?.persistentHint ?? DIRECTOR_RUNNING_MESSAGES[director];
  }
  return DIRECTOR_RUNNING_MESSAGES[director];
}

/** Map a durable server status into a UI phase without inventing steps. */
export function uiPhaseFromPersistentStatus(
  status: DirectorPersistentStatus | string | null | undefined,
): DirectorUiPhase {
  if (!status || status === "idle") return "idle";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled" || status === "partial" || status === "needs_input") {
    return "failed";
  }
  if (
    status === "running" ||
    status === "queued" ||
    status === "pending" ||
    status === "reserved" ||
    status === "waiting_provider"
  ) {
    return "running";
  }
  return "running";
}

/** Shared poll interval for text Director run follow-up (aligned with Production). */
export const TEXT_DIRECTOR_RUN_POLL_MS = 2000;

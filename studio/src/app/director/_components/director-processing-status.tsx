"use client";

import {
  DIRECTOR_RUNNING_MESSAGES,
  directorProcessingMessage,
  isDirectorUiProcessing,
  type DirectorUiPhase,
  type TextDirectorKind,
} from "./director-processing";

type Props = {
  director: TextDirectorKind;
  phase: DirectorUiPhase;
  /** Optional override (e.g. already-running API message). */
  message?: string | null;
  /** Extra honest hint from real server fields (never a fake %). */
  persistentHint?: string | null;
  className?: string;
};

/**
 * Indeterminate processing indicator shared by text Directors.
 * Accessible: aria-busy, aria-live=polite, reduced-motion safe.
 */
export function DirectorProcessingStatus({
  director,
  phase,
  message,
  persistentHint,
  className,
}: Props) {
  const processing = isDirectorUiProcessing(phase);
  const text = directorProcessingMessage(director, phase, {
    override: message,
    persistentHint,
  });

  if (!processing || !text) return null;

  return (
    <div
      className={
        className ??
        "director-processing flex items-center gap-3 mb-3 text-sm text-[var(--muted)] min-h-[1.75rem]"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-director={director}
      data-ui-phase={phase}
      data-testid={`director-processing-${director}`}
    >
      <span className="director-processing__spinner" aria-hidden="true" />
      <span className="director-processing__label">{text}</span>
    </div>
  );
}

export function directorDefaultRunningMessage(director: TextDirectorKind): string {
  return DIRECTOR_RUNNING_MESSAGES[director];
}

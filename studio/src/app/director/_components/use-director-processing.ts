"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isTextDirectorRunActive,
  isTextDirectorRunTerminal,
  type TextDirectorRunView,
} from "@/application/directors/text-run-status";
import {
  DIRECTOR_RUNNING_MESSAGES,
  isDirectorUiBusy,
  type DirectorUiPhase,
  type TextDirectorKind,
} from "./director-processing";

export type TextDirectorRunPollSnapshot = {
  director: TextDirectorKind;
  run: TextDirectorRunView | null;
};

type Options = {
  director: TextDirectorKind;
  projectId: string;
  /**
   * Reload Director artifact + dry-run from existing GET API after terminal success.
   * Must not POST execute.
   */
  reloadArtifact: () => Promise<boolean>;
  /** Shown after successful terminal + artifact reload. */
  successMessage?: string;
  /** Bounded poll interval — same order of magnitude as Production (2s). */
  pollIntervalMs?: number;
};

const DEFAULT_POLL_MS = 2000;

function statusUrl(
  projectId: string,
  director: TextDirectorKind,
  runId?: string | null,
): string {
  const q = new URLSearchParams({ director });
  if (runId) q.set("runId", runId);
  return `/api/director/projects/${projectId}/text-runs?${q.toString()}`;
}

/**
 * Shared processing + single bounded poller for text Directors (8I-B).
 *
 * - One setInterval per hook instance (never a second concurrent poller).
 * - Polls GET text-runs only — never auto-POST execute.
 * - Resume on mount when an active run exists.
 */
export function useDirectorProcessing(opts: Options) {
  const {
    director,
    projectId,
    reloadArtifact,
    successMessage,
    pollIntervalMs = DEFAULT_POLL_MS,
  } = opts;

  const [phase, setPhase] = useState<DirectorUiPhase>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedRunIdRef = useRef<string | null>(null);
  const reloadArtifactRef = useRef(reloadArtifact);
  const successMessageRef = useRef(successMessage);

  useEffect(() => {
    reloadArtifactRef.current = reloadArtifact;
  }, [reloadArtifact]);
  useEffect(() => {
    successMessageRef.current = successMessage;
  }, [successMessage]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPollRef = useRef<(runId: string) => void>(() => {});
  const stopPollRef = useRef(stopPoll);
  useEffect(() => {
    stopPollRef.current = stopPoll;
  }, [stopPoll]);

  // True unmount only — never flip false when poll callbacks churn.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inFlightRef.current = false;
      stopPollRef.current();
    };
  }, []);

  const busy = isDirectorUiBusy(phase);

  const applyTerminal = useCallback(
    async (run: TextDirectorRunView) => {
      stopPoll();
      trackedRunIdRef.current = null;
      setActiveRunId(null);

      if (run.status === "completed") {
        // Observable wait: reload durable artifact via existing GET (not invented backend step).
        setPhase("persisting");
        setStatusMessage("Enregistrement du résultat…");
        try {
          const ok = await reloadArtifactRef.current();
          if (!mountedRef.current) return;
          inFlightRef.current = false;
          setPhase("completed");
          setStatusMessage(
            ok
              ? (successMessageRef.current ?? "Résultat enregistré.")
              : "Analyse terminée — actualisez pour voir le résultat.",
          );
        } catch {
          if (!mountedRef.current) return;
          inFlightRef.current = false;
          setPhase("failed");
          setStatusMessage(
            "Analyse terminée mais le résultat n’a pas pu être rechargé. Actualisez la page.",
          );
        }
        return;
      }

      inFlightRef.current = false;
      if (!mountedRef.current) return;
      setPhase("failed");
      setStatusMessage(
        run.publicMessage ??
          "Le traitement a échoué. Relancez un dry-run avant une nouvelle tentative.",
      );
    },
    [stopPoll],
  );

  const pollOnce = useCallback(async () => {
    const runId = trackedRunIdRef.current;
    if (!runId || !mountedRef.current) return;
    try {
      const res = await fetch(statusUrl(projectId, director, runId), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok || !mountedRef.current) return;
      const data = (await res.json()) as TextDirectorRunPollSnapshot;
      const run = data.run;
      if (!run) {
        // Run vanished — try reload; if artifact present → completed, else failed.
        setPhase("persisting");
        const ok = await reloadArtifactRef.current();
        if (!mountedRef.current) return;
        stopPoll();
        trackedRunIdRef.current = null;
        setActiveRunId(null);
        inFlightRef.current = false;
        if (ok) {
          setPhase("completed");
          setStatusMessage(successMessageRef.current ?? "Résultat enregistré.");
        } else {
          setPhase("failed");
          setStatusMessage(
            "Le run n’est plus actif et aucun résultat n’a été trouvé. Relancez un dry-run.",
          );
        }
        return;
      }
      if (isTextDirectorRunTerminal(run.status)) {
        await applyTerminal(run);
        return;
      }
      if (isTextDirectorRunActive(run.status)) {
        inFlightRef.current = true;
        setPhase("running");
        setActiveRunId(run.directorRunId);
        setStatusMessage(DIRECTOR_RUNNING_MESSAGES[director]);
      }
    } catch {
      // Transient network — keep polling until unmount/terminal.
    }
  }, [applyTerminal, director, projectId, stopPoll]);

  const startPoll = useCallback(
    (runId: string) => {
      trackedRunIdRef.current = runId;
      setActiveRunId(runId);
      inFlightRef.current = true;
      setPhase("running");
      setStatusMessage(DIRECTOR_RUNNING_MESSAGES[director]);
      stopPoll();
      void pollOnce();
      pollRef.current = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        void pollOnce();
      }, pollIntervalMs);
    },
    [director, pollIntervalMs, pollOnce, stopPoll],
  );

  useEffect(() => {
    startPollRef.current = startPoll;
  }, [startPoll]);

  /** Follow a durable active run (202 or mount resume) — GET poll only, no execute POST. */
  const followActiveRun = useCallback(
    (directorRunId: string) => {
      if (!directorRunId) return;
      startPollRef.current(directorRunId);
    },
    [],
  );

  // Resume once per project/director — do not re-bind to startPoll identity.
  useEffect(() => {
    let cancelled = false;

    async function resumeIfActive() {
      try {
        const res = await fetch(statusUrl(projectId, director), {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!res.ok || cancelled || !mountedRef.current) return;
        const data = (await res.json()) as TextDirectorRunPollSnapshot;
        const run = data.run;
        if (run && isTextDirectorRunActive(run.status)) {
          startPollRef.current(run.directorRunId);
        }
      } catch {
        // ignore — idle is honest when status API unreachable
      }
    }

    void resumeIfActive();
    return () => {
      cancelled = true;
      stopPollRef.current();
    };
  }, [director, projectId]);

  const beginConfirming = useCallback(() => {
    if (inFlightRef.current || trackedRunIdRef.current) return false;
    setPhase("confirming");
    return true;
  }, []);

  const cancelConfirming = useCallback(() => {
    if (inFlightRef.current || trackedRunIdRef.current) return;
    setPhase("idle");
  }, []);

  const beginSubmit = useCallback(() => {
    if (inFlightRef.current || trackedRunIdRef.current) return false;
    inFlightRef.current = true;
    setPhase("submitting");
    setStatusMessage("Envoi de la demande…");
    queueMicrotask(() => {
      if (mountedRef.current && inFlightRef.current && !trackedRunIdRef.current) {
        setPhase("running");
        setStatusMessage(DIRECTOR_RUNNING_MESSAGES[director]);
      }
    });
    return true;
  }, [director]);

  const markCompleted = useCallback((message?: string | null) => {
    stopPoll();
    trackedRunIdRef.current = null;
    setActiveRunId(null);
    inFlightRef.current = false;
    if (!mountedRef.current) return;
    setPhase("completed");
    setStatusMessage(message ?? successMessageRef.current ?? null);
  }, [stopPoll]);

  const markFailed = useCallback((message?: string | null) => {
    stopPoll();
    trackedRunIdRef.current = null;
    setActiveRunId(null);
    inFlightRef.current = false;
    if (!mountedRef.current) return;
    setPhase("failed");
    setStatusMessage(message ?? null);
  }, [stopPoll]);

  const resetIdle = useCallback(() => {
    // Never unlock while a durable run is tracked.
    if (trackedRunIdRef.current) return;
    stopPoll();
    inFlightRef.current = false;
    if (!mountedRef.current) return;
    setPhase("idle");
    setActiveRunId(null);
  }, [stopPoll]);

  return {
    director,
    phase,
    busy: busy || activeRunId != null,
    statusMessage,
    setStatusMessage,
    activeRunId,
    beginConfirming,
    cancelConfirming,
    beginSubmit,
    markCompleted,
    markFailed,
    resetIdle,
    followActiveRun,
  };
}

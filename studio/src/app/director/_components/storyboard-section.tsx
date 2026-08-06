"use client";

import { useCallback, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import type {
  StoryboardProjectDryRunResult,
  StoryboardProjectView,
} from "@/application/directors/storyboard/analyze-for-project";
import { DirectorProcessingStatus } from "./director-processing-status";
import { useDirectorProcessing } from "./use-director-processing";

type StoryboardApiErrorBody = {
  error?: { code?: string; message?: string; retryable?: boolean } | string;
  status?: string;
  directorRunId?: string;
};

function messageFromStoryboardApiError(
  data: StoryboardApiErrorBody | null | undefined,
  fallback = "Storyboard impossible.",
): string {
  if (!data) return fallback;
  if (typeof data.error === "string") return data.error;
  return data.error?.message ?? fallback;
}

export function StoryboardSection({
  projectId,
  initialStoryboard = null,
}: {
  projectId: string;
  initialStoryboard?: StoryboardProjectView | null;
}) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<StoryboardProjectDryRunResult | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardProjectView | null>(initialStoryboard);
  const [dryBusy, setDryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const confirmingRef = useRef(false);

  const reloadArtifact = useCallback(async () => {
    const res = await fetch(`/api/director/projects/${projectId}/storyboard`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      dryRun?: StoryboardProjectDryRunResult;
      storyboard?: StoryboardProjectView | null;
    };
    if (data.dryRun) {
      setDry(data.dryRun);
      if (data.dryRun.existingStoryboard) {
        setStoryboard(data.dryRun.existingStoryboard);
      }
    }
    if (data.storyboard) {
      setStoryboard(data.storyboard);
      return true;
    }
    return Boolean(data.dryRun?.existingStoryboard);
  }, [projectId]);

  const processing = useDirectorProcessing({
    director: "storyboard",
    projectId,
    reloadArtifact,
    successMessage: "Storyboard enregistré.",
  });

  const locked = dryBusy || processing.busy;
  const executeBusy = processing.busy && processing.phase !== "confirming";
  const displayError =
    error ??
    (processing.phase === "failed" ? processing.statusMessage : null);
  const displayStatus =
    status ??
    (processing.phase === "completed" ? processing.statusMessage : null);

  async function check() {
    if (locked) return;
    setDryBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = (await response.json()) as {
        dryRun?: StoryboardProjectDryRunResult;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Vérification impossible.");
        return;
      }
      if (data.dryRun) {
        setDry(data.dryRun);
        setStoryboard(data.dryRun.existingStoryboard ?? storyboard);
      }
    } catch {
      setError("Vérification impossible.");
    } finally {
      setDryBusy(false);
    }
  }

  async function execute() {
    if (locked || !dry?.executionAvailable || confirmingRef.current) return;

    confirmingRef.current = true;
    processing.beginConfirming();
    try {
      const ok = await confirm({
        title: "Lancer le storyboard ?",
        message: "Cet appel est payant. Les artefacts actifs ne seront pas modifiés.",
        confirmLabel: "Produire le storyboard",
      });
      if (!ok) {
        processing.cancelConfirming();
        return;
      }

      if (!processing.beginSubmit()) return;
      setError(null);
      setStatus(null);
      try {
        const response = await fetch(`/api/director/projects/${projectId}/storyboard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "execute",
            expectedVisualDirectionRevision: dry.visualDirectionRevision,
            expectedVideoScriptRevision: dry.videoScriptRevision,
            expectedCreativeConceptRevision: dry.creativeConceptRevision,
            expectedMarketingPlanRevision: dry.marketingPlanRevision,
          }),
        });
        const data = (await response.json()) as StoryboardApiErrorBody & {
          storyboard?: StoryboardProjectView;
        };
        if (response.status === 202) {
          const runId = data.directorRunId;
          const msg = messageFromStoryboardApiError(data, "Storyboard déjà en cours.");
          setError(null);
          setStatus(msg);
          if (typeof runId === "string" && runId) {
            processing.followActiveRun(runId);
          } else {
            const fallback =
              "Un run storyboard est déjà en cours. Actualisez la page pour reprendre le suivi.";
            processing.markFailed(fallback);
            setError(fallback);
          }
          return;
        }
        if (!response.ok) {
          const msg = messageFromStoryboardApiError(data);
          processing.markFailed(msg);
          setError(msg);
          return;
        }
        if (data.storyboard) {
          setStoryboard(data.storyboard);
          processing.markCompleted("Storyboard enregistré.");
          setStatus("Storyboard enregistré.");
        } else {
          processing.markCompleted();
        }
      } catch {
        const msg =
          "Storyboard impossible. Vérifiez la connexion, puis relancez un dry-run avant une nouvelle tentative.";
        processing.markFailed(msg);
        setError(msg);
      }
    } finally {
      confirmingRef.current = false;
    }
  }

  return (
    <section className="mt-10" aria-labelledby="storyboard-heading">
      <h2 id="storyboard-heading" className="text-base font-semibold mb-2">
        Storyboard
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Le storyboard est construit à partir de la chaîne complète incluant la Direction art active.
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={check}
          disabled={locked}
          aria-busy={dryBusy}
        >
          {dryBusy ? "Vérification…" : "Vérifier les prérequis"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={execute}
          disabled={locked || !dry?.executionAvailable}
          aria-busy={executeBusy}
        >
          {executeBusy ? "Production…" : "Produire le storyboard"}
        </button>
      </div>
      <DirectorProcessingStatus
        director="storyboard"
        phase={processing.phase}
        message={processing.statusMessage}
      />
      {displayStatus &&
        processing.phase !== "running" &&
        processing.phase !== "submitting" &&
        processing.phase !== "persisting" && (
          <p className="text-sm text-[var(--muted)] mb-2" role="status">
            {displayStatus}
          </p>
        )}
      {displayError && (
        <p className="text-sm text-[var(--danger)] mb-2" role="alert">
          {displayError}
        </p>
      )}
      {dry && (
        <div className="card p-4 mb-4 text-sm">
          <p>
            Dry-run · {dry.executable ? "prêt" : "pré-requis incomplets"} · exécution{" "}
            {dry.executionAvailable ? "disponible" : "indisponible"}
          </p>
          {dry.warnings.map((w) => (
            <p key={w.code} className="text-[var(--muted)]">
              {w.message}
            </p>
          ))}
          {dry.missingInformation.map((m) => (
            <p key={m.code} className="text-[var(--danger)]">
              {m.message}
            </p>
          ))}
        </div>
      )}
      {storyboard && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Révision</dt>
            <dd>{storyboard.revision}</dd>
          </div>
          {storyboard.title && (
            <div>
              <dt className="text-[var(--muted)]">Titre</dt>
              <dd>{storyboard.title}</dd>
            </div>
          )}
          {storyboard.sceneCount != null && (
            <div>
              <dt className="text-[var(--muted)]">Scènes</dt>
              <dd>
                {storyboard.sceneCount}
                {storyboard.totalDurationSeconds != null
                  ? ` · ${storyboard.totalDurationSeconds}s total`
                  : ""}
              </dd>
            </div>
          )}
          {storyboard.scenes && (
            <div>
              <dt className="text-[var(--muted)]">Plan</dt>
              <dd>
                {storyboard.scenes.map((s) => (
                  <p key={s.id}>
                    #{s.order} {s.purpose} · {s.durationSeconds}s
                  </p>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import type {
  ArtProjectDryRunResult,
  VisualDirectionView,
} from "@/application/directors/art/analyze-for-project";
import { DirectorProcessingStatus } from "./director-processing-status";
import { useDirectorProcessing } from "./use-director-processing";

type ArtApiErrorBody = {
  error?: { code?: string; message?: string; retryable?: boolean } | string;
  status?: string;
  directorRunId?: string;
};

function messageFromArtApiError(
  data: ArtApiErrorBody | null | undefined,
  fallback = "Direction art impossible.",
): string {
  if (!data) return fallback;
  if (typeof data.error === "string") return data.error;
  return data.error?.message ?? fallback;
}

export function ArtSection({
  projectId,
  initialVisualDirection = null,
}: {
  projectId: string;
  initialVisualDirection?: VisualDirectionView | null;
}) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<ArtProjectDryRunResult | null>(null);
  const [visualDirection, setVisualDirection] = useState<VisualDirectionView | null>(
    initialVisualDirection,
  );
  const [dryBusy, setDryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const confirmingRef = useRef(false);

  const reloadArtifact = useCallback(async () => {
    const res = await fetch(`/api/director/projects/${projectId}/art`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      dryRun?: ArtProjectDryRunResult;
      visualDirection?: VisualDirectionView | null;
    };
    if (data.dryRun) {
      setDry(data.dryRun);
      if (data.dryRun.existingVisualDirection) {
        setVisualDirection(data.dryRun.existingVisualDirection);
      }
    }
    if (data.visualDirection) {
      setVisualDirection(data.visualDirection);
      return true;
    }
    return Boolean(data.dryRun?.existingVisualDirection);
  }, [projectId]);

  const processing = useDirectorProcessing({
    director: "art",
    projectId,
    reloadArtifact,
    successMessage: "Direction art enregistrée.",
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
      const response = await fetch(`/api/director/projects/${projectId}/art`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = (await response.json()) as {
        dryRun?: ArtProjectDryRunResult;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Vérification impossible.");
        return;
      }
      if (data.dryRun) {
        setDry(data.dryRun);
        setVisualDirection(data.dryRun.existingVisualDirection ?? visualDirection);
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
        title: "Lancer la direction art ?",
        message: "Cet appel est payant. Les artefacts actifs ne seront pas modifiés.",
        confirmLabel: "Produire la direction art",
      });
      if (!ok) {
        processing.cancelConfirming();
        return;
      }

      if (!processing.beginSubmit()) return;
      setError(null);
      setStatus(null);
      try {
        const response = await fetch(`/api/director/projects/${projectId}/art`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "execute",
            expectedVideoScriptRevision: dry.videoScriptRevision,
            expectedCreativeConceptRevision: dry.creativeConceptRevision,
            expectedMarketingPlanRevision: dry.marketingPlanRevision,
          }),
        });
        const data = (await response.json()) as ArtApiErrorBody & {
          visualDirection?: VisualDirectionView;
        };
        if (response.status === 202) {
          const runId = data.directorRunId;
          const msg = messageFromArtApiError(data, "Direction art déjà en cours.");
          setError(null);
          setStatus(msg);
          if (typeof runId === "string" && runId) {
            processing.followActiveRun(runId);
          } else {
            const fallback =
              "Un run art est déjà en cours. Actualisez la page pour reprendre le suivi.";
            processing.markFailed(fallback);
            setError(fallback);
          }
          return;
        }
        if (!response.ok) {
          const msg = messageFromArtApiError(data);
          processing.markFailed(msg);
          setError(msg);
          return;
        }
        if (data.visualDirection) {
          setVisualDirection(data.visualDirection);
          processing.markCompleted("Direction art enregistrée.");
          setStatus("Direction art enregistrée.");
        } else {
          processing.markCompleted();
        }
      } catch {
        const msg =
          "Direction art impossible. Vérifiez la connexion, puis relancez un dry-run avant une nouvelle tentative.";
        processing.markFailed(msg);
        setError(msg);
      }
    } finally {
      confirmingRef.current = false;
    }
  }

  return (
    <section className="mt-10" aria-labelledby="art-heading">
      <h2 id="art-heading" className="text-base font-semibold mb-2">
        Direction art
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        La direction visuelle est construite à partir du Brief, du Marketing Plan, du Creative
        Concept et du Script actifs.
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
          {executeBusy ? "Production…" : "Produire la direction art"}
        </button>
      </div>
      <DirectorProcessingStatus
        director="art"
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
      {visualDirection && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Révision</dt>
            <dd>{visualDirection.revision}</dd>
          </div>
          {visualDirection.globalStyle && (
            <div>
              <dt className="text-[var(--muted)]">Style global</dt>
              <dd>
                {visualDirection.globalStyle.style} · {visualDirection.globalStyle.mood} ·{" "}
                {visualDirection.globalStyle.realism}
              </dd>
            </div>
          )}
          {visualDirection.palette && visualDirection.palette.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Palette</dt>
              <dd>
                {visualDirection.palette.map((c) => (
                  <span key={c.name} className="inline-block mr-3">
                    {c.name} {c.hex}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {visualDirection.segments && (
            <div>
              <dt className="text-[var(--muted)]">Segments</dt>
              <dd>
                {visualDirection.segments.map((s) => (
                  <p key={s.id}>
                    {s.shotSize} · {s.location}
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

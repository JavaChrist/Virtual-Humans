"use client";

import { useCallback, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import type {
  ArtProjectDryRunResult,
  VisualDirectionView,
} from "@/application/directors/art/analyze-for-project";
import {
  messageFromArtApiError,
  type ArtApiErrorBody,
} from "./art-messages";
import { DirectorProcessingStatus } from "./director-processing-status";
import { useDirectorProcessing } from "./use-director-processing";

function newRetryRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  const retryRequestIdRef = useRef<string | null>(null);
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

  async function refreshDryQuiet() {
    try {
      const res = await fetch(`/api/director/projects/${projectId}/art`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { dryRun?: ArtProjectDryRunResult };
      if (data.dryRun) {
        setDry(data.dryRun);
        if (data.dryRun.existingVisualDirection) {
          setVisualDirection(data.dryRun.existingVisualDirection);
        }
      }
    } catch {
      // ignore — UI still shows the error from execute/retry
    }
  }

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
      retryRequestIdRef.current = null;
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
          await refreshDryQuiet();
          return;
        }
        if (data.visualDirection) {
          setVisualDirection(data.visualDirection);
          processing.markCompleted("Direction art enregistrée.");
          setStatus("Direction art enregistrée.");
        } else {
          processing.markCompleted();
        }
        await refreshDryQuiet();
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

  async function runRetry() {
    if (locked || !dry?.retryCandidate?.retryAvailable || confirmingRef.current) return;
    const candidate = dry.retryCandidate;

    if (!retryRequestIdRef.current) {
      retryRequestIdRef.current = newRetryRequestId();
    }
    const retryRequestId = retryRequestIdRef.current;

    confirmingRef.current = true;
    processing.beginConfirming();
    try {
      const ok = await confirm({
        title: "Réessayer la direction art ?",
        message: [
          `Modèle : ${candidate.model}`,
          `Tentative précédente : #${candidate.previousAttemptNumber}`,
          `Nouvelle tentative : #${candidate.nextAttemptNumber}`,
          dry.estimatedCostMinor != null
            ? `Estimation : ${(dry.estimatedCostMinor / 100).toFixed(2)} ${dry.currency ?? "USD"}`
            : "Estimation : indisponible.",
          "Nouvel appel potentiellement facturé.",
          "Aucun retry automatique — confirmation humaine obligatoire.",
          "L’historique de la tentative précédente est conservé.",
        ].join("\n"),
        confirmLabel: "Réessayer la direction art",
      });
      if (!ok) {
        processing.cancelConfirming();
        return;
      }

      if (!processing.beginSubmit()) return;
      setError(null);
      setStatus(null);
      try {
        const res = await fetch(
          `/api/director/projects/${projectId}/art/retry`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              previousRunId: candidate.previousRunId,
              retryRequestId,
              expectedVideoScriptRevision: dry.videoScriptRevision,
              expectedCreativeConceptRevision: dry.creativeConceptRevision,
              expectedMarketingPlanRevision: dry.marketingPlanRevision,
            }),
          }
        );
        const data = (await res.json()) as ArtApiErrorBody & {
          visualDirection?: VisualDirectionView;
          directorRunId?: string;
        };
        if (res.status === 202) {
          const runId = data.directorRunId;
          const msg = messageFromArtApiError(data, "Direction art déjà en cours.");
          setError(null);
          setStatus(msg);
          if (typeof runId === "string" && runId) {
            processing.followActiveRun(runId);
          } else {
            processing.markFailed(
              "Un run art est déjà en cours. Actualisez la page pour reprendre le suivi.",
            );
            setError(
              "Un run art est déjà en cours. Actualisez la page pour reprendre le suivi.",
            );
          }
          return;
        }
        if (!res.ok) {
          const msg = messageFromArtApiError(data);
          processing.markFailed(msg);
          setError(msg);
          setStatus(null);
          retryRequestIdRef.current = null;
          await refreshDryQuiet();
          return;
        }
        if (data.visualDirection) {
          setVisualDirection(data.visualDirection);
          processing.markCompleted("Direction art enregistrée (nouvelle tentative).");
          setStatus("Direction art enregistrée (nouvelle tentative).");
        } else {
          processing.markCompleted();
        }
        retryRequestIdRef.current = null;
        await refreshDryQuiet();
      } catch {
        const msg = "Retry impossible — vérifiez l’état avant une nouvelle tentative.";
        processing.markFailed(msg);
        setError(msg);
        await refreshDryQuiet();
      }
    } finally {
      confirmingRef.current = false;
    }
  }

  const showLaunch =
    dry?.executionAvailable === true && !dry.retryCandidate?.retryAvailable;
  const showRetry = dry?.retryCandidate?.retryAvailable === true;

  return (
    <section className="mt-10" aria-labelledby="art-heading">
      <h2 id="art-heading" className="text-base font-semibold mb-2">
        Direction art
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        La direction visuelle est construite à partir du Brief, du Marketing Plan, du Creative
        Concept et du Script actifs. Aucun retry automatique.
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
        {showLaunch ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={execute}
            disabled={locked}
            aria-busy={executeBusy}
          >
            {executeBusy ? "Production…" : "Produire la direction art"}
          </button>
        ) : showRetry ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={runRetry}
            disabled={locked}
            aria-busy={executeBusy}
          >
            {executeBusy ? "Nouvelle tentative…" : "Réessayer la direction art"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={execute}
            disabled={locked || !dry?.executionAvailable}
            aria-busy={executeBusy}
            title={
              dry?.executionAvailable
                ? undefined
                : "Exécution indisponible (flags, pricing, budget ou retry non éligible)"
            }
          >
            {executeBusy ? "Production…" : "Produire la direction art"}
          </button>
        )}
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
          {dry.retryCandidate && (
            <p className="text-[var(--muted)]">
              Retry humain · tentative #{dry.retryCandidate.previousAttemptNumber} → #
              {dry.retryCandidate.nextAttemptNumber}
              {dry.retryCandidate.retryAvailable ? " · disponible" : " · indisponible"}
            </p>
          )}
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

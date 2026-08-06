"use client";

import { useCallback, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import type {
  CreativeConceptView,
  CreativeProjectDryRunResult,
} from "@/application/directors/creative/analyze-for-project";
import { buildCreativeExecuteConfirmMessage } from "./creative-confirm";
import {
  messageFromCreativeApiError,
  type CreativeApiErrorBody,
} from "./creative-messages";
import { DirectorProcessingStatus } from "./director-processing-status";
import { useDirectorProcessing } from "./use-director-processing";

export function CreativeSection({
  projectId,
  initialConcept = null,
}: {
  projectId: string;
  initialConcept?: CreativeConceptView | null;
}) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<CreativeProjectDryRunResult | null>(null);
  const [concept, setConcept] = useState<CreativeConceptView | null>(initialConcept);
  const [dryBusy, setDryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const confirmingRef = useRef(false);

  const reloadArtifact = useCallback(async () => {
    const res = await fetch(`/api/director/projects/${projectId}/creative`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      dryRun?: CreativeProjectDryRunResult;
      concept?: CreativeConceptView | null;
    };
    if (data.dryRun) {
      setDry(data.dryRun);
      if (data.dryRun.existingConcept) setConcept(data.dryRun.existingConcept);
    }
    if (data.concept) {
      setConcept(data.concept);
      return true;
    }
    return Boolean(data.dryRun?.existingConcept);
  }, [projectId]);

  const processing = useDirectorProcessing({
    director: "creative",
    projectId,
    reloadArtifact,
    successMessage: "Concept créatif enregistré.",
  });

  const locked = dryBusy || processing.busy;
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
      const r = await fetch(`/api/director/projects/${projectId}/creative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry-run" }),
      });
      const d = (await r.json()) as {
        dryRun?: CreativeProjectDryRunResult;
        error?: string;
      };
      if (!r.ok) {
        setError(d.error ?? "Vérification impossible.");
        return;
      }
      if (d.dryRun) {
        setDry(d.dryRun);
        setConcept(d.dryRun.existingConcept ?? concept);
        setStatus(
          d.dryRun.executable
            ? "Marketing Plan prêt pour Creative."
            : "Pré-requis Creative incomplets.",
        );
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
        title: "Lancer l’analyse créative ?",
        message: buildCreativeExecuteConfirmMessage(dry),
        confirmLabel: "Lancer l’analyse",
        cancelLabel: "Annuler",
      });
      if (!ok) {
        processing.cancelConfirming();
        return;
      }

      if (!processing.beginSubmit()) return;
      setError(null);
      setStatus(null);
      try {
        const r = await fetch(`/api/director/projects/${projectId}/creative`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "execute",
            expectedMarketingPlanRevision: dry.marketingPlanRevision,
          }),
        });
        const d = (await r.json()) as CreativeApiErrorBody & {
          concept?: CreativeConceptView;
        };
        if (r.status === 202) {
          const runId = d.directorRunId;
          const msg = messageFromCreativeApiError(
            d,
            "Analyse créative déjà en cours.",
          );
          setError(null);
          setStatus(msg);
          if (typeof runId === "string" && runId) {
            processing.followActiveRun(runId);
          } else {
            const fallback =
              "Un run créatif est déjà en cours. Actualisez la page pour reprendre le suivi.";
            processing.markFailed(fallback);
            setError(fallback);
          }
          return;
        }
        if (!r.ok) {
          const msg = messageFromCreativeApiError(d);
          processing.markFailed(msg);
          setError(msg);
          return;
        }
        if (d.concept) {
          setConcept(d.concept);
          processing.markCompleted("Concept créatif enregistré.");
          setStatus("Concept créatif enregistré.");
        } else {
          processing.markCompleted();
        }
      } catch {
        const msg =
          "Analyse créative impossible. Vérifiez la connexion, puis relancez un dry-run avant une nouvelle tentative.";
        processing.markFailed(msg);
        setError(msg);
      }
    } finally {
      confirmingRef.current = false;
    }
  }

  return (
    <section className="mt-10" aria-labelledby="creative-heading">
      <h2 id="creative-heading" className="text-base font-semibold mb-2">
        Direction créative
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Le concept créatif est fondé sur le brief et le Marketing Plan actifs.
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
        {dry?.executionAvailable ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={execute}
            disabled={locked}
            aria-busy={processing.busy && processing.phase !== "confirming"}
          >
            {processing.busy && processing.phase !== "confirming"
              ? "Analyse…"
              : "Lancer l’analyse créative"}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled aria-disabled="true">
            Lancer l’analyse créative — indisponible
          </button>
        )}
      </div>
      <DirectorProcessingStatus
        director="creative"
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
            Dry-run · {dry.executable ? "prêt" : "non prêt"} · exécution{" "}
            {dry.executionAvailable ? "autorisable" : "non disponible"}
          </p>
          <ul className="mt-2 text-xs text-[var(--muted)] space-y-0.5">
            <li>Modèle : {dry.model}</li>
            <li>Reasoning : {dry.reasoningEffort}</li>
            <li>max_output_tokens : {dry.maxOutputTokens}</li>
            <li>
              Estimation :{" "}
              {dry.estimatedCostMinor != null
                ? `${(dry.estimatedCostMinor / 100).toFixed(2)} ${dry.currency ?? "USD"}`
                : "indisponible"}
            </li>
            <li>
              Inputs : Brief rev. {dry.briefRevision} · Marketing Plan rev.{" "}
              {dry.marketingPlanRevision}
            </li>
            <li>Prompt : {dry.promptVersion}</li>
            <li>Schema : {dry.schemaVersion}</li>
            {dry.durationSeconds != null && dry.maxBeats != null && (
              <li>
                Durée : {dry.durationSeconds}s · maxBeats : {dry.maxBeats}
              </li>
            )}
          </ul>
          {dry.missingInformation.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-[var(--muted)] mt-2">
              {dry.missingInformation.map((x) => (
                <li key={x.code}>{x.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {concept && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Révision</dt>
            <dd>{concept.revision}</dd>
          </div>
          {concept.title && (
            <div>
              <dt className="text-[var(--muted)]">Titre</dt>
              <dd>{concept.title}</dd>
            </div>
          )}
          {concept.logline && (
            <div>
              <dt className="text-[var(--muted)]">Logline</dt>
              <dd>{concept.logline}</dd>
            </div>
          )}
          {concept.bigIdea && (
            <div>
              <dt className="text-[var(--muted)]">Big idea</dt>
              <dd>{concept.bigIdea}</dd>
            </div>
          )}
          {concept.narrativeApproach && (
            <div>
              <dt className="text-[var(--muted)]">Approche narrative</dt>
              <dd>{concept.narrativeApproach}</dd>
            </div>
          )}
          {concept.rhythm && (
            <div>
              <dt className="text-[var(--muted)]">Rythme</dt>
              <dd>{concept.rhythm}</dd>
            </div>
          )}
          {concept.emotionalArc && (
            <div>
              <dt className="text-[var(--muted)]">Arc émotionnel</dt>
              <dd>{concept.emotionalArc}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

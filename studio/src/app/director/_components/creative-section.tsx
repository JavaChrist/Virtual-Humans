"use client";

import { useRef, useState } from "react";
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
  const [busy, setBusy] = useState<"dry-run" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  /** Blocks re-entrant confirm cycles (anti double-clic). */
  const confirmingRef = useRef(false);

  async function check() {
    if (busy) return;
    setBusy("dry-run");
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
      setBusy(null);
    }
  }

  async function execute() {
    if (busy || !dry?.executionAvailable || confirmingRef.current) return;
    confirmingRef.current = true;
    try {
      const ok = await confirm({
        title: "Lancer l’analyse créative ?",
        message: buildCreativeExecuteConfirmMessage(dry),
        confirmLabel: "Lancer l’analyse",
        cancelLabel: "Annuler",
      });
      if (!ok) return;

      setBusy("execute");
      setError(null);
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
        if (!r.ok) {
          setError(messageFromCreativeApiError(d));
          return;
        }
        if (d.concept) {
          setConcept(d.concept);
          setStatus("Concept créatif enregistré.");
        }
      } catch {
        setError("Analyse créative impossible.");
      } finally {
        setBusy(null);
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
          disabled={busy != null}
          aria-busy={busy === "dry-run"}
        >
          {busy === "dry-run" ? "Vérification…" : "Vérifier les prérequis"}
        </button>
        {dry?.executionAvailable ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={execute}
            disabled={busy != null}
            aria-busy={busy === "execute"}
          >
            {busy === "execute" ? "Analyse…" : "Lancer l’analyse créative"}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled aria-disabled="true">
            Lancer l’analyse créative — indisponible
          </button>
        )}
      </div>
      {status && (
        <p className="text-sm text-[var(--muted)] mb-2" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)] mb-2" role="alert">
          {error}
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

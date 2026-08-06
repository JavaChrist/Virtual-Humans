"use client";

import { useCallback, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import type {
  ScriptProjectDryRunResult,
  VideoScriptView,
} from "@/application/directors/script/analyze-for-project";
import { DirectorProcessingStatus } from "./director-processing-status";
import { useDirectorProcessing } from "./use-director-processing";

type ScriptApiErrorBody = {
  error?: { code?: string; message?: string; retryable?: boolean } | string;
  status?: string;
  directorRunId?: string;
};

function messageFromScriptApiError(
  data: ScriptApiErrorBody | null | undefined,
  fallback = "Rédaction impossible.",
): string {
  if (!data) return fallback;
  if (typeof data.error === "string") return data.error;
  return data.error?.message ?? fallback;
}

export function ScriptSection({
  projectId,
  initialScript = null,
}: {
  projectId: string;
  initialScript?: VideoScriptView | null;
}) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<ScriptProjectDryRunResult | null>(null);
  const [script, setScript] = useState<VideoScriptView | null>(initialScript);
  const [dryBusy, setDryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const confirmingRef = useRef(false);

  const reloadArtifact = useCallback(async () => {
    const res = await fetch(`/api/director/projects/${projectId}/script`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      dryRun?: ScriptProjectDryRunResult;
      script?: VideoScriptView | null;
    };
    if (data.dryRun) {
      setDry(data.dryRun);
      if (data.dryRun.existingScript) setScript(data.dryRun.existingScript);
    }
    if (data.script) {
      setScript(data.script);
      return true;
    }
    return Boolean(data.dryRun?.existingScript);
  }, [projectId]);

  const processing = useDirectorProcessing({
    director: "script",
    projectId,
    reloadArtifact,
    successMessage: "Script enregistré.",
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
      const response = await fetch(`/api/director/projects/${projectId}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = (await response.json()) as {
        dryRun?: ScriptProjectDryRunResult;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Vérification impossible.");
        return;
      }
      if (data.dryRun) {
        setDry(data.dryRun);
        setScript(data.dryRun.existingScript ?? script);
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
        title: "Lancer la rédaction du script ?",
        message: "Cet appel est payant. Les artefacts actifs ne seront pas modifiés.",
        confirmLabel: "Rédiger le script",
      });
      if (!ok) {
        processing.cancelConfirming();
        return;
      }

      if (!processing.beginSubmit()) return;
      setError(null);
      setStatus(null);
      try {
        const response = await fetch(`/api/director/projects/${projectId}/script`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "execute",
            expectedCreativeConceptRevision: dry.creativeConceptRevision,
            expectedMarketingPlanRevision: dry.marketingPlanRevision,
          }),
        });
        const data = (await response.json()) as ScriptApiErrorBody & {
          script?: VideoScriptView;
        };
        if (response.status === 202) {
          const runId = data.directorRunId;
          const msg = messageFromScriptApiError(data, "Rédaction du script déjà en cours.");
          setError(null);
          setStatus(msg);
          if (typeof runId === "string" && runId) {
            processing.followActiveRun(runId);
          } else {
            const fallback =
              "Un run script est déjà en cours. Actualisez la page pour reprendre le suivi.";
            processing.markFailed(fallback);
            setError(fallback);
          }
          return;
        }
        if (!response.ok) {
          const msg = messageFromScriptApiError(data);
          processing.markFailed(msg);
          setError(msg);
          return;
        }
        if (data.script) {
          setScript(data.script);
          processing.markCompleted("Script enregistré.");
          setStatus("Script enregistré.");
        } else {
          processing.markCompleted();
        }
      } catch {
        const msg =
          "Rédaction impossible. Vérifiez la connexion, puis relancez un dry-run avant une nouvelle tentative.";
        processing.markFailed(msg);
        setError(msg);
      }
    } finally {
      confirmingRef.current = false;
    }
  }

  return (
    <section className="mt-10" aria-labelledby="script-heading">
      <h2 id="script-heading" className="text-base font-semibold mb-2">
        Script
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Le script est construit à partir du Brief, du Marketing Plan et du Creative Concept actifs.
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
          {executeBusy ? "Rédaction…" : "Rédiger le script"}
        </button>
      </div>
      <DirectorProcessingStatus
        director="script"
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
          {dry.targetDuration != null && (
            <p>
              Durée cible : {dry.targetDuration}s
              {dry.estimatedDuration != null ? ` · estimation : ${dry.estimatedDuration}s` : ""}
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
      {script && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Révision</dt>
            <dd>{script.revision}</dd>
          </div>
          {script.title && (
            <div>
              <dt className="text-[var(--muted)]">Titre</dt>
              <dd>{script.title}</dd>
            </div>
          )}
          {script.summary && (
            <div>
              <dt className="text-[var(--muted)]">Résumé</dt>
              <dd>{script.summary}</dd>
            </div>
          )}
          {script.hook && (
            <div>
              <dt className="text-[var(--muted)]">Hook</dt>
              <dd>{script.hook}</dd>
            </div>
          )}
          {script.segments && (
            <div>
              <dt className="text-[var(--muted)]">Segments</dt>
              <dd>
                {script.segments.map((s) => (
                  <p key={`${s.purpose}-${s.text}`}>
                    {s.purpose} · {s.text}
                  </p>
                ))}
              </dd>
            </div>
          )}
          {script.cta && (
            <div>
              <dt className="text-[var(--muted)]">CTA</dt>
              <dd>{script.cta}</dd>
            </div>
          )}
          {script.targetDuration != null && (
            <div>
              <dt className="text-[var(--muted)]">Durée</dt>
              <dd>
                {script.calculatedDuration}s / {script.targetDuration}s · {script.toleranceStatus}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

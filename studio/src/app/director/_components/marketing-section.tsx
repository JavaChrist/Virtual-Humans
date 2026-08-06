"use client";

import { useCallback, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import type {
  MarketingPlanView,
  MarketingProjectDryRunResult,
} from "@/application/directors/marketing/analyze-for-project";
import {
  messageFromMarketingApiError,
  type MarketingApiErrorBody,
} from "./marketing-messages";
import { DirectorProcessingStatus } from "./director-processing-status";
import { useDirectorProcessing } from "./use-director-processing";

type Props = {
  projectId: string;
  initialPlan?: MarketingPlanView | null;
};

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

export function MarketingSection({ projectId, initialPlan = null }: Props) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<MarketingProjectDryRunResult | null>(null);
  const [plan, setPlan] = useState<MarketingPlanView | null>(initialPlan);
  const [dryBusy, setDryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  /** Stable for one human confirmation cycle — never regenerated on network re-render. */
  const retryRequestIdRef = useRef<string | null>(null);
  const confirmingRef = useRef(false);

  const reloadArtifact = useCallback(async () => {
    const res = await fetch(`/api/director/projects/${projectId}/marketing`);
    if (!res.ok) return false;
    const data = (await res.json()) as {
      dryRun?: MarketingProjectDryRunResult;
      plan?: MarketingPlanView | null;
    };
    if (data.dryRun) {
      setDry(data.dryRun);
      if (data.dryRun.existingPlan) setPlan(data.dryRun.existingPlan);
    }
    if (data.plan) {
      setPlan(data.plan);
      return true;
    }
    return Boolean(data.dryRun?.existingPlan);
  }, [projectId]);

  const processing = useDirectorProcessing({
    director: "marketing",
    projectId,
    reloadArtifact,
    successMessage: "Stratégie marketing enregistrée.",
  });

  const locked = dryBusy || processing.busy;
  const displayError =
    error ??
    (processing.phase === "failed" ? processing.statusMessage : null);
  const displayStatus =
    statusMsg ??
    (processing.phase === "completed" ? processing.statusMessage : null);

  async function runDryRun() {
    if (locked) return;
    setDryBusy(true);
    setError(null);
    setStatusMsg("Vérification du brief…");
    retryRequestIdRef.current = null;
    try {
      const res = await fetch(`/api/director/projects/${projectId}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry-run" }),
      });
      const data = (await res.json()) as {
        dryRun?: MarketingProjectDryRunResult;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Vérification impossible.");
        setStatusMsg(null);
        return;
      }
      if (data.dryRun) {
        setDry(data.dryRun);
        if (data.dryRun.existingPlan) setPlan(data.dryRun.existingPlan);
        setStatusMsg(
          data.dryRun.retryCandidate?.retryAvailable
            ? "Une tentative précédente a échoué — vous pouvez réessayer explicitement."
            : data.dryRun.executable
              ? "Brief prêt pour une analyse marketing."
              : "Brief non prêt — voir les informations manquantes."
        );
      }
    } catch {
      setError("Vérification impossible.");
      setStatusMsg(null);
    } finally {
      setDryBusy(false);
    }
  }

  async function runExecute() {
    if (locked || !dry?.executionAvailable || confirmingRef.current) return;
    // Never silently reuse a terminal failed run — force the dedicated retry path.
    if (dry.retryCandidate?.retryAvailable) return;

    confirmingRef.current = true;
    processing.beginConfirming();
    try {
      const ok = await confirm({
        title: "Lancer l’analyse marketing ?",
        message: [
          "Cet appel est payant.",
          dry.estimatedCostMinor != null
            ? `Estimation : ${(dry.estimatedCostMinor / 100).toFixed(2)} ${dry.currency ?? "USD"} (confiance ${dry.confidence ?? "unknown"}).`
            : "Estimation : indisponible — l’exécution reste bloquée tant que la tarification n’est pas configurée.",
          "Le brief actif ne sera pas modifié.",
          "Aucun retry automatique.",
        ].join("\n"),
        confirmLabel: "Lancer l’analyse",
      });
      if (!ok) {
        processing.cancelConfirming();
        return;
      }

      if (!processing.beginSubmit()) return;
      setError(null);
      setStatusMsg(null);
      try {
        const res = await fetch(`/api/director/projects/${projectId}/marketing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "execute",
            expectedBriefRevision: dry.briefRevision,
          }),
        });
        const data = (await res.json()) as MarketingApiErrorBody & {
          plan?: MarketingPlanView;
        };
        if (res.status === 202) {
          const runId = data.directorRunId;
          const msg = messageFromMarketingApiError(data, "Analyse déjà en cours.");
          setError(null);
          setStatusMsg(msg);
          if (typeof runId === "string" && runId) {
            processing.followActiveRun(runId);
          } else {
            processing.markFailed(
              "Un run marketing est déjà en cours. Actualisez la page pour reprendre le suivi.",
            );
            setError(
              "Un run marketing est déjà en cours. Actualisez la page pour reprendre le suivi.",
            );
          }
          return;
        }
        if (!res.ok) {
          const msg = messageFromMarketingApiError(data);
          processing.markFailed(msg);
          setError(msg);
          if (data.missingInformation?.length) {
            setStatusMsg(data.missingInformation.map((m) => m.message).join(" · "));
          } else {
            setStatusMsg(null);
          }
          // Refresh dry-run state so retry CTA can appear after terminal failure.
          await refreshDryQuiet();
          return;
        }
        if (data.plan) {
          setPlan(data.plan);
          processing.markCompleted("Stratégie marketing enregistrée.");
          setStatusMsg("Stratégie marketing enregistrée.");
        } else {
          processing.markCompleted();
        }
      } catch {
        const msg =
          "Analyse impossible. Vérifiez la connexion, puis relancez un dry-run avant une nouvelle tentative.";
        processing.markFailed(msg);
        setError(msg);
      }
    } finally {
      confirmingRef.current = false;
    }
  }

  async function refreshDryQuiet() {
    try {
      const res = await fetch(`/api/director/projects/${projectId}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry-run" }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { dryRun?: MarketingProjectDryRunResult };
      if (data.dryRun) {
        setDry(data.dryRun);
        if (data.dryRun.existingPlan) setPlan(data.dryRun.existingPlan);
      }
    } catch {
      // ignore — UI still shows the error from execute/retry
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
        title: "Réessayer l’analyse ?",
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
        confirmLabel: "Réessayer l’analyse",
      });
      if (!ok) {
        processing.cancelConfirming();
        // Keep the same ID if the user cancels then re-opens — still one human intent.
        return;
      }

      if (!processing.beginSubmit()) return;
      setError(null);
      setStatusMsg(null);
      try {
        const res = await fetch(
          `/api/director/projects/${projectId}/marketing/retry`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              previousRunId: candidate.previousRunId,
              retryRequestId,
              expectedBriefRevision: dry.briefRevision,
            }),
          }
        );
        const data = (await res.json()) as MarketingApiErrorBody & {
          plan?: MarketingPlanView;
          directorRunId?: string;
        };
        if (res.status === 202) {
          const runId = data.directorRunId;
          const msg = messageFromMarketingApiError(data, "Analyse déjà en cours.");
          setError(null);
          setStatusMsg(msg);
          if (typeof runId === "string" && runId) {
            processing.followActiveRun(runId);
          } else {
            processing.markFailed(
              "Un run marketing est déjà en cours. Actualisez la page pour reprendre le suivi.",
            );
            setError(
              "Un run marketing est déjà en cours. Actualisez la page pour reprendre le suivi.",
            );
          }
          return;
        }
        if (!res.ok) {
          const msg = messageFromMarketingApiError(data);
          processing.markFailed(msg);
          setError(msg);
          setStatusMsg(null);
          // Terminal or conflict → invalidate request id; re-read server before a new human attempt.
          retryRequestIdRef.current = null;
          await refreshDryQuiet();
          return;
        }
        if (data.plan) {
          setPlan(data.plan);
          processing.markCompleted("Stratégie marketing enregistrée (nouvelle tentative).");
          setStatusMsg("Stratégie marketing enregistrée (nouvelle tentative).");
        } else {
          processing.markCompleted();
        }
        retryRequestIdRef.current = null;
        await refreshDryQuiet();
      } catch {
        const msg = "Retry impossible — vérifiez l’état avant une nouvelle tentative.";
        processing.markFailed(msg);
        setError(msg);
        // Ambiguous network → keep ID and refresh server state; do not mint a new ID.
        await refreshDryQuiet();
      }
    } finally {
      confirmingRef.current = false;
    }
  }

  const showLaunch =
    dry?.executionAvailable === true && !dry.retryCandidate?.retryAvailable;
  const showRetry = dry?.retryCandidate?.retryAvailable === true;
  const executeBusy = processing.busy && processing.phase !== "confirming";

  return (
    <section className="mt-10" aria-labelledby="marketing-strategy-heading">
      <h2 id="marketing-strategy-heading" className="text-base font-semibold mb-2">
        Stratégie marketing
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">
        Vérifiez d’abord que le brief est prêt. L’analyse IA (payante) n’est proposée que
        lorsque la configuration, les flags et le budget le permettent. Aucun choix de
        modèle ou de fournisseur. Aucun retry automatique.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={runDryRun}
          disabled={locked}
          aria-busy={dryBusy}
        >
          {dryBusy ? "Vérification…" : "Vérifier le brief"}
        </button>
        {showLaunch ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={runExecute}
            disabled={locked}
            aria-busy={executeBusy}
          >
            {executeBusy ? "Analyse…" : "Lancer l’analyse marketing"}
          </button>
        ) : showRetry ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={runRetry}
            disabled={locked}
            aria-busy={executeBusy}
          >
            {executeBusy ? "Nouvelle tentative…" : "Réessayer l’analyse"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            disabled
            title="Exécution indisponible (flags, pricing, budget ou retry non éligible)"
            aria-disabled="true"
          >
            Lancer l’analyse marketing — indisponible
          </button>
        )}
      </div>

      <DirectorProcessingStatus
        director="marketing"
        phase={processing.phase}
        message={processing.statusMessage}
      />
      {displayStatus &&
        processing.phase !== "running" &&
        processing.phase !== "submitting" &&
        processing.phase !== "persisting" && (
          <p className="text-sm text-[var(--muted)] mb-2" role="status" aria-live="polite">
            {displayStatus}
          </p>
        )}
      {displayError && (
        <p className="text-sm text-[var(--danger)] mb-2" role="alert">
          {displayError}
        </p>
      )}

      {dry && (
        <div className="card p-4 mb-4 space-y-2 text-sm">
          <p>
            <span className="text-[var(--muted)]">Dry-run · </span>
            {dry.executable ? "prêt" : "non prêt"}
            {" · "}
            exécution {dry.executionAvailable ? "autorisable" : "non disponible"}
            {dry.retryCandidate?.retryAvailable
              ? ` · retry #${dry.retryCandidate.nextAttemptNumber} disponible`
              : ""}
          </p>
          {!dry.pricingConfigured && (
            <p className="text-xs text-[var(--muted)]">
              Tarification non configurée — aucun détail secret ; l’appel payant reste
              bloqué si une estimation ferme est exigée.
            </p>
          )}
          {dry.missingInformation.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-[var(--muted)]">
              {dry.missingInformation.map((m) => (
                <li key={m.code}>{m.message}</li>
              ))}
            </ul>
          )}
          {dry.warnings.length > 0 && (
            <ul className="list-disc pl-5 text-xs">
              {dry.warnings.map((w) => (
                <li key={w.code}>{w.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plan && plan.status === "ready" && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Révision</dt>
            <dd>{plan.revision}</dd>
          </div>
          {plan.objective && (
            <div>
              <dt className="text-[var(--muted)]">Objectif</dt>
              <dd>{plan.objective}</dd>
            </div>
          )}
          {plan.audience && (
            <div>
              <dt className="text-[var(--muted)]">Audience</dt>
              <dd>{plan.audience}</dd>
            </div>
          )}
          {plan.mainProblem && (
            <div>
              <dt className="text-[var(--muted)]">Problème</dt>
              <dd>{plan.mainProblem}</dd>
            </div>
          )}
          {plan.mainBenefit && (
            <div>
              <dt className="text-[var(--muted)]">Bénéfice</dt>
              <dd>{plan.mainBenefit}</dd>
            </div>
          )}
          {plan.uniqueSellingPoint && (
            <div>
              <dt className="text-[var(--muted)]">USP</dt>
              <dd>{plan.uniqueSellingPoint}</dd>
            </div>
          )}
          {plan.emotionalHook && (
            <div>
              <dt className="text-[var(--muted)]">Hook</dt>
              <dd>{plan.emotionalHook}</dd>
            </div>
          )}
          {plan.callToAction && (
            <div>
              <dt className="text-[var(--muted)]">CTA</dt>
              <dd>{plan.callToAction}</dd>
            </div>
          )}
          {plan.keyMessages && plan.keyMessages.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Messages clés</dt>
              <dd>
                <ul className="list-disc pl-5">
                  {plan.keyMessages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {plan.successMetric && (
            <div>
              <dt className="text-[var(--muted)]">Métrique</dt>
              <dd>{plan.successMetric}</dd>
            </div>
          )}
          {plan.assumptions && plan.assumptions.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Hypothèses</dt>
              <dd>
                <ul className="list-disc pl-5">
                  {plan.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

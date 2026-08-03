"use client";

import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import type {
  MarketingPlanView,
  MarketingProjectDryRunResult,
} from "@/application/directors/marketing/analyze-for-project";
import {
  messageFromMarketingApiError,
  type MarketingApiErrorBody,
} from "./marketing-messages";

type Props = {
  projectId: string;
  initialPlan?: MarketingPlanView | null;
};

export function MarketingSection({ projectId, initialPlan = null }: Props) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<MarketingProjectDryRunResult | null>(null);
  const [plan, setPlan] = useState<MarketingPlanView | null>(initialPlan);
  const [busy, setBusy] = useState<"dry-run" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function runDryRun() {
    if (busy) return;
    setBusy("dry-run");
    setError(null);
    setStatusMsg("Vérification du brief…");
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
          data.dryRun.executable
            ? "Brief prêt pour une analyse marketing."
            : "Brief non prêt — voir les informations manquantes."
        );
      }
    } catch {
      setError("Vérification impossible.");
      setStatusMsg(null);
    } finally {
      setBusy(null);
    }
  }

  async function runExecute() {
    if (busy || !dry?.executionAvailable) return;
    const ok = await confirm({
      title: "Lancer l’analyse marketing ?",
      message: [
        "Cet appel est payant (OpenAI).",
        dry.estimatedCostMinor != null
          ? `Estimation : ${(dry.estimatedCostMinor / 100).toFixed(2)} ${dry.currency ?? "USD"} (confiance ${dry.confidence ?? "unknown"}).`
          : "Estimation : indisponible — l’exécution reste bloquée tant que la tarification n’est pas configurée.",
        "Le brief actif ne sera pas modifié.",
      ].join("\n"),
      confirmLabel: "Lancer l’analyse",
    });
    if (!ok) return;

    setBusy("execute");
    setError(null);
    setStatusMsg("Analyse marketing en cours…");
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
        setStatusMsg(
          messageFromMarketingApiError(data, "Analyse déjà en cours.")
        );
        return;
      }
      if (!res.ok) {
        // Preserve dry-run; re-enable buttons via finally (no auto-retry).
        setError(messageFromMarketingApiError(data));
        if (data.missingInformation?.length) {
          setStatusMsg(data.missingInformation.map((m) => m.message).join(" · "));
        } else {
          setStatusMsg(null);
        }
        return;
      }
      if (data.plan) {
        setPlan(data.plan);
        setStatusMsg("Stratégie marketing enregistrée.");
      }
    } catch {
      setError("Analyse impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="marketing-strategy-heading">
      <h2 id="marketing-strategy-heading" className="text-base font-semibold mb-2">
        Stratégie marketing
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">
        Vérifiez d’abord que le brief est prêt. L’analyse IA (payante) n’est proposée que
        lorsque la configuration, les flags et le budget le permettent. Aucun choix de
        modèle ou de fournisseur.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={runDryRun}
          disabled={busy != null}
          aria-busy={busy === "dry-run"}
        >
          {busy === "dry-run" ? "Vérification…" : "Vérifier le brief"}
        </button>
        {dry?.executionAvailable ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={runExecute}
            disabled={busy != null}
            aria-busy={busy === "execute"}
          >
            {busy === "execute" ? "Analyse…" : "Lancer l’analyse marketing"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            disabled
            title="Exécution indisponible (flags, pricing ou budget)"
            aria-disabled="true"
          >
            Lancer l’analyse marketing — indisponible
          </button>
        )}
      </div>

      {statusMsg && (
        <p className="text-sm text-[var(--muted)] mb-2" role="status" aria-live="polite">
          {statusMsg}
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)] mb-2" role="alert">
          {error}
        </p>
      )}

      {dry && (
        <div className="card p-4 mb-4 space-y-2 text-sm">
          <p>
            <span className="text-[var(--muted)]">Dry-run · </span>
            {dry.executable ? "prêt" : "non prêt"}
            {" · "}
            exécution {dry.executionAvailable ? "autorisable" : "non disponible"}
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

"use client";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";
import { shouldBlockNonDryBusy } from "@/lib/update-blocker-policy";
import type {
  GenerationPlanView,
  RoutingProjectDryRunResult,
} from "@/application/directors/routing/route-for-project";

function formatMoney(minor?: number, currency = "USD") {
  if (minor == null) return "—";
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export function RoutingSection({
  projectId,
  projectRevision,
  initialPlan = null,
  onProjectRevision,
}: {
  projectId: string;
  projectRevision: number;
  initialPlan?: GenerationPlanView | null;
  onProjectRevision?: (revision: number) => void;
}) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<RoutingProjectDryRunResult | null>(null);
  const [plan, setPlan] = useState<GenerationPlanView | null>(initialPlan);
  const [activeProjectRevision, setActiveProjectRevision] = useState(projectRevision);
  const [busy, setBusy] = useState<"dry" | "execute" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useUpdateBlocker(
    shouldBlockNonDryBusy(busy, ["dry"]),
    UPDATE_BLOCKER_IDS.directorRouting,
    UPDATE_BLOCKER_REASONS.saving,
  );

  useEffect(() => {
    setActiveProjectRevision(projectRevision);
  }, [projectRevision]);

  async function check() {
    if (busy) return;
    setBusy("dry");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = (await response.json()) as {
        dryRun?: RoutingProjectDryRunResult;
        error?: string;
      };
      if (!response.ok) setError(data.error ?? "Vérification impossible.");
      else if (data.dryRun) {
        setDry(data.dryRun);
        setPlan(data.dryRun.existingPlan ?? plan);
      }
    } catch {
      setError("Vérification impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function execute() {
    if (busy || !dry?.executionAvailable) return;
    const ok = await confirm({
      title: "Créer le GenerationPlan ?",
      message:
        "Le Model Router sélectionne les modèles à partir du Registry local. Aucun provider n'est appelé et aucun budget n'est réservé.",
      confirmLabel: "Créer le plan",
    });
    if (!ok) return;

    setBusy("execute");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          expectedScenePackageSetRevision: dry.scenePackageSetRevision,
          expectedRegistrySnapshotVersion: dry.registryVersion,
        }),
      });
      const data = (await response.json()) as {
        plan?: GenerationPlanView;
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Routage impossible.";
        setError(msg);
      } else if (data.plan) setPlan(data.plan);
    } catch {
      setError("Routage impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (busy || !plan?.artifactId || plan.status !== "ready") return;
    if (plan.approval?.status === "approved") return;
    const ok = await confirm({
      title: "Approuver le GenerationPlan ?",
      message: [
        `Révision ${plan.revision} · estimation principale ${formatMoney(plan.estimatedCostMinor, plan.currency)}.`,
        "Cette approbation est obligatoire avant toute production future. Aucune génération n'est lancée.",
      ].join("\n"),
      confirmLabel: "Approuver",
    });
    if (!ok) return;

    setBusy("approve");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactType: "generation_plan",
          artifactId: plan.artifactId,
          revision: plan.revision,
          decision: "approved",
          expectedProjectRevision: activeProjectRevision,
          confirmation: true,
        }),
      });
      const data = (await response.json()) as {
        approval?: {
          status: "approved" | "rejected";
          revision: number;
          decidedAt: string;
          decidedBy: string;
          projectRevision: number;
        };
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Approbation impossible.";
        setError(msg);
      } else if (data.approval) {
        setActiveProjectRevision(data.approval.projectRevision);
        onProjectRevision?.(data.approval.projectRevision);
        setPlan({
          ...plan,
          approval: {
            status: data.approval.status,
            revision: data.approval.revision,
            decidedAt: data.approval.decidedAt,
            decidedBy: data.approval.decidedBy,
          },
        });
      }
    } catch {
      setError("Approbation impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="routing-heading">
      <h2 id="routing-heading" className="text-base font-semibold mb-2">
        Routing & GenerationPlan
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Sélection déterministe des modèles depuis le Capability Registry — aucun appel provider, aucune
        réservation budgétaire.
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        <button type="button" className="btn btn-primary" onClick={check} disabled={busy != null}>
          {busy === "dry" ? "Vérification…" : "Vérifier le routage"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={execute}
          disabled={busy != null || !dry?.executionAvailable}
        >
          {busy === "execute" ? "Création…" : "Créer le GenerationPlan"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={approve}
          disabled={
            busy != null ||
            !plan?.artifactId ||
            plan.approval?.status === "approved" ||
            plan.budgetAllowed === false
          }
        >
          {busy === "approve" ? "Approbation…" : "Approuver le plan"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-[var(--danger)] mb-2" role="alert">
          {error}
        </p>
      )}
      {dry && (
        <div className="card p-4 mb-4 text-sm">
          <p>
            Dry-run · {dry.executable ? "prêt" : "pré-requis incomplets"} · exécution{" "}
            {dry.executionAvailable ? "disponible" : "indisponible"} · providerCalled: false
          </p>
          <p className="text-[var(--muted)]">
            Registry {dry.registryVersion} · politique {dry.policyVersion} · schéma {dry.schemaVersion}
          </p>
          <p className="text-[var(--muted)]">
            Budget restant {formatMoney(dry.budgetAvailableMinor, dry.currency)} / limite{" "}
            {formatMoney(dry.budgetLimitMinor, dry.currency)}
            {dry.estimatedCostMinor != null
              ? ` · estimation principale ${formatMoney(dry.estimatedCostMinor, dry.currency)}`
              : ""}
          </p>
          {dry.warnings.map((w) => (
            <p key={w.code} className="text-[var(--muted)]">
              {w.message}
            </p>
          ))}
          {dry.missingInformation.map((m) => (
            <p key={`${m.code}-${m.field ?? ""}`} className="text-[var(--danger)]">
              {m.message}
            </p>
          ))}
        </div>
      )}
      {plan && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Révision du plan</dt>
            <dd>{plan.revision}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Registry / politique</dt>
            <dd>
              {plan.registryVersion ?? "—"} · {plan.policyVersion ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Estimation principale</dt>
            <dd>{formatMoney(plan.estimatedCostMinor, plan.currency)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Exposition max (fallbacks)</dt>
            <dd>{formatMoney(plan.maximumExposureMinor, plan.currency)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Budget restant</dt>
            <dd>{formatMoney(plan.budgetAvailableMinor, plan.currency)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Approbation</dt>
            <dd>
              {plan.approval?.status === "approved"
                ? `approuvé${plan.approval.decidedAt ? ` · ${plan.approval.decidedAt}` : ""}`
                : plan.approval?.status === "stale"
                  ? "stale (nouvelle révision active)"
                  : plan.approval?.status === "rejected"
                    ? "rejeté"
                    : "en attente"}
            </dd>
          </div>
          {plan.unknowns.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Inconnus</dt>
              <dd>{plan.unknowns.join(", ")}</dd>
            </div>
          )}
          {plan.warnings.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Warnings</dt>
              <dd>
                {plan.warnings.map((w) => (
                  <p key={w.code}>{w.message}</p>
                ))}
              </dd>
            </div>
          )}
          {plan.explanations.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Explications</dt>
              <dd>
                {plan.explanations.map((e) => (
                  <p key={e} className="text-[var(--muted)]">
                    {e}
                  </p>
                ))}
              </dd>
            </div>
          )}
          {plan.scenes && (
            <div>
              <dt className="text-[var(--muted)]">Choix par scène</dt>
              <dd>
                {plan.scenes.map((s) => (
                  <div
                    key={s.sceneId}
                    className="mb-3 border-t border-[var(--border)] pt-2 first:border-0 first:pt-0"
                  >
                    <p>
                      #{s.sceneOrder} · {s.strategy} · {s.primaryProviderId}/{s.primaryModelId}
                    </p>
                    <p className="text-[var(--muted)]">
                      Coût principal {formatMoney(s.estimatedCostMinor, plan.currency)} · durée ~{" "}
                      {s.estimatedDurationSeconds}s
                    </p>
                    {s.fallbacks.length > 0 && (
                      <p className="text-[var(--muted)]">
                        Fallbacks :{" "}
                        {s.fallbacks
                          .map((f) => `#${f.order} ${f.providerId}/${f.modelId}`)
                          .join(" · ")}
                      </p>
                    )}
                    {s.dependsOnStepIds.length > 0 && (
                      <p className="text-[var(--muted)]">
                        Dépendances : {s.dependsOnStepIds.join(", ")}
                      </p>
                    )}
                    <p className="text-[var(--muted)]">{s.selectionSummary}</p>
                  </div>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

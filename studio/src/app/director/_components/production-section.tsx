"use client";
import { useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/confirm";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";
import { shouldBlockProductionRun } from "@/lib/update-blocker-policy";
import { announceDirectorStepReady } from "./director-pipeline-events";
import type {
  ProductionProjectDryRunResult,
  ProductionRunView,
} from "@/application/directors/production/start-for-project";

function formatMoney(minor?: number, currency = "USD") {
  if (minor == null) return "—";
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

const TERMINAL = new Set(["completed", "partial", "failed", "cancelled"]);

async function fetchProjectRevision(projectId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/director/projects/${projectId}/stale`);
    if (!res.ok) return null;
    const data = (await res.json()) as { projectRevision?: number };
    return typeof data.projectRevision === "number" ? data.projectRevision : null;
  } catch {
    return null;
  }
}

export function ProductionSection({
  projectId,
  projectRevision,
  onProjectRevision,
}: {
  projectId: string;
  projectRevision: number;
  onProjectRevision?: (revision: number) => void;
}) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<ProductionProjectDryRunResult | null>(null);
  const [run, setRun] = useState<ProductionRunView | null>(null);
  const [activeProjectRevision, setActiveProjectRevision] = useState(projectRevision);
  const [busy, setBusy] = useState<"dry" | "execute" | "cancel" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useUpdateBlocker(
    shouldBlockProductionRun(busy, run?.status),
    UPDATE_BLOCKER_IDS.directorProduction,
    UPDATE_BLOCKER_REASONS.generating,
  );

  useEffect(() => {
    setActiveProjectRevision(projectRevision);
  }, [projectRevision]);

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function refresh() {
    try {
      const response = await fetch(`/api/director/projects/${projectId}/production`);
      const data = (await response.json()) as {
        dryRun?: ProductionProjectDryRunResult;
        run?: ProductionRunView | null;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Lecture production impossible.");
        return;
      }
      if (data.dryRun) setDry(data.dryRun);
      const next = data.run ?? data.dryRun?.existingRun ?? null;
      setRun(next);
      if (!next || TERMINAL.has(next.status)) stopPoll();
      if (next && (next.status === "completed" || next.status === "partial")) {
        announceDirectorStepReady("production");
      }
    } catch {
      setError("Lecture production impossible.");
    }
  }

  function startPoll() {
    stopPoll();
    pollRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh();
    }, 2000);
  }

  useEffect(() => {
    void refresh();
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [projectId]);

  useEffect(() => {
    if (run && !TERMINAL.has(run.status)) startPoll();
    else stopPoll();
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.runId, run?.status]);

  async function check() {
    if (busy) return;
    setBusy("dry");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/production`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = (await response.json()) as {
        dryRun?: ProductionProjectDryRunResult;
        error?: string;
      };
      if (!response.ok) setError(data.error ?? "Vérification impossible.");
      else if (data.dryRun) {
        setDry(data.dryRun);
        setRun(data.dryRun.existingRun ?? run);
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
      title: "Démarrer la production ?",
      message:
        "Le Production Director crée le run et enfile les jobs racine. Les providers restent des fakes locaux — aucun appel réseau réel.",
      confirmLabel: "Démarrer",
    });
    if (!ok) return;

    setBusy("execute");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/production`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          expectedGenerationPlanRevision: dry.generationPlanRevision,
          confirmation: true,
        }),
      });
      const data = (await response.json()) as {
        run?: ProductionRunView;
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Démarrage impossible.";
        setError(msg);
      } else if (data.run) {
        setRun(data.run);
        startPoll();
      }
    } catch {
      setError("Démarrage impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (busy || !run || TERMINAL.has(run.status)) return;
    const ok = await confirm({
      title: "Annuler la production ?",
      message: `Run ${run.runId.slice(0, 8)}… · révision ${run.revision}. Les jobs en cours seront arrêtés proprement.`,
      confirmLabel: "Annuler la production",
    });
    if (!ok) return;

    setBusy("cancel");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/production/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: run.runId,
          expectedRunRevision: run.revision,
          reason: "Annulation demandée depuis l'UI Director",
          confirmation: true,
        }),
      });
      const data = (await response.json()) as {
        run?: ProductionRunView;
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Annulation impossible.";
        setError(msg);
      } else if (data.run) setRun(data.run);
    } catch {
      setError("Annulation impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function approveMissing(artifactType: "video_project_brief" | "storyboard_project") {
    if (busy || !dry) return;
    const artifactId =
      artifactType === "video_project_brief" ? dry.briefArtifactId : dry.storyboardArtifactId;
    const revision =
      artifactType === "video_project_brief" ? dry.briefRevision : dry.storyboardRevision;
    if (!artifactId || !revision) return;

    const label = artifactType === "video_project_brief" ? "Brief" : "Storyboard";
    const ok = await confirm({
      title: `Approuver le ${label} ?`,
      message: `Révision ${revision}. Requis avant production (REQUIRED_FOR_PRODUCTION).`,
      confirmLabel: "Approuver",
    });
    if (!ok) return;

    setBusy("approve");
    setError(null);
    try {
      let expected = activeProjectRevision;
      let response = await fetch(`/api/director/projects/${projectId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifactType,
          artifactId,
          revision,
          decision: "approved",
          expectedProjectRevision: expected,
          confirmation: true,
        }),
      });
      // Révision projet peut avoir avancé (ex. approbation GenerationPlan) sans remonter ici.
      if (response.status === 409) {
        const fresh = await fetchProjectRevision(projectId);
        if (fresh != null && fresh !== expected) {
          expected = fresh;
          setActiveProjectRevision(fresh);
          onProjectRevision?.(fresh);
          response = await fetch(`/api/director/projects/${projectId}/approvals`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              artifactType,
              artifactId,
              revision,
              decision: "approved",
              expectedProjectRevision: expected,
              confirmation: true,
            }),
          });
        }
      }
      const data = (await response.json()) as {
        approval?: { projectRevision: number };
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Approbation impossible.";
        setError(msg);
      } else {
        if (data.approval) {
          setActiveProjectRevision(data.approval.projectRevision);
          onProjectRevision?.(data.approval.projectRevision);
        }
        await check();
      }
    } catch {
      setError("Approbation impossible.");
    } finally {
      setBusy(null);
    }
  }

  const missingApprovals =
    dry?.approvals.filter((a) => a.status === "none" || a.status === "stale" || a.status === "missing") ??
    [];

  return (
    <section className="mt-10" aria-labelledby="production-heading">
      <h2 id="production-heading" className="text-base font-semibold mb-2">
        Production
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Orchestration multi-étapes via Production Director + file durable. Providers fakes uniquement —
        aucun appel OpenAI / fal / ElevenLabs réel.
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        <button type="button" className="btn btn-primary" onClick={check} disabled={busy != null}>
          {busy === "dry" ? "Vérification…" : "Vérifier la production"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={execute}
          disabled={busy != null || !dry?.executionAvailable}
        >
          {busy === "execute" ? "Démarrage…" : "Démarrer la production"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={cancel}
          disabled={busy != null || !run || TERMINAL.has(run.status)}
        >
          {busy === "cancel" ? "Annulation…" : "Annuler"}
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
            Dry-run · {dry.executable ? "prêt" : "non prêt"} · exécution{" "}
            {dry.executionAvailable ? "disponible" : "indisponible"} · providerCalled: false
          </p>
          <p className="text-[var(--muted)]">
            Plan rév. {dry.generationPlanRevision || "—"} · readiness{" "}
            {dry.readiness.ready ? "OK" : "incomplet"}
          </p>
          <p className="text-[var(--muted)]">
            Budget restant {formatMoney(dry.budgetAvailableMinor, dry.currency)} / limite{" "}
            {formatMoney(dry.budgetLimitMinor, dry.currency)}
            {dry.estimatedCostMinor != null
              ? ` · estimation ${formatMoney(dry.estimatedCostMinor, dry.currency)}`
              : ""}
          </p>
          <div className="mt-2">
            <p className="text-[var(--muted)] mb-1">Approbations requises</p>
            {dry.approvals.map((a) => (
              <p key={a.artifactType}>
                {a.artifactType}: {a.status}
                {a.revision != null ? ` · rév. ${a.revision}` : ""}
              </p>
            ))}
          </div>
          {missingApprovals.some((a) => a.artifactType === "video_project_brief") && (
            <button
              type="button"
              className="btn btn-ghost mt-2 mr-2"
              onClick={() => approveMissing("video_project_brief")}
              disabled={busy != null}
            >
              Approuver le Brief
            </button>
          )}
          {missingApprovals.some((a) => a.artifactType === "storyboard_project") && (
            <button
              type="button"
              className="btn btn-ghost mt-2"
              onClick={() => approveMissing("storyboard_project")}
              disabled={busy != null}
            >
              Approuver le Storyboard
            </button>
          )}
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
      {run && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Statut du run</dt>
            <dd className="font-medium">{run.status}</dd>
          </div>
          {/* Honest step summary from durable run data only — never invent %. */}
          <div>
            <dt className="text-[var(--muted)]">Progression réelle</dt>
            <dd data-testid="production-real-progress">
              {(() => {
                const steps = run.scenes.flatMap((s) => s.steps);
                const done = steps.filter((st) => st.status === "completed").length;
                const total = steps.length;
                const active = steps.find(
                  (st) =>
                    st.status === "running" ||
                    st.status === "waiting_provider" ||
                    st.status === "queued",
                );
                const parts = [
                  total > 0
                    ? `${done} étape${done === 1 ? "" : "s"} terminée${done === 1 ? "" : "s"} sur ${total}`
                    : `${run.scenes.length} scène${run.scenes.length === 1 ? "" : "s"}`,
                ];
                if (run.waitingReason) {
                  parts.push(run.waitingReason);
                } else if (active?.status === "waiting_provider") {
                  parts.push("En attente du fournisseur");
                } else if (active) {
                  parts.push(`Étape ${active.stepId} · ${active.status}`);
                }
                if (TERMINAL.has(run.status)) {
                  parts.push(`État terminal : ${run.status}`);
                }
                return parts.join(" · ");
              })()}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Révision run / plan</dt>
            <dd>
              run {run.revision} · plan {run.generationPlanRevision}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Coûts</dt>
            <dd>
              estimé {formatMoney(run.estimatedCostMinor, run.currency)} · engagé{" "}
              {formatMoney(run.committedCostMinor, run.currency)} · libéré{" "}
              {formatMoney(run.releasedCostMinor, run.currency)}
            </dd>
          </div>
          {run.waitingReason && (
            <div>
              <dt className="text-[var(--muted)]">Attente</dt>
              <dd>{run.waitingReason}</dd>
            </div>
          )}
          {run.warnings.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Warnings</dt>
              <dd>
                {run.warnings.map((w) => (
                  <p key={w.code}>{w.message}</p>
                ))}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[var(--muted)]">Scènes / étapes</dt>
            <dd>
              {run.scenes.map((s) => (
                <div
                  key={s.sceneId}
                  className="mb-3 border-t border-[var(--border)] pt-2 first:border-0 first:pt-0"
                >
                  <p>
                    #{s.sceneOrder} · {s.sceneId} · {s.status}
                  </p>
                  {s.steps.map((st) => (
                    <p key={st.stepId} className="text-[var(--muted)] pl-2">
                      {st.stepId}: {st.status}
                      {st.providerId ? ` · ${st.providerId}` : ""}
                      {st.modelId ? `/${st.modelId}` : ""}
                      {st.attemptCount > 0 ? ` · ${st.attemptCount} tentative(s)` : ""}
                    </p>
                  ))}
                </div>
              ))}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

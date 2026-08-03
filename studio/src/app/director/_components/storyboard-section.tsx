"use client";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import type { StoryboardProjectDryRunResult, StoryboardProjectView } from "@/application/directors/storyboard/analyze-for-project";

export function StoryboardSection({ projectId, initialStoryboard = null }: { projectId: string; initialStoryboard?: StoryboardProjectView | null }) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<StoryboardProjectDryRunResult | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardProjectView | null>(initialStoryboard);
  const [busy, setBusy] = useState<"dry" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function check() {
    if (busy) return; setBusy("dry"); setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/storyboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "dry_run" }) });
      const data = await response.json() as { dryRun?: StoryboardProjectDryRunResult; error?: string };
      if (!response.ok) setError(data.error ?? "Vérification impossible.");
      else if (data.dryRun) { setDry(data.dryRun); setStoryboard(data.dryRun.existingStoryboard ?? storyboard); }
    } catch { setError("Vérification impossible."); } finally { setBusy(null); }
  }
  async function execute() {
    if (busy || !dry?.executionAvailable) return;
    if (!await confirm({ title: "Lancer le storyboard ?", message: "Cet appel est payant. Les artefacts actifs ne seront pas modifiés.", confirmLabel: "Produire le storyboard" })) return;
    setBusy("execute"); setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/storyboard`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          expectedVisualDirectionRevision: dry.visualDirectionRevision,
          expectedVideoScriptRevision: dry.videoScriptRevision,
          expectedCreativeConceptRevision: dry.creativeConceptRevision,
          expectedMarketingPlanRevision: dry.marketingPlanRevision,
        }),
      });
      const data = await response.json() as { storyboard?: StoryboardProjectView; error?: { message?: string } };
      if (!response.ok) setError(data.error?.message ?? "Storyboard impossible.");
      else if (data.storyboard) setStoryboard(data.storyboard);
    } catch { setError("Storyboard impossible."); } finally { setBusy(null); }
  }
  return (
    <section className="mt-10" aria-labelledby="storyboard-heading">
      <h2 id="storyboard-heading" className="text-base font-semibold mb-2">Storyboard</h2>
      <p className="text-sm text-[var(--muted)] mb-4">Le storyboard est construit à partir de la chaîne complète incluant la Direction art active.</p>
      <div className="flex flex-wrap gap-3 mb-4">
        <button type="button" className="btn btn-primary" onClick={check} disabled={busy != null}>{busy === "dry" ? "Vérification…" : "Vérifier les prérequis"}</button>
        <button type="button" className="btn btn-ghost" onClick={execute} disabled={busy != null || !dry?.executionAvailable}>{busy === "execute" ? "Production…" : "Produire le storyboard"}</button>
      </div>
      {error && <p className="text-sm text-[var(--danger)] mb-2" role="alert">{error}</p>}
      {dry && (
        <div className="card p-4 mb-4 text-sm">
          <p>Dry-run · {dry.executable ? "prêt" : "pré-requis incomplets"} · exécution {dry.executionAvailable ? "disponible" : "indisponible"}</p>
          {dry.warnings.map((w) => <p key={w.code} className="text-[var(--muted)]">{w.message}</p>)}
          {dry.missingInformation.map((m) => <p key={m.code} className="text-[var(--danger)]">{m.message}</p>)}
        </div>
      )}
      {storyboard && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div><dt className="text-[var(--muted)]">Révision</dt><dd>{storyboard.revision}</dd></div>
          {storyboard.title && <div><dt className="text-[var(--muted)]">Titre</dt><dd>{storyboard.title}</dd></div>}
          {storyboard.sceneCount != null && (
            <div><dt className="text-[var(--muted)]">Scènes</dt><dd>{storyboard.sceneCount}{storyboard.totalDurationSeconds != null ? ` · ${storyboard.totalDurationSeconds}s total` : ""}</dd></div>
          )}
          {storyboard.scenes && (
            <div>
              <dt className="text-[var(--muted)]">Plan</dt>
              <dd>{storyboard.scenes.map((s) => <p key={s.id}>#{s.order} {s.purpose} · {s.durationSeconds}s</p>)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

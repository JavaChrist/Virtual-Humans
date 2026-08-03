"use client";
import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import type { ArtProjectDryRunResult, VisualDirectionView } from "@/application/directors/art/analyze-for-project";

export function ArtSection({ projectId, initialVisualDirection = null }: { projectId: string; initialVisualDirection?: VisualDirectionView | null }) {
  const confirm = useConfirm();
  const [dry, setDry] = useState<ArtProjectDryRunResult | null>(null);
  const [visualDirection, setVisualDirection] = useState<VisualDirectionView | null>(initialVisualDirection);
  const [busy, setBusy] = useState<"dry" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function check() {
    if (busy) return; setBusy("dry"); setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/art`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "dry_run" }) });
      const data = await response.json() as { dryRun?: ArtProjectDryRunResult; error?: string };
      if (!response.ok) setError(data.error ?? "Vérification impossible.");
      else if (data.dryRun) { setDry(data.dryRun); setVisualDirection(data.dryRun.existingVisualDirection ?? visualDirection); }
    } catch { setError("Vérification impossible."); } finally { setBusy(null); }
  }
  async function execute() {
    if (busy || !dry?.executionAvailable) return;
    if (!await confirm({ title: "Lancer la direction art ?", message: "Cet appel est payant. Les artefacts actifs ne seront pas modifiés.", confirmLabel: "Produire la direction art" })) return;
    setBusy("execute"); setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/art`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "execute", expectedVideoScriptRevision: dry.videoScriptRevision, expectedCreativeConceptRevision: dry.creativeConceptRevision, expectedMarketingPlanRevision: dry.marketingPlanRevision }),
      });
      const data = await response.json() as { visualDirection?: VisualDirectionView; error?: { message?: string } };
      if (!response.ok) setError(data.error?.message ?? "Direction art impossible.");
      else if (data.visualDirection) setVisualDirection(data.visualDirection);
    } catch { setError("Direction art impossible."); } finally { setBusy(null); }
  }
  return (
    <section className="mt-10" aria-labelledby="art-heading">
      <h2 id="art-heading" className="text-base font-semibold mb-2">Direction art</h2>
      <p className="text-sm text-[var(--muted)] mb-4">La direction visuelle est construite à partir du Brief, du Marketing Plan, du Creative Concept et du Script actifs.</p>
      <div className="flex flex-wrap gap-3 mb-4">
        <button type="button" className="btn btn-primary" onClick={check} disabled={busy != null}>{busy === "dry" ? "Vérification…" : "Vérifier les prérequis"}</button>
        <button type="button" className="btn btn-ghost" onClick={execute} disabled={busy != null || !dry?.executionAvailable}>{busy === "execute" ? "Production…" : "Produire la direction art"}</button>
      </div>
      {error && <p className="text-sm text-[var(--danger)] mb-2" role="alert">{error}</p>}
      {dry && (
        <div className="card p-4 mb-4 text-sm">
          <p>Dry-run · {dry.executable ? "prêt" : "pré-requis incomplets"} · exécution {dry.executionAvailable ? "disponible" : "indisponible"}</p>
          {dry.warnings.map((w) => <p key={w.code} className="text-[var(--muted)]">{w.message}</p>)}
          {dry.missingInformation.map((m) => <p key={m.code} className="text-[var(--danger)]">{m.message}</p>)}
        </div>
      )}
      {visualDirection && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div><dt className="text-[var(--muted)]">Révision</dt><dd>{visualDirection.revision}</dd></div>
          {visualDirection.globalStyle && (
            <div><dt className="text-[var(--muted)]">Style global</dt><dd>{visualDirection.globalStyle.style} · {visualDirection.globalStyle.mood} · {visualDirection.globalStyle.realism}</dd></div>
          )}
          {visualDirection.palette && visualDirection.palette.length > 0 && (
            <div>
              <dt className="text-[var(--muted)]">Palette</dt>
              <dd>{visualDirection.palette.map((c) => <span key={c.name} className="inline-block mr-3">{c.name} {c.hex}</span>)}</dd>
            </div>
          )}
          {visualDirection.segments && (
            <div>
              <dt className="text-[var(--muted)]">Segments</dt>
              <dd>{visualDirection.segments.map((s) => <p key={s.id}>{s.shotSize} · {s.location}</p>)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";
import { shouldBlockMergeExportInFlight } from "@/lib/update-blocker-policy";
import { buildMergeExportSectionView } from "./merge-export-section-view";

export function MergeExportSection() {
  const [busy, setBusy] = useState<"dry" | "execute" | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [localNote, setLocalNote] = useState<string | null>(null);
  const view = useMemo(
    () =>
      buildMergeExportSectionView({
        videoResolved: true,
        audioResolved: true,
        lipsyncResolved: true,
        bundleCoherent: true,
        runtimeOff: true,
      }),
    [],
  );

  useUpdateBlocker(
    shouldBlockMergeExportInFlight(busy, runStatus),
    UPDATE_BLOCKER_IDS.directorMergeExport,
    UPDATE_BLOCKER_REASONS.generating,
  );

  return (
    <section className="card p-6 mt-8" aria-labelledby="director-merge-export-title">
      <h3 id="director-merge-export-title" className="font-semibold mb-1">
        {view.title}
      </h3>
      <p className="text-xs text-[var(--muted)] mb-4" role="status">
        {view.disabledReason}
      </p>
      <dl className="grid gap-2 text-sm mb-4">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Bundle</dt>
          <dd>{view.bundleResolved ? "Résolu (métadonnées explicites)" : "Incohérent"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Merge</dt>
          <dd>{view.mergeReadiness === "prepared_disabled" ? "Préparé mais désactivé" : "Bloqué"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Export</dt>
          <dd>{view.exportReadiness === "prepared_disabled" ? "Préparé mais désactivé" : "Bloqué"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">QC / Human Review</dt>
          <dd>Préparé · non persisté · non approuvé</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Publication</dt>
          <dd>Non autorisée</dd>
        </div>
      </dl>
      <ul className="text-sm text-[var(--muted)] space-y-1 mb-4">
        {view.blockingReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setBusy("dry");
            setRunStatus(null);
            setLocalNote("Dry-run local : chemin préparé, aucun moteur, aucun fichier, aucun blocker.");
            setBusy(null);
          }}
        >
          Dry-run local
        </button>
        <button type="button" className="btn" disabled>
          Merge réel indisponible
        </button>
        <button type="button" className="btn" disabled>
          Export réel indisponible
        </button>
      </div>
      {localNote ? (
        <p className="text-xs text-[var(--muted)] mt-3" role="status">
          {localNote}
        </p>
      ) : null}
    </section>
  );
}

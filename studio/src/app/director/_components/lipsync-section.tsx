"use client";

import { useMemo, useState } from "react";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";
import { shouldBlockLipsyncInFlight } from "@/lib/update-blocker-policy";
import { buildLipsyncSectionView } from "./lipsync-section-view";
import { announceDirectorStepReady } from "./director-pipeline-events";

export function LipsyncSection({
  videoResolved = false,
  audioResolved = false,
}: {
  videoResolved?: boolean;
  audioResolved?: boolean;
}) {
  const [busy, setBusy] = useState<"dry" | "execute" | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [localNote, setLocalNote] = useState<string | null>(null);
  const [fakePrepared, setFakePrepared] = useState(false);
  const view = useMemo(
    () =>
      buildLipsyncSectionView({
        videoResolved,
        audioResolved,
        runtimeOff: true,
        fakeState: fakePrepared ? "completed" : null,
      }),
    [videoResolved, audioResolved, fakePrepared],
  );

  useUpdateBlocker(
    shouldBlockLipsyncInFlight(busy, runStatus),
    UPDATE_BLOCKER_IDS.directorLipsync,
    UPDATE_BLOCKER_REASONS.generating,
  );

  return (
    <section id="section-lipsync" className="card p-6 mt-8" aria-labelledby="director-lipsync-title" data-testid="director-lipsync-section">
      <h3 id="director-lipsync-title" className="font-semibold mb-1">
        {view.title}
      </h3>
      <p className="text-xs text-[var(--muted)] mb-4" role="status">
        {view.disabledReason}
      </p>
      <dl className="grid gap-2 text-sm mb-4">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Vidéo</dt>
          <dd>{view.videoResolved ? "Référence explicite résolue (métadonnées)" : "Absente"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">Voix</dt>
          <dd>{view.audioResolved ? "Référence explicite résolue (métadonnées)" : "Absente"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--muted)]">État</dt>
          <dd>{view.readiness === "prepared_disabled" ? "Préparé mais désactivé" : "Bloqué"}</dd>
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
            setFakePrepared(true);
            setLocalNote(
              "Lipsync fake local : métadonnées synthétiques uniquement. Aucun média réel, aucun moteur distant.",
            );
            announceDirectorStepReady("lipsync");
            setBusy(null);
          }}
          disabled={!videoResolved || !audioResolved}
        >
          Préparer le fake local
        </button>
        <button type="button" className="btn" disabled>
          Exécution réelle indisponible
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { PageHeader } from "@/components/page-header";
import { useConfirm } from "@/components/confirm";
import {
  DIRECTOR_BRIEF_DRAFT_KEY,
  DIRECTOR_DRAFT_CHANGED_EVENT,
  clearBriefDraft,
  hasBriefDraft,
} from "@/application/director/draft";

const PLANNED_STEPS = [
  "Brief",
  "Stratégie",
  "Script",
  "Storyboard",
  "Production",
  "Export",
] as const;

function subscribeDraftStorage(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === DIRECTOR_BRIEF_DRAFT_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DIRECTOR_DRAFT_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DIRECTOR_DRAFT_CHANGED_EVENT, onChange);
  };
}

function useHasBriefDraft(): boolean {
  return useSyncExternalStore(subscribeDraftStorage, hasBriefDraft, () => false);
}

export function DirectorHome() {
  const router = useRouter();
  const confirm = useConfirm();
  const hasDraft = useHasBriefDraft();

  async function startFresh() {
    if (hasDraft) {
      const ok = await confirm({
        title: "Nouveau projet",
        message:
          "Un brouillon local existe déjà. Le remplacer effacera le brief en cours (non synchronisé).",
        confirmLabel: "Effacer et recommencer",
        danger: true,
      });
      if (!ok) return;
      clearBriefDraft();
    }
    router.push("/director/new");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Réalisateur IA"
        subtitle="V2 — aperçu · parcours guidé à partir d’un brief simple"
      />

      <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
        Décrivez votre intention (produit, objectif, plateforme, personnage). Les étapes
        suivantes — stratégie, script, storyboard, production — arriveront progressivement.
        Aucun fournisseur ni modèle à choisir ici.
      </p>

      <ol className="mb-8 grid gap-2 sm:grid-cols-2">
        {PLANNED_STEPS.map((label, i) => (
          <li
            key={label}
            className="card px-4 py-3 text-sm flex items-center gap-3"
          >
            <span className="text-[var(--accent-2)] font-semibold tabular-nums w-6">{i + 1}.</span>
            <span>
              {label}
              {i === 0 ? (
                <span className="text-[var(--muted)]"> — disponible</span>
              ) : (
                <span className="text-[var(--muted)]"> — bientôt</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={startFresh}>
          Créer une vidéo
        </button>
        {hasDraft && (
          <Link href="/director/new" className="btn btn-ghost">
            Reprendre le brouillon
          </Link>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--muted)]">
        Le brouillon est sauvegardé uniquement dans ce navigateur. Les Directeurs métier et
        la production ne sont pas encore actifs.
      </p>
    </div>
  );
}

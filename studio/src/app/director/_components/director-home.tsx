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
import type { DirectorProjectListItem } from "@/application/projects/list-director-projects";
import { formatDirectorDateTime } from "./format-director-datetime";

const PLANNED_STEPS = [
  "Brief",
  "Stratégie",
  "Script",
  "Storyboard",
  "Production",
  "Export",
] as const;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  youtube_shorts: "YouTube Shorts",
};

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

export type DirectorHomeProps = {
  persistenceEnabled?: boolean;
  recentProjects?: DirectorProjectListItem[];
  listError?: string | null;
};

export function DirectorHome({
  persistenceEnabled = false,
  recentProjects = [],
  listError = null,
}: DirectorHomeProps) {
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

      {hasDraft && (
        <p className="mt-4 text-xs text-[var(--muted)]" role="status">
          Brouillon local présent dans ce navigateur (non synchronisé avec les projets
          serveur).
        </p>
      )}

      {persistenceEnabled && (
        <section className="mt-10" aria-labelledby="recent-projects-heading">
          <h2 id="recent-projects-heading" className="text-base font-semibold mb-3">
            Projets récents
          </h2>
          {listError && (
            <p className="text-sm text-[var(--danger)] mb-3" role="status">
              {listError} — vous pouvez tout de même créer un nouveau projet.
            </p>
          )}
          {!listError && recentProjects.length === 0 && (
            <p className="text-sm text-[var(--muted)]" role="status">
              Aucun projet persisté pour l’instant.
            </p>
          )}
          {recentProjects.length > 0 && (
            <ul className="space-y-2">
              {recentProjects.map((p) => {
                const updated = new Date(p.updatedAt);
                return (
                  <li
                    key={p.id}
                    className="card px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {p.status}
                        {p.platform
                          ? ` · ${PLATFORM_LABELS[p.platform] ?? p.platform}`
                          : ""}
                        {p.durationSeconds != null ? ` · ${p.durationSeconds}s` : ""}
                        {" · "}
                        {Number.isNaN(updated.getTime())
                          ? p.updatedAt
                          : formatDirectorDateTime(updated)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Link href={`/director/${p.id}`} className="btn btn-ghost text-sm">
                        Reprendre
                      </Link>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Consultable · génération indisponible
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <p className="mt-6 text-xs text-[var(--muted)]">
        {persistenceEnabled
          ? "Les projets et le brief peuvent être enregistrés. Les capacités de génération restent indisponibles. Un projet existant peut être ouvert en lecture, mais son exécution est désactivée."
          : "Le brouillon est sauvegardé uniquement dans ce navigateur. La génération n’est pas encore disponible."}
      </p>
    </div>
  );
}

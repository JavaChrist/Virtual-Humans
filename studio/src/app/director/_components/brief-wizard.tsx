"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useConfirm } from "@/components/confirm";
import { useCharacter } from "@/lib/character-context";
import {
  AspectRatioValues,
  DurationValues,
  ObjectiveValues,
  PlatformValues,
  SubjectTypeValues,
  ToneValues,
  defaultAspectRatioForPlatform,
  finalizeBrief,
  isBriefDomainError,
  normalizeBriefFields,
  type BriefPlatform,
  type VideoProjectBrief,
} from "@/domain/brief";
import {
  DIRECTOR_BRIEF_STEPS,
  DIRECTOR_BRIEF_STEP_COUNT,
  clampStep,
} from "@/application/director/progress";
import { useBriefDraft } from "./use-brief-draft";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";

export type BriefWizardProps = {
  /** Server-resolved: DIRECTOR_V2_ENABLED ∧ DIRECTOR_V2_PERSISTENCE_ENABLED */
  persistenceEnabled?: boolean;
};

const OBJECTIVE_LABELS: Record<(typeof ObjectiveValues)[number], string> = {
  awareness: "Notoriété",
  traffic: "Trafic",
  lead_generation: "Génération de leads",
  conversion: "Conversion",
  education: "Éducation",
  engagement: "Engagement",
};

const PLATFORM_LABELS: Record<(typeof PlatformValues)[number], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  youtube_shorts: "YouTube Shorts",
};

const TONE_LABELS: Record<(typeof ToneValues)[number], string> = {
  warm: "Chaleureux",
  professional: "Professionnel",
  energetic: "Énergique",
  calm: "Calme",
  playful: "Enjoué",
  authoritative: "Autoritaire",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-[var(--danger)] mt-1" role="alert">
      {message}
    </p>
  );
}

export function BriefWizard({ persistenceEnabled = false }: BriefWizardProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const { characters, ready: charactersReady } = useCharacter();
  const { draft, statusLabel, status, hydrated, patchFields, setStep, resetDraft, flush } =
    useBriefDraft();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [finalBrief, setFinalBrief] = useState<VideoProjectBrief | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createIdsRef = useRef<{ projectId: string; artifactId: string } | null>(null);
  useUpdateBlocker(
    submitting,
    UPDATE_BLOCKER_IDS.directorProjectCreate,
    UPDATE_BLOCKER_REASONS.saving,
  );

  const step = clampStep(draft.currentStep);
  const fields = draft.fields;

  const stepValid = useMemo(() => {
    const f = fields;
    switch (step) {
      case 0:
        return Boolean(f.projectName?.trim() && f.subjectType && f.subjectName?.trim() && f.subjectDescription?.trim());
      case 1:
        return Boolean(f.objective);
      case 2:
        return Boolean(f.platform && f.durationSeconds && f.aspectRatio);
      case 3:
        return Boolean(f.tone && f.language?.trim());
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [fields, step]);

  function goNext() {
    setFieldErrors({});
    setFinalizeError(null);
    setFinalBrief(null);
    if (step < DIRECTOR_BRIEF_STEP_COUNT - 1) {
      setStep(step + 1);
      return;
    }
  }

  function goBack() {
    setFieldErrors({});
    setFinalizeError(null);
    if (step > 0) setStep(step - 1);
  }

  function onPlatformChange(platform: BriefPlatform) {
    const suggested = defaultAspectRatioForPlatform(platform);
    patchFields({
      platform,
      aspectRatio: fields.aspectRatio ?? suggested,
    });
  }

  function tryFinalize() {
    flush();
    setFinalizeError(null);
    setFieldErrors({});
    try {
      const brief = finalizeBrief(draft, {
        id: `brief_local_${Date.now()}`,
        projectId: `proj_local_${Date.now()}`,
        createdBy: "local-user",
        correlationId: `corr-brief-${Date.now()}`,
      });
      setFinalBrief(brief);
    } catch (e) {
      if (isBriefDomainError(e)) {
        setFinalizeError(e.publicMessage);
        if (e.field) setFieldErrors({ [e.field]: e.publicMessage });
      } else {
        setFinalizeError("Impossible de valider le brief.");
      }
    }
  }

  async function createPersistedProject() {
    if (submitting) return;
    flush();
    setFinalizeError(null);
    setFieldErrors({});
    let fields;
    try {
      fields = normalizeBriefFields({ ...draft.fields });
    } catch (e) {
      if (isBriefDomainError(e)) {
        setFinalizeError(e.publicMessage);
        if (e.field) setFieldErrors({ [e.field]: e.publicMessage });
      } else {
        setFinalizeError("Impossible de valider le brief.");
      }
      return;
    }

    setSubmitting(true);
    try {
      if (!createIdsRef.current) {
        createIdsRef.current = {
          projectId: crypto.randomUUID(),
          artifactId: crypto.randomUUID(),
        };
      }
      const { projectId, artifactId } = createIdsRef.current;

      const res = await fetch("/api/director/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          artifactId,
          expectedBriefRevision: 1,
          fields,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        projectId?: string;
      };
      if (!res.ok) {
        setFinalizeError(data.error || "Création du projet impossible.");
        return;
      }
      // Clear local draft only after confirmed server success.
      resetDraft();
      setFinalBrief(null);
      router.push(`/director/${data.projectId ?? projectId}`);
    } catch {
      setFinalizeError("Création du projet impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onClear() {
    const ok = await confirm({
      title: "Effacer le brouillon",
      message: "Supprimer le brief local de ce navigateur ?",
      confirmLabel: "Effacer",
      danger: true,
    });
    if (!ok) return;
    resetDraft();
    setFinalBrief(null);
    setFinalizeError(null);
    setFieldErrors({});
  }

  if (!hydrated) {
    return <p className="text-sm text-[var(--muted)]">Chargement du brouillon…</p>;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Nouveau brief"
        subtitle={
          persistenceEnabled
            ? "Étape du parcours Réalisateur IA · brouillon local · création projet à la finalisation"
            : "Étape du parcours Réalisateur IA · sauvegarde locale uniquement"
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <p className="text-sm text-[var(--muted)]">
          Étape {step + 1} / {DIRECTOR_BRIEF_STEP_COUNT} — {DIRECTOR_BRIEF_STEPS[step].label}
        </p>
        <p
          className="text-xs text-[var(--muted)]"
          aria-live="polite"
          aria-atomic="true"
          data-autosave-status={status}
        >
          {statusLabel}
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 mb-6" aria-label="Progression du brief">
        {DIRECTOR_BRIEF_STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`text-xs px-2 py-1 rounded border ${
                i === step
                  ? "border-[var(--accent)] text-white"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
            >
              {i + 1}. {s.label}
            </button>
          </li>
        ))}
      </ol>

      <div className="card p-5 space-y-4">
        {step === 0 && (
          <>
            <div>
              <label className="label" htmlFor="projectName">
                Nom du projet
              </label>
              <input
                id="projectName"
                className="input w-full"
                value={fields.projectName ?? ""}
                onChange={(e) => patchFields({ projectName: e.target.value })}
                aria-describedby={fieldErrors.projectName ? "err-projectName" : undefined}
                required
              />
              <FieldError id="err-projectName" message={fieldErrors.projectName} />
            </div>
            <div>
              <label className="label" htmlFor="subjectType">
                Type de sujet
              </label>
              <select
                id="subjectType"
                className="select w-full"
                value={fields.subjectType ?? ""}
                onChange={(e) =>
                  patchFields({
                    subjectType: e.target.value as (typeof SubjectTypeValues)[number],
                  })
                }
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {SubjectTypeValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="subjectName">
                Nom du sujet
              </label>
              <input
                id="subjectName"
                className="input w-full"
                value={fields.subjectName ?? ""}
                onChange={(e) => patchFields({ subjectName: e.target.value })}
                aria-describedby={fieldErrors.subjectName ? "err-subjectName" : undefined}
              />
              <FieldError id="err-subjectName" message={fieldErrors.subjectName} />
            </div>
            <div>
              <label className="label" htmlFor="subjectDescription">
                Description
              </label>
              <textarea
                id="subjectDescription"
                className="input w-full min-h-[100px]"
                value={fields.subjectDescription ?? ""}
                onChange={(e) => patchFields({ subjectDescription: e.target.value })}
                aria-describedby={fieldErrors.subjectDescription ? "err-subjectDescription" : undefined}
              />
              <FieldError id="err-subjectDescription" message={fieldErrors.subjectDescription} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <label className="label" htmlFor="objective">
                Objectif
              </label>
              <select
                id="objective"
                className="select w-full"
                value={fields.objective ?? ""}
                onChange={(e) =>
                  patchFields({ objective: e.target.value as (typeof ObjectiveValues)[number] })
                }
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {ObjectiveValues.map((v) => (
                  <option key={v} value={v}>
                    {OBJECTIVE_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="audienceDescription">
                Audience (optionnel)
              </label>
              <textarea
                id="audienceDescription"
                className="input w-full min-h-[80px]"
                value={fields.audienceDescription ?? ""}
                onChange={(e) => patchFields({ audienceDescription: e.target.value })}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="label" htmlFor="platform">
                Plateforme
              </label>
              <select
                id="platform"
                className="select w-full"
                value={fields.platform ?? ""}
                onChange={(e) => onPlatformChange(e.target.value as BriefPlatform)}
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {PlatformValues.map((v) => (
                  <option key={v} value={v}>
                    {PLATFORM_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="durationSeconds">
                Durée
              </label>
              <select
                id="durationSeconds"
                className="select w-full"
                value={fields.durationSeconds ?? ""}
                onChange={(e) =>
                  patchFields({ durationSeconds: Number(e.target.value) as 15 | 20 | 30 | 60 })
                }
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {DurationValues.map((v) => (
                  <option key={v} value={v}>
                    {v} secondes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="aspectRatio">
                Format
              </label>
              <select
                id="aspectRatio"
                className="select w-full"
                value={fields.aspectRatio ?? ""}
                onChange={(e) =>
                  patchFields({
                    aspectRatio: e.target.value as (typeof AspectRatioValues)[number],
                  })
                }
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {AspectRatioValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted)] mt-1">
                Suggestion selon la plateforme — vous pouvez la modifier.
              </p>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="label" htmlFor="tone">
                Ton
              </label>
              <select
                id="tone"
                className="select w-full"
                value={fields.tone ?? ""}
                onChange={(e) =>
                  patchFields({ tone: e.target.value as (typeof ToneValues)[number] })
                }
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {ToneValues.map((v) => (
                  <option key={v} value={v}>
                    {TONE_LABELS[v]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="language">
                Langue
              </label>
              <input
                id="language"
                className="input w-full"
                value={fields.language ?? "fr"}
                onChange={(e) => patchFields({ language: e.target.value })}
                placeholder="fr, en, fr-FR…"
                aria-describedby={fieldErrors.language ? "err-language" : undefined}
              />
              <FieldError id="err-language" message={fieldErrors.language} />
            </div>
            <div>
              <label className="label" htmlFor="characterId">
                Personnage
              </label>
              <select
                id="characterId"
                className="select w-full"
                value={fields.characterId ?? ""}
                onChange={(e) =>
                  patchFields({ characterId: e.target.value || undefined })
                }
                disabled={!charactersReady}
              >
                <option value="">Aucun personnage</option>
                {!charactersReady && <option value="" disabled>Chargement…</option>}
                {charactersReady && characters.length === 0 && (
                  <option value="" disabled>
                    Aucun personnage disponible
                  </option>
                )}
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <label className="label" htmlFor="callToAction">
                Appel à l’action (optionnel)
              </label>
              <input
                id="callToAction"
                className="input w-full"
                value={fields.callToAction ?? ""}
                onChange={(e) => patchFields({ callToAction: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="brandConstraints">
                Contraintes de marque (optionnel)
              </label>
              <textarea
                id="brandConstraints"
                className="input w-full min-h-[80px]"
                value={fields.brandConstraints ?? ""}
                onChange={(e) => patchFields({ brandConstraints: e.target.value })}
              />
            </div>
            <p className="text-xs text-[var(--muted)]">
              Les références média (captures, logos) pourront être liées plus tard — sans
              fichier binaire dans le brouillon.
            </p>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="text-base font-semibold">Récapitulatif</h2>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Projet</dt>
                <dd>{fields.projectName || "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Sujet</dt>
                <dd>
                  {fields.subjectType || "—"} · {fields.subjectName || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Objectif</dt>
                <dd>
                  {fields.objective ? OBJECTIVE_LABELS[fields.objective] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Format</dt>
                <dd>
                  {fields.platform ? PLATFORM_LABELS[fields.platform] : "—"} ·{" "}
                  {fields.durationSeconds ?? "—"}s · {fields.aspectRatio || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Ton / langue</dt>
                <dd>
                  {fields.tone ? TONE_LABELS[fields.tone] : "—"} · {fields.language || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Personnage</dt>
                <dd>
                  {fields.characterId
                    ? characters.find((c) => c.id === fields.characterId)?.name ??
                      fields.characterId
                    : "Aucun"}
                </dd>
              </div>
            </dl>

            {persistenceEnabled ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={createPersistedProject}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Création en cours…" : "Créer le projet"}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={tryFinalize}>
                Valider le brief
              </button>
            )}

            {finalizeError && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {finalizeError}
              </p>
            )}

            {submitting && (
              <p className="text-sm text-[var(--muted)]" role="status" aria-live="polite">
                Enregistrement du projet…
              </p>
            )}

            {!persistenceEnabled && finalBrief && (
              <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
                <p className="font-semibold text-[var(--accent-2)]">Brief prêt</p>
                <p className="text-sm text-[var(--muted)]">
                  Objet métier validé en mémoire locale — non persisté sur un serveur.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled
                  title="Prochaine étape — pas encore disponible"
                >
                  Analyse marketing — prochainement
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 items-center">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={goBack}>
            Retour
          </button>
        ) : (
          <Link href="/director" className="btn btn-ghost">
            Accueil Réalisateur
          </Link>
        )}
        {step < DIRECTOR_BRIEF_STEP_COUNT - 1 && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={goNext}
            disabled={!stepValid}
          >
            Continuer
          </button>
        )}
        <button type="button" className="btn btn-ghost text-[var(--danger)] ml-auto" onClick={onClear}>
          Effacer le brouillon
        </button>
      </div>
    </div>
  );
}

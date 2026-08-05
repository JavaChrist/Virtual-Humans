"use client";

import { useState } from "react";
import { useConfirm } from "@/components/confirm";
import {
  AspectRatioValues,
  DurationValues,
  ObjectiveValues,
  PlatformValues,
  SubjectTypeValues,
  ToneValues,
  type VideoProjectBriefFields,
} from "@/domain/brief";
import type { BriefFieldChange } from "@/domain/project";
import type { ArtifactType } from "@/domain/project";
import { formatDirectorDateTime } from "./format-director-datetime";

export type BriefSectionInitial = {
  id: string;
  revision: number;
  projectName: string;
  platform: string;
  durationSeconds: number;
  language: string;
  characterId?: string;
  objective: string;
  subjectName: string;
  subjectType: string;
  subjectDescription: string;
  aspectRatio: string;
  tone: string;
  callToAction?: string;
  audienceDescription?: string;
  brandConstraints?: string;
  createdAt: string;
};

type Props = {
  projectId: string;
  projectRevision: number;
  initialBrief: BriefSectionInitial;
  onRevised?: (info: {
    projectRevision: number;
    briefRevision: number;
    staleTypes: ArtifactType[];
    restartPoint: ArtifactType;
  }) => void;
};

type EditableFields = {
  projectName: string;
  subjectType: string;
  subjectName: string;
  subjectDescription: string;
  objective: string;
  platform: string;
  durationSeconds: number;
  aspectRatio: string;
  language: string;
  tone: string;
  callToAction: string;
  audienceDescription: string;
  brandConstraints: string;
};

function toEditable(b: BriefSectionInitial): EditableFields {
  return {
    projectName: b.projectName,
    subjectType: b.subjectType,
    subjectName: b.subjectName,
    subjectDescription: b.subjectDescription,
    objective: b.objective,
    platform: b.platform,
    durationSeconds: b.durationSeconds,
    aspectRatio: b.aspectRatio,
    language: b.language,
    tone: b.tone,
    callToAction: b.callToAction ?? "",
    audienceDescription: b.audienceDescription ?? "",
    brandConstraints: b.brandConstraints ?? "",
  };
}

function toPatch(fields: EditableFields): Partial<VideoProjectBriefFields> {
  return {
    projectName: fields.projectName.trim(),
    subjectType: fields.subjectType as VideoProjectBriefFields["subjectType"],
    subjectName: fields.subjectName.trim(),
    subjectDescription: fields.subjectDescription.trim(),
    objective: fields.objective as VideoProjectBriefFields["objective"],
    platform: fields.platform as VideoProjectBriefFields["platform"],
    durationSeconds: fields.durationSeconds as VideoProjectBriefFields["durationSeconds"],
    aspectRatio: fields.aspectRatio as VideoProjectBriefFields["aspectRatio"],
    language: fields.language.trim(),
    tone: fields.tone as VideoProjectBriefFields["tone"],
    callToAction: fields.callToAction.trim() || undefined,
    audienceDescription: fields.audienceDescription.trim() || undefined,
    brandConstraints: fields.brandConstraints.trim() || undefined,
  };
}

export function BriefSection({
  projectId,
  projectRevision: initialProjectRevision,
  initialBrief,
  onRevised,
}: Props) {
  const confirm = useConfirm();
  const [brief, setBrief] = useState(initialBrief);
  const [projectRevision, setProjectRevision] = useState(initialProjectRevision);
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<EditableFields>(() => toEditable(initialBrief));
  const [busy, setBusy] = useState<"dry-run" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [changes, setChanges] = useState<BriefFieldChange[]>([]);
  const [wouldInvalidate, setWouldInvalidate] = useState<ArtifactType[]>([]);
  const [restartPoint, setRestartPoint] = useState<ArtifactType>("marketing_plan");
  const [history, setHistory] = useState<
    Array<{ revision: number; createdAt: string; projectName: string; isActive: boolean }>
  >([]);
  const [compareChanges, setCompareChanges] = useState<BriefFieldChange[]>([]);

  function patch(partial: Partial<EditableFields>) {
    setFields((f) => ({ ...f, ...partial }));
  }

  async function loadHistory() {
    try {
      const res = await fetch(`/api/director/projects/${projectId}/brief/revisions`);
      const data = (await res.json()) as {
        revisions?: Array<{
          revision: number;
          createdAt: string;
          projectName: string;
          isActive: boolean;
        }>;
        error?: string;
      };
      if (res.ok && data.revisions) setHistory(data.revisions);
    } catch {
      /* ignore */
    }
  }

  async function loadCompare() {
    try {
      const res = await fetch(`/api/director/projects/${projectId}/brief/compare`);
      const data = (await res.json()) as {
        comparison?: { changes?: BriefFieldChange[] };
      };
      if (res.ok) setCompareChanges(data.comparison?.changes ?? []);
    } catch {
      /* ignore */
    }
  }

  async function startEdit() {
    setEditing(true);
    setFields(toEditable(brief));
    setError(null);
    setStatusMsg(null);
    setChanges([]);
    await Promise.all([loadHistory(), loadCompare()]);
  }

  async function previewChanges() {
    if (busy) return;
    setBusy("dry-run");
    setError(null);
    setStatusMsg("Prévisualisation des changements…");
    try {
      const res = await fetch(`/api/director/projects/${projectId}/brief/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry-run", fields: toPatch(fields) }),
      });
      const data = (await res.json()) as {
        dryRun?: {
          executable: boolean;
          identical: boolean;
          changes: BriefFieldChange[];
          wouldInvalidate: ArtifactType[];
          restartPoint: ArtifactType;
          validations: Array<{ message: string }>;
        };
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Prévisualisation impossible.");
        setStatusMsg(null);
        return;
      }
      if (data.dryRun) {
        setChanges(data.dryRun.changes);
        setWouldInvalidate(data.dryRun.wouldInvalidate);
        setRestartPoint(data.dryRun.restartPoint);
        setStatusMsg(
          data.dryRun.identical
            ? "Aucun changement — révision refusée."
            : `${data.dryRun.changes.length} champ(s) modifié(s).`,
        );
      }
    } catch {
      setError("Prévisualisation impossible.");
      setStatusMsg(null);
    } finally {
      setBusy(null);
    }
  }

  async function submitRevision() {
    if (busy || changes.length === 0) return;
    const ok = await confirm({
      title: "Créer une nouvelle révision du brief ?",
      message: [
        "L'ancienne révision sera conservée (immuable).",
        `${changes.length} champ(s) modifié(s).`,
        wouldInvalidate.length
          ? `Artifacts qui seront marqués obsolètes : ${wouldInvalidate.join(", ")}.`
          : "Aucun descendant à invalider.",
        `Point de reprise recommandé : ${restartPoint}.`,
      ].join("\n"),
      confirmLabel: "Créer la révision",
    });
    if (!ok) return;

    setBusy("execute");
    setError(null);
    setStatusMsg("Création de la révision…");
    try {
      const res = await fetch(`/api/director/projects/${projectId}/brief/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          fields: toPatch(fields),
          expectedBriefRevision: brief.revision,
          expectedProjectRevision: projectRevision,
          confirmation: true,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        code?: string;
        brief?: BriefSectionInitial & { id: string };
        projectRevision?: number;
        staleTypes?: ArtifactType[];
        restartPoint?: ArtifactType;
        changes?: BriefFieldChange[];
      };
      if (res.status === 409) {
        setError(data.error || "Conflit de révision — rechargez la page.");
        setStatusMsg(null);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Révision impossible.");
        setStatusMsg(null);
        return;
      }
      if (data.brief) {
        const next: BriefSectionInitial = {
          ...brief,
          ...data.brief,
          subjectType: fields.subjectType,
          subjectDescription: fields.subjectDescription,
          aspectRatio: fields.aspectRatio,
          tone: fields.tone,
          callToAction: fields.callToAction || undefined,
          audienceDescription: fields.audienceDescription || undefined,
          brandConstraints: fields.brandConstraints || undefined,
          createdAt: new Date().toISOString(),
        };
        setBrief(next);
        if (data.projectRevision != null) setProjectRevision(data.projectRevision);
        setEditing(false);
        setStatusMsg(
          `Révision ${data.brief.revision} active. Reprise : ${data.restartPoint ?? "marketing_plan"}.`,
        );
        onRevised?.({
          projectRevision: data.projectRevision ?? projectRevision + 1,
          briefRevision: data.brief.revision,
          staleTypes: data.staleTypes ?? [],
          restartPoint: data.restartPoint ?? "marketing_plan",
        });
        await loadHistory();
        await loadCompare();
      }
    } catch {
      setError("Révision impossible.");
      setStatusMsg(null);
    } finally {
      setBusy(null);
    }
  }

  const created = new Date(brief.createdAt);

  return (
    <section className="mb-8" aria-labelledby="brief-section-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h2 id="brief-section-heading" className="text-base font-semibold">
          Brief
        </h2>
        <span className="text-xs text-[var(--muted)]" aria-live="polite">
          révision {brief.revision} · projet rev. {projectRevision}
        </span>
      </div>
      <p className="text-sm text-[var(--muted)] mb-4 leading-relaxed">
        Modification contrôlée : une nouvelle révision immuable est créée ; les descendants
        dont la provenance dépend de l&apos;ancienne révision deviennent obsolètes.
      </p>

      {!editing ? (
        <>
          <dl className="card p-5 grid gap-3 text-sm mb-4">
            <div>
              <dt className="text-[var(--muted)]">Nom</dt>
              <dd className="font-medium">{brief.projectName}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Sujet</dt>
              <dd>
                {brief.subjectName} ({brief.subjectType})
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Plateforme</dt>
              <dd>{brief.platform}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Durée / format</dt>
              <dd>
                {brief.durationSeconds}s · {brief.aspectRatio}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Langue / ton</dt>
              <dd>
                {brief.language} · {brief.tone}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">Actif depuis</dt>
              <dd>
                {Number.isNaN(created.getTime())
                  ? brief.createdAt
                  : formatDirectorDateTime(created)}
              </dd>
            </div>
          </dl>
          <button type="button" className="btn btn-primary" onClick={startEdit}>
            Modifier le brief
          </button>
        </>
      ) : (
        <div className="card p-5 space-y-4">
          <div>
            <label className="label" htmlFor="brief-edit-projectName">
              Nom du projet
            </label>
            <input
              id="brief-edit-projectName"
              className="input w-full"
              value={fields.projectName}
              onChange={(e) => patch({ projectName: e.target.value })}
              maxLength={80}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="brief-edit-subjectName">
              Nom du sujet
            </label>
            <input
              id="brief-edit-subjectName"
              className="input w-full"
              value={fields.subjectName}
              onChange={(e) => patch({ subjectName: e.target.value })}
              maxLength={120}
            />
          </div>
          <div>
            <label className="label" htmlFor="brief-edit-subjectDescription">
              Description
            </label>
            <textarea
              id="brief-edit-subjectDescription"
              className="input w-full min-h-[100px]"
              value={fields.subjectDescription}
              onChange={(e) => patch({ subjectDescription: e.target.value })}
              maxLength={800}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="brief-edit-subjectType">
                Type de sujet
              </label>
              <select
                id="brief-edit-subjectType"
                className="select w-full"
                value={fields.subjectType}
                onChange={(e) => patch({ subjectType: e.target.value })}
              >
                {SubjectTypeValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="brief-edit-objective">
                Objectif
              </label>
              <select
                id="brief-edit-objective"
                className="select w-full"
                value={fields.objective}
                onChange={(e) => patch({ objective: e.target.value })}
              >
                {ObjectiveValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="brief-edit-platform">
                Plateforme
              </label>
              <select
                id="brief-edit-platform"
                className="select w-full"
                value={fields.platform}
                onChange={(e) => patch({ platform: e.target.value })}
              >
                {PlatformValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="brief-edit-duration">
                Durée (s)
              </label>
              <select
                id="brief-edit-duration"
                className="select w-full"
                value={fields.durationSeconds}
                onChange={(e) => patch({ durationSeconds: Number(e.target.value) })}
              >
                {DurationValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="brief-edit-aspect">
                Format
              </label>
              <select
                id="brief-edit-aspect"
                className="select w-full"
                value={fields.aspectRatio}
                onChange={(e) => patch({ aspectRatio: e.target.value })}
              >
                {AspectRatioValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="brief-edit-tone">
                Ton
              </label>
              <select
                id="brief-edit-tone"
                className="select w-full"
                value={fields.tone}
                onChange={(e) => patch({ tone: e.target.value })}
              >
                {ToneValues.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="brief-edit-language">
              Langue
            </label>
            <input
              id="brief-edit-language"
              className="input w-full"
              value={fields.language}
              onChange={(e) => patch({ language: e.target.value })}
              maxLength={16}
            />
          </div>
          <div>
            <label className="label" htmlFor="brief-edit-cta">
              Appel à l&apos;action
            </label>
            <input
              id="brief-edit-cta"
              className="input w-full"
              value={fields.callToAction}
              onChange={(e) => patch({ callToAction: e.target.value })}
              maxLength={160}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={previewChanges}
              disabled={busy != null}
              aria-busy={busy === "dry-run"}
            >
              {busy === "dry-run" ? "Analyse…" : "Prévisualiser"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitRevision}
              disabled={busy != null || changes.length === 0}
              aria-busy={busy === "execute"}
            >
              {busy === "execute" ? "Enregistrement…" : "Créer la révision"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditing(false);
                setError(null);
                setChanges([]);
              }}
              disabled={busy != null}
            >
              Annuler
            </button>
          </div>

          {changes.length > 0 && (
            <div className="text-sm space-y-2" role="region" aria-label="Résumé des changements">
              <p className="font-medium">Changements prévus</p>
              <ul className="list-disc pl-5 text-xs text-[var(--muted)]">
                {changes.map((c) => (
                  <li key={c.field}>
                    {c.field}: {String(c.before ?? "—")} → {String(c.after ?? "—")}
                  </li>
                ))}
              </ul>
              {wouldInvalidate.length > 0 && (
                <p className="text-xs text-[var(--danger)]">
                  Seront marqués obsolètes : {wouldInvalidate.join(", ")}. Reprise :{" "}
                  {restartPoint}.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {statusMsg && (
        <p className="text-sm text-[var(--muted)] mt-3" role="status" aria-live="polite">
          {statusMsg}
        </p>
      )}
      {error && (
        <p className="text-sm text-[var(--danger)] mt-3" role="alert">
          {error}
        </p>
      )}

      {(history.length > 1 || compareChanges.length > 0) && (
        <div className="mt-4 text-sm space-y-2">
          {history.length > 1 && (
            <>
              <p className="font-medium">Historique</p>
              <ul className="list-disc pl-5 text-xs text-[var(--muted)]">
                {[...history].reverse().map((r) => (
                  <li key={r.revision}>
                    rev. {r.revision}
                    {r.isActive ? " (active)" : ""} — {r.projectName} —{" "}
                    {formatDirectorDateTime(r.createdAt)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {compareChanges.length > 0 && (
            <>
              <p className="font-medium mt-2">Comparaison active / précédente</p>
              <ul className="list-disc pl-5 text-xs text-[var(--muted)]">
                {compareChanges.map((c) => (
                  <li key={`cmp-${c.field}`}>
                    {c.field}: {String(c.before ?? "—")} → {String(c.after ?? "—")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

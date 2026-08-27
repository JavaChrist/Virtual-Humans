"use client";
import { useState } from "react";
import { useUpdateBlocker } from "@/lib/use-update-blocker";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "@/lib/update-blocker-reasons";
import { shouldBlockNonDryBusy } from "@/lib/update-blocker-policy";
import type {
  PromptProjectDryRunResult,
  ScenePackageSetView,
} from "@/application/directors/prompt/build-for-project";

export function PromptSection({
  projectId,
  initialPackageSet = null,
}: {
  projectId: string;
  initialPackageSet?: ScenePackageSetView | null;
}) {
  const [dry, setDry] = useState<PromptProjectDryRunResult | null>(null);
  const [packageSet, setPackageSet] = useState<ScenePackageSetView | null>(initialPackageSet);
  const [busy, setBusy] = useState<"dry" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  useUpdateBlocker(
    shouldBlockNonDryBusy(busy, ["dry"]),
    UPDATE_BLOCKER_IDS.directorPrompts,
    UPDATE_BLOCKER_REASONS.generating,
  );

  async function check() {
    if (busy) return;
    setBusy("dry");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run" }),
      });
      const data = (await response.json()) as {
        dryRun?: PromptProjectDryRunResult;
        error?: string;
      };
      if (!response.ok) setError(data.error ?? "Vérification impossible.");
      else if (data.dryRun) {
        setDry(data.dryRun);
        setPackageSet(data.dryRun.existingPackageSet ?? packageSet);
      }
    } catch {
      setError("Vérification impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function execute() {
    if (busy || !dry?.executionAvailable) return;
    setBusy("execute");
    setError(null);
    try {
      const response = await fetch(`/api/director/projects/${projectId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "execute",
          expectedStoryboardRevision: dry.storyboardRevision,
          expectedVisualDirectionRevision: dry.visualDirectionRevision,
          expectedVideoScriptRevision: dry.videoScriptRevision,
        }),
      });
      const data = (await response.json()) as {
        packageSet?: ScenePackageSetView;
        error?: { message?: string } | string;
      };
      if (!response.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ?? "Construction impossible.";
        setError(msg);
      } else if (data.packageSet) setPackageSet(data.packageSet);
    } catch {
      setError("Construction impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="prompt-heading">
      <h2 id="prompt-heading" className="text-base font-semibold mb-2">
        Packages scènes
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Construction déterministe des ScenePackages à partir du Storyboard actif — aucun appel
        provider.
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={check}
          disabled={busy != null}
        >
          {busy === "dry" ? "Vérification…" : "Vérifier les prérequis"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={execute}
          disabled={busy != null || !dry?.executionAvailable}
        >
          {busy === "execute" ? "Construction…" : "Construire les packages"}
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
            Renderer {dry.rendererVersion} · schéma {dry.schemaVersion}
          </p>
          {dry.warnings.map((w) => (
            <p key={w.code} className="text-[var(--muted)]">
              {w.message}
            </p>
          ))}
          {dry.missingInformation.map((m) => (
            <p key={m.code} className="text-[var(--danger)]">
              {m.message}
            </p>
          ))}
        </div>
      )}
      {packageSet && (
        <dl className="card p-5 grid gap-3 text-sm">
          <div>
            <dt className="text-[var(--muted)]">Révision du lot</dt>
            <dd>{packageSet.revision}</dd>
          </div>
          {packageSet.sceneCount != null && (
            <div>
              <dt className="text-[var(--muted)]">Scènes couvertes</dt>
              <dd>{packageSet.sceneCount}</dd>
            </div>
          )}
          {packageSet.rendererVersion && (
            <div>
              <dt className="text-[var(--muted)]">Renderer</dt>
              <dd>{packageSet.rendererVersion}</dd>
            </div>
          )}
          {packageSet.packages && (
            <div>
              <dt className="text-[var(--muted)]">Packages</dt>
              <dd>
                {packageSet.packages.map((p) => (
                  <div key={p.sceneId} className="mb-3 border-t border-[var(--border)] pt-2 first:border-0 first:pt-0">
                    <p>
                      #{p.sceneOrder} · {p.productionIntent}
                      {p.hasDialogue ? " · dialogue" : ""}
                      {p.hasScreenText ? " · texte écran" : ""}
                    </p>
                    <p className="text-[var(--muted)]">
                      Profils : {p.capabilityProfiles.join(", ") || "—"}
                    </p>
                    <p className="text-[var(--muted)]">
                      Blocs : {p.blocks.join(", ")} · contraintes {p.constraintCount} · refs{" "}
                      {p.referenceCount}
                    </p>
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

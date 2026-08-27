"use client";

import type { DirectorPipelineProgressView } from "./director-pipeline-progress-model";

export function DirectorPipelineProgress({
  view,
}: {
  view: DirectorPipelineProgressView;
}) {
  return (
    <nav
      className="card p-4 mb-6"
      aria-label="Progression du réalisateur"
      data-testid="director-pipeline-progress"
    >
      <p className="text-sm font-medium mb-2" role="status" aria-live="polite">
        Étape actuelle : {view.currentLabel}
      </p>
      <p className="text-xs text-[var(--muted)] mb-3" data-testid="director-pipeline-summary">
        {view.summary}
      </p>
      <ol className="flex flex-wrap gap-2">
        {view.steps.map((step) => {
          const isCurrent = step.state === "current";
          const muted = step.state === "locked" || step.state === "prepared_disabled";
          return (
            <li key={step.id}>
              <a
                href={step.href}
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  borderColor: "var(--border)",
                  opacity: muted ? 0.7 : 1,
                  background: isCurrent ? "var(--surface-2, transparent)" : "transparent",
                }}
                aria-current={isCurrent ? "step" : undefined}
                data-state={step.state}
              >
                <span>{step.label}</span>
                <span className="sr-only">
                  {step.state === "done"
                    ? "terminé"
                    : step.state === "current"
                      ? "en cours"
                      : step.state === "prepared_disabled"
                        ? "préparé mais désactivé"
                        : "verrouillé"}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Normalization for Storyboard analysis candidates.
 */

import type { StoryboardAnalysisCandidate } from "./storyboard-project";
import { STORYBOARD_FIELD_LIMITS } from "./storyboard-project";
import { defaultTransitionForScene } from "./transitions";

function clean(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeStoryboardCandidate(
  candidate: StoryboardAnalysisCandidate,
): StoryboardAnalysisCandidate {
  const sorted = [...candidate.scenes].sort((a, b) => a.order - b.order);
  const scenes = sorted.map((sc, i) => {
    const isLast = i === sorted.length - 1;
    // Do not rewrite order values — non-contiguous orders must fail validation.
    const transition = sc.transition
      ? {
          type: isLast ? ("none" as const) : sc.transition.type,
          ...(sc.transition.durationSeconds != null
            ? { durationSeconds: sc.transition.durationSeconds }
            : {}),
          ...(sc.transition.justification
            ? {
                justification: clean(
                  sc.transition.justification,
                  STORYBOARD_FIELD_LIMITS.transitionJustification,
                ),
              }
            : {}),
        }
      : defaultTransitionForScene(isLast);

    const refs = new Map<string, (typeof sc.references)[number]>();
    for (const r of sc.references) {
      const key = `${r.kind}:${r.sourceId}:${r.role}`;
      if (!refs.has(key)) {
        refs.set(key, {
          id: r.id.trim(),
          kind: r.kind,
          sourceId: r.sourceId.trim(),
          role: clean(r.role, STORYBOARD_FIELD_LIMITS.referenceRole),
          required: r.required,
        });
      }
    }

    const spoken =
      sc.spokenContent.kind === "none"
        ? { kind: "none" as const }
        : sc.spokenContent.kind === "dialogue"
          ? {
              kind: "dialogue" as const,
              sourceText: clean(
                sc.spokenContent.sourceText,
                STORYBOARD_FIELD_LIMITS.spokenText,
              ),
              ...(sc.spokenContent.characterId
                ? { characterId: sc.spokenContent.characterId.trim() }
                : {}),
            }
          : {
              kind: "voice_over" as const,
              sourceText: clean(
                sc.spokenContent.sourceText,
                STORYBOARD_FIELD_LIMITS.spokenText,
              ),
            };

    return {
      id: sc.id.trim(),
      order: sc.order,
      title: clean(sc.title, STORYBOARD_FIELD_LIMITS.sceneTitle),
      purpose: sc.purpose,
      scriptSegmentId: sc.scriptSegmentId.trim(),
      visualDirectionSegmentId: sc.visualDirectionSegmentId.trim(),
      productionIntent: sc.productionIntent,
      spokenContent: spoken,
      ...(sc.screenText
        ? { screenText: clean(sc.screenText, STORYBOARD_FIELD_LIMITS.screenText) }
        : {}),
      references: [...refs.values()],
      transition,
      continuityKeys: [...new Set(sc.continuityKeys.map((k) => k.trim()).filter(Boolean))],
      ...(sc.durationSeconds != null ? { durationSeconds: sc.durationSeconds } : {}),
    };
  });

  return {
    title: clean(candidate.title, STORYBOARD_FIELD_LIMITS.title),
    scenes,
    ...(candidate.intentionalBreaks
      ? { intentionalBreaks: candidate.intentionalBreaks.map((b) => ({ ...b })) }
      : {}),
    ...(candidate.assumptions
      ? {
          assumptions: candidate.assumptions.map((a) => ({
            ...a,
            statement: clean(a.statement, STORYBOARD_FIELD_LIMITS.assumptionStatement),
          })),
        }
      : {}),
    ...(candidate.notes
      ? { notes: clean(candidate.notes, 400) }
      : {}),
    ...(candidate.sceneCountJustification
      ? {
          sceneCountJustification: clean(candidate.sceneCountJustification, 240),
        }
      : {}),
    // Drop claimed total — never trust
  };
}

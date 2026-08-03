import type { PromptAnalysisCandidate } from "./scene-package";
import { PROMPT_FIELD_LIMITS } from "./scene-package";

function clean(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizePromptCandidate(
  candidate: PromptAnalysisCandidate,
): PromptAnalysisCandidate {
  return {
    ...(candidate.sceneHints
      ? {
          sceneHints: candidate.sceneHints.map((h) => ({
            sceneId: h.sceneId.trim(),
            ...(h.primaryActionHint
              ? {
                  primaryActionHint: clean(
                    h.primaryActionHint,
                    PROMPT_FIELD_LIMITS.action,
                  ),
                }
              : {}),
            ...(h.motionIntensityHint
              ? { motionIntensityHint: h.motionIntensityHint }
              : {}),
            ...(h.notes ? { notes: clean(h.notes, 400) } : {}),
          })),
        }
      : {}),
    ...(candidate.assumptions
      ? {
          assumptions: candidate.assumptions.map((a) => ({
            ...a,
            statement: clean(a.statement, PROMPT_FIELD_LIMITS.assumptionStatement),
          })),
        }
      : {}),
    ...(candidate.notes ? { notes: clean(candidate.notes, 400) } : {}),
  };
}

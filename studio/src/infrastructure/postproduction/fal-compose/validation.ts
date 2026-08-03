/**
 * Shared invariants for FalComposeInput — must not reject historically valid merge inputs.
 */

export type FalComposeValidationIssue = {
  code: string;
  message: string;
};

export function validateFalComposeInput(input: {
  clips: Array<{ sourceUrl: string; durationSeconds: number }>;
}): FalComposeValidationIssue[] {
  const issues: FalComposeValidationIssue[] = [];
  if (!Array.isArray(input.clips) || input.clips.length < 2) {
    issues.push({
      code: "too_few_clips",
      message: "Au moins 2 clips sont requis pour l'assemblage",
    });
  }
  for (let i = 0; i < (input.clips?.length ?? 0); i++) {
    const c = input.clips[i]!;
    if (typeof c.sourceUrl !== "string" || c.sourceUrl.length === 0) {
      issues.push({ code: "empty_url", message: `URL vide à l'index ${i}.` });
    }
    if (!Number.isFinite(c.durationSeconds) || c.durationSeconds <= 0) {
      issues.push({
        code: "invalid_duration",
        message: `Durée invalide à l'index ${i}.`,
      });
    }
  }
  return issues;
}

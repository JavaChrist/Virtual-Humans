import { SCRIPT_FIELD_LIMITS, type ScriptAnalysisCandidate, type ScriptSegment } from "./video-script";
import { normalizeLanguageTag } from "./timing";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanBoundedText(value: string, max: number): string {
  const cleaned = collapseWhitespace(value);
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd();
}

export function normalizeSegment(segment: ScriptSegment): ScriptSegment {
  const L = SCRIPT_FIELD_LIMITS;
  const out: ScriptSegment = {
    id: segment.id.trim(),
    order: segment.order,
    purpose: segment.purpose,
    speaker: segment.speaker,
    emotion: cleanBoundedText(segment.emotion, L.emotion),
    pauseAfterMs: segment.pauseAfterMs,
    pronunciationNotes: segment.pronunciationNotes.map((n) => ({
      term: cleanBoundedText(n.term, L.pronunciationTerm),
      pronunciation: cleanBoundedText(n.pronunciation, L.pronunciationValue),
      ...(n.language ? { language: normalizeLanguageTag(n.language) } : {}),
    })),
  };
  if (segment.dialogue?.trim()) out.dialogue = cleanBoundedText(segment.dialogue, L.dialogue);
  if (segment.voiceOver?.trim()) out.voiceOver = cleanBoundedText(segment.voiceOver, L.voiceOver);
  if (segment.screenText?.trim()) out.screenText = cleanBoundedText(segment.screenText, L.screenText);
  return out;
}

export function normalizeScriptCandidate(
  candidate: ScriptAnalysisCandidate,
): ScriptAnalysisCandidate {
  const L = SCRIPT_FIELD_LIMITS;
  return {
    title: cleanBoundedText(candidate.title, L.title),
    summary: cleanBoundedText(candidate.summary, L.summary),
    language: normalizeLanguageTag(candidate.language),
    hookText: cleanBoundedText(candidate.hookText, L.hookText),
    segments: candidate.segments.map(normalizeSegment),
    callToActionText: cleanBoundedText(candidate.callToActionText, L.ctaText),
    adaptationNote: candidate.adaptationNote
      ? cleanBoundedText(candidate.adaptationNote, L.ctaAdaptationNote)
      : undefined,
    assumptions: candidate.assumptions?.map((a) => ({
      ...a,
      statement: cleanBoundedText(a.statement, L.assumptionStatement),
      justification: a.justification
        ? cleanBoundedText(a.justification, L.assumptionJustification)
        : undefined,
    })),
    claimedEvidence: candidate.claimedEvidence?.map((e) => ({
      ...e,
      field: cleanBoundedText(e.field, L.evidenceField),
      summary: cleanBoundedText(e.summary, L.evidenceSummary),
      sourcePath: e.sourcePath
        ? cleanBoundedText(e.sourcePath, L.evidenceSourcePath)
        : undefined,
    })),
    notes: candidate.notes ? cleanBoundedText(candidate.notes, 500) : undefined,
  };
}

/**
 * Fold accents for CTA action token comparison.
 */
export function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Extract rough action tokens from a CTA (verbs / imperatives).
 */
export function extractCtaActionTokens(cta: string): string[] {
  const folded = foldText(cta);
  const stop = new Set([
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "de",
    "du",
    "et",
    "ou",
    "a",
    "au",
    "aux",
    "the",
    "a",
    "an",
    "your",
    "notre",
    "votre",
    "pour",
    "avec",
    "sur",
    "app",
    "maintenant",
    "now",
    "aujourd",
    "hui",
  ]);
  return folded
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !stop.has(w))
    .slice(0, 8);
}

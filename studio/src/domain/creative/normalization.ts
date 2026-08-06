import {
  AllowedReferenceKeywordValues,
  CREATIVE_FIELD_LIMITS,
  type CreativeAnalysisCandidate,
  type EmotionalBeat,
} from "./creative-concept";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanBoundedText(value: string, max: number): string {
  const cleaned = collapseWhitespace(value);
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd();
}

const allowedKeywords = new Set<string>(AllowedReferenceKeywordValues);

export function normalizeReferenceKeywords(keywords: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of keywords) {
    const folded = cleanBoundedText(raw, CREATIVE_FIELD_LIMITS.referenceKeyword).toLowerCase();
    if (!folded || !allowedKeywords.has(folded) || seen.has(folded)) continue;
    seen.add(folded);
    out.push(folded);
    if (out.length >= CREATIVE_FIELD_LIMITS.referenceKeywordsMax) break;
  }
  return out;
}

/**
 * Array position is the canonical narrative sequence (8H-A).
 *
 * - Never reorders beats (content/sequence preserved as emitted).
 * - Assigns `order = index + 1` deterministically.
 * - Ignores any model-provided `order` (derived field, not business input).
 * - Length / emptiness / semantic gates stay in validation (hard gate).
 */
export function normalizeEmotionalArc(
  beats: ReadonlyArray<{
    order?: number;
    purpose: EmotionalBeat["purpose"];
    emotion: string;
    description: string;
  }>,
): EmotionalBeat[] {
  return beats.map((b, index) => ({
    order: index + 1,
    purpose: b.purpose,
    emotion: cleanBoundedText(b.emotion, CREATIVE_FIELD_LIMITS.emotion),
    description: cleanBoundedText(
      b.description,
      CREATIVE_FIELD_LIMITS.beatDescription,
    ),
  }));
}

/** Accepts domain candidates or analyzer candidates (beats may omit `order`). */
export function normalizeCreativeCandidate(candidate: {
  title: string;
  logline: string;
  bigIdea: string;
  narrativeApproach: CreativeAnalysisCandidate["narrativeApproach"];
  emotionalArc: ReadonlyArray<{
    order?: number;
    purpose: EmotionalBeat["purpose"];
    emotion: string;
    description: string;
  }>;
  openingDevice: CreativeAnalysisCandidate["openingDevice"];
  proofDevice?: CreativeAnalysisCandidate["proofDevice"];
  endingDevice: CreativeAnalysisCandidate["endingDevice"];
  rhythm: CreativeAnalysisCandidate["rhythm"];
  referenceKeywords: string[];
  constraints?: CreativeAnalysisCandidate["constraints"];
  assumptions?: CreativeAnalysisCandidate["assumptions"];
  claimedEvidence?: CreativeAnalysisCandidate["claimedEvidence"];
  notes?: string;
}): CreativeAnalysisCandidate {
  const L = CREATIVE_FIELD_LIMITS;
  return {
    title: cleanBoundedText(candidate.title, L.title),
    logline: cleanBoundedText(candidate.logline, L.logline),
    bigIdea: cleanBoundedText(candidate.bigIdea, L.bigIdea),
    narrativeApproach: candidate.narrativeApproach,
    emotionalArc: normalizeEmotionalArc(candidate.emotionalArc),
    openingDevice: {
      kind: candidate.openingDevice.kind,
      description: cleanBoundedText(candidate.openingDevice.description, L.deviceDescription),
    },
    proofDevice: candidate.proofDevice
      ? {
          kind: candidate.proofDevice.kind,
          description: cleanBoundedText(candidate.proofDevice.description, L.deviceDescription),
        }
      : undefined,
    endingDevice: {
      kind: candidate.endingDevice.kind,
      description: cleanBoundedText(candidate.endingDevice.description, L.deviceDescription),
    },
    rhythm: candidate.rhythm,
    referenceKeywords: normalizeReferenceKeywords(candidate.referenceKeywords),
    constraints: candidate.constraints?.map((c) => ({
      ...c,
      text: cleanBoundedText(c.text, L.constraintText),
    })),
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

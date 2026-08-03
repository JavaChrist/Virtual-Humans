/**
 * Safe, deterministic Brief field comparison for UI/history (VHS-126).
 * Business fields only — never secrets, paths, or internal metadata.
 */

import type { VideoProjectBrief, VideoProjectBriefFields } from "@/domain/brief";

export type BriefFieldChange = {
  field: keyof VideoProjectBriefFields | "mediaReferences";
  before: string | number | null;
  after: string | number | null;
};

const FIELD_ORDER: readonly (keyof VideoProjectBriefFields)[] = [
  "projectName",
  "subjectType",
  "subjectName",
  "subjectDescription",
  "objective",
  "platform",
  "durationSeconds",
  "aspectRatio",
  "language",
  "tone",
  "characterId",
  "callToAction",
  "audienceDescription",
  "brandConstraints",
] as const;

function scalar(v: unknown): string | number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  return String(v);
}

function mediaSummary(brief: Pick<VideoProjectBrief, "mediaReferences">): string {
  const refs = brief.mediaReferences ?? [];
  return refs
    .map((r) => `${r.kind}:${r.label ?? r.id}`)
    .sort()
    .join("|");
}

/** Deterministic list of changed business fields (empty = identical). */
export function diffBriefFields(
  before: Pick<VideoProjectBrief, keyof VideoProjectBriefFields | "mediaReferences">,
  after: Pick<VideoProjectBrief, keyof VideoProjectBriefFields | "mediaReferences">,
): BriefFieldChange[] {
  const changes: BriefFieldChange[] = [];
  for (const field of FIELD_ORDER) {
    const b = scalar(before[field]);
    const a = scalar(after[field]);
    if (b !== a) {
      changes.push({ field, before: b, after: a });
    }
  }
  const mb = mediaSummary(before);
  const ma = mediaSummary(after);
  if (mb !== ma) {
    changes.push({
      field: "mediaReferences",
      before: mb || null,
      after: ma || null,
    });
  }
  return changes;
}

export function briefsAreIdentical(
  before: Pick<VideoProjectBrief, keyof VideoProjectBriefFields | "mediaReferences">,
  after: Pick<VideoProjectBrief, keyof VideoProjectBriefFields | "mediaReferences">,
): boolean {
  return diffBriefFields(before, after).length === 0;
}

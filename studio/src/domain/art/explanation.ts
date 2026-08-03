import type { ArtEvidence, ArtRationale, VisualDirection } from "./visual-direction";

export function buildArtRationale(
  evidence: ArtEvidence[],
  decisions: Array<{ field: string; summary: string }>,
): ArtRationale {
  const refs = evidence.map((e) => e.field);
  return {
    summary:
      "Direction visuelle alignée sur le script, le concept créatif et les capacités Runtime disponibles.",
    decisions: decisions.map((d) => ({
      field: d.field,
      summary: d.summary,
      evidenceRefs: refs.slice(0, 4),
    })),
  };
}

export type VisualDirectionViewModel = {
  id: string;
  projectId: string;
  style: string;
  mood: string;
  segmentCount: number;
  paletteRoles: string[];
  continuityRuleCount: number;
  rationaleSummary: string;
};

export function toVisualDirectionViewModel(dir: VisualDirection): VisualDirectionViewModel {
  return {
    id: dir.id,
    projectId: dir.projectId,
    style: dir.globalStyle.style,
    mood: dir.globalStyle.mood,
    segmentCount: dir.segments.length,
    paletteRoles: dir.palette.map((p) => p.role),
    continuityRuleCount: dir.continuityRules.length,
    rationaleSummary: dir.rationale.summary,
  };
}

import type { ScriptEvidence, ScriptRationale, VideoScript } from "./video-script";

export function buildScriptRationale(
  evidence: ScriptEvidence[],
  decisions: Array<{ field: string; summary: string }>,
): ScriptRationale {
  return {
    summary:
      "Script narratif validé contre Marketing Plan et Creative Concept ; timing recalculé côté domaine.",
    decisions: decisions.map((d) => ({
      field: d.field,
      summary: d.summary,
      evidenceRefs: evidence
        .filter((e) => e.field === d.field || e.sourcePath?.includes(d.field))
        .map((e) => `${e.source}:${e.field}`)
        .slice(0, 6),
    })),
  };
}

export type VideoScriptViewModel = {
  title: string;
  summary: string;
  language: string;
  targetDurationSeconds: number;
  estimatedDurationSeconds: number;
  timingStatus: string;
  hook: string;
  cta: string;
  segments: Array<{ order: number; purpose: string; speaker: string; preview: string }>;
};

export function toVideoScriptViewModel(script: VideoScript): VideoScriptViewModel {
  return {
    title: script.title,
    summary: script.summary,
    language: script.language,
    targetDurationSeconds: script.targetDurationSeconds,
    estimatedDurationSeconds: script.estimatedDurationSeconds,
    timingStatus: script.timing.status,
    hook: script.hook.text,
    cta: script.callToAction.text,
    segments: script.segments.map((s) => ({
      order: s.order,
      purpose: s.purpose,
      speaker: s.speaker,
      preview: (s.dialogue ?? s.voiceOver ?? s.screenText ?? "").slice(0, 80),
    })),
  };
}

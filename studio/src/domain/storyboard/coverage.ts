/**
 * Segment ↔ scene coverage invariants (VHS-105).
 */

import type { VideoScript } from "@/domain/script";
import type { VisualDirection } from "@/domain/art";
import type { StoryboardValidationIssue } from "./errors";
import type { StoryboardScene } from "./scene";

function issue(code: string, message: string, field?: string): StoryboardValidationIssue {
  return { code, message, field };
}

/** Normalize spoken text for reconstruction comparison. */
export function normalizeSpokenText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function reconstructSpokenFromScenes(parts: string[]): string {
  return normalizeSpokenText(parts.join(" "));
}

export function validateSpokenReconstruction(
  scenes: StoryboardScene[],
  script: VideoScript,
): StoryboardValidationIssue[] {
  const issues: StoryboardValidationIssue[] = [];
  const bySeg = new Map<string, StoryboardScene[]>();
  for (const sc of [...scenes].sort((a, b) => a.order - b.order)) {
    const list = bySeg.get(sc.scriptSegmentId) ?? [];
    list.push(sc);
    bySeg.set(sc.scriptSegmentId, list);
  }

  for (const seg of script.segments) {
    const group = bySeg.get(seg.id) ?? [];
    const expected =
      seg.speaker === "character"
        ? seg.dialogue ?? ""
        : seg.speaker === "voice_over"
          ? seg.voiceOver ?? ""
          : "";

    if (!expected.trim()) {
      for (const sc of group) {
        if (sc.spokenContent.kind !== "none") {
          issues.push(
            issue(
              "spoken_reconstruction_failed",
              `Segment ${seg.id} sans parole mais scène parlante.`,
              `scenes.${sc.id}`,
            ),
          );
        }
      }
      continue;
    }

    const kind = seg.speaker === "character" ? "dialogue" : "voice_over";
    const parts: string[] = [];
    for (const sc of group) {
      if (sc.spokenContent.kind === "none") {
        issues.push(
          issue(
            "spoken_reconstruction_failed",
            `Scène ${sc.id} silencieuse alors que le segment a du texte.`,
            `scenes.${sc.id}`,
          ),
        );
        continue;
      }
      if (sc.spokenContent.kind !== kind) {
        issues.push(
          issue(
            "spoken_reconstruction_failed",
            `Kind parlé incohérent pour ${sc.id}.`,
            `scenes.${sc.id}.spokenContent`,
          ),
        );
      }
      parts.push(sc.spokenContent.sourceText);
    }

    const rebuilt = reconstructSpokenFromScenes(parts);
    const source = normalizeSpokenText(expected);
    if (rebuilt !== source) {
      issues.push(
        issue(
          "spoken_reconstruction_failed",
          `Reconstruction parlée ≠ source pour segment ${seg.id}.`,
          `segments.${seg.id}`,
        ),
      );
    }
  }

  return issues;
}

export function validateSceneCoverage(
  scenes: StoryboardScene[],
  script: VideoScript,
  visual: VisualDirection,
): StoryboardValidationIssue[] {
  const issues: StoryboardValidationIssue[] = [];
  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  if (sorted.length === 0) {
    issues.push(issue("coverage_violation", "Aucune scène.", "scenes"));
    return issues;
  }

  const orders = sorted.map((s) => s.order);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      issues.push(issue("invariant_violation", "Ordres de scènes non contigus.", "scenes"));
      break;
    }
  }
  const ids = sorted.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    issues.push(issue("invariant_violation", "IDs de scènes dupliqués.", "scenes"));
  }

  const scriptIds = script.segments.map((s) => s.id);
  const scriptSet = new Set(scriptIds);
  const visualByScript = new Map(
    visual.segments.map((v) => [v.scriptSegmentId, v.id] as const),
  );

  const covered = new Set<string>();
  for (const sc of sorted) {
    if (!scriptSet.has(sc.scriptSegmentId)) {
      issues.push(
        issue("coverage_violation", `Segment inconnu: ${sc.scriptSegmentId}`, `scenes.${sc.id}`),
      );
    } else {
      covered.add(sc.scriptSegmentId);
    }
    const expectedVd = visualByScript.get(sc.scriptSegmentId);
    if (!expectedVd) {
      issues.push(
        issue(
          "coverage_violation",
          `Direction visuelle absente pour segment ${sc.scriptSegmentId}`,
          `scenes.${sc.id}`,
        ),
      );
    } else if (sc.visualDirectionSegmentId !== expectedVd) {
      issues.push(
        issue(
          "coverage_violation",
          `visualDirectionSegmentId incorrect pour ${sc.id}`,
          `scenes.${sc.id}.visualDirectionSegmentId`,
        ),
      );
    }
  }

  for (const sid of scriptIds) {
    if (!covered.has(sid)) {
      issues.push(issue("coverage_violation", `Segment non couvert: ${sid}`, "scenes"));
    }
  }

  // Segment order preserved; multi-scenes of same segment must be contiguous
  const firstIndex = new Map<string, number>();
  const lastIndex = new Map<string, number>();
  sorted.forEach((sc, i) => {
    if (!firstIndex.has(sc.scriptSegmentId)) firstIndex.set(sc.scriptSegmentId, i);
    lastIndex.set(sc.scriptSegmentId, i);
  });

  let prevFirstIndex = -1;
  for (const sid of scriptIds) {
    const fi = firstIndex.get(sid);
    if (fi == null) continue;
    if (fi < prevFirstIndex) {
      issues.push(
        issue("coverage_violation", "Segments sources réordonnés dans le storyboard.", "scenes"),
      );
    }
    prevFirstIndex = fi;

    const li = lastIndex.get(sid)!;
    for (let i = fi; i <= li; i++) {
      if (sorted[i]!.scriptSegmentId !== sid) {
        issues.push(
          issue(
            "coverage_violation",
            `Scènes du segment ${sid} non contiguës.`,
            "scenes",
          ),
        );
        break;
      }
    }
  }

  // Screen text conservation: if scene has screenText, must equal segment screenText
  // (or be absent). No rewrite.
  for (const sc of sorted) {
    const seg = script.segments.find((s) => s.id === sc.scriptSegmentId);
    if (!seg) continue;
    if (sc.screenText != null && sc.screenText !== seg.screenText) {
      // Allow only exact match when present
      if (normalizeSpokenText(sc.screenText) !== normalizeSpokenText(seg.screenText ?? "")) {
        issues.push(
          issue(
            "incoherent_with_sources",
            `screenText modifié pour scène ${sc.id}.`,
            `scenes.${sc.id}.screenText`,
          ),
        );
      }
    }
  }

  issues.push(...validateSpokenReconstruction(sorted, script));
  return issues;
}

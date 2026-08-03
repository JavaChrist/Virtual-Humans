/**
 * Project VisualDirection continuity rules onto storyboard scenes (VHS-105).
 */

import type { ContinuityRule, VisualDirection } from "@/domain/art";
import type { StoryboardValidationIssue, StoryboardWarning } from "./errors";
import type { StoryboardScene } from "./scene";
import type { StoryboardContinuityReport } from "./storyboard-project";

function issue(code: string, message: string, field?: string): StoryboardValidationIssue {
  return { code, message, field };
}

function keysFromVisualSegment(
  visual: VisualDirection,
  visualDirectionSegmentId: string,
): string[] {
  const seg = visual.segments.find((s) => s.id === visualDirectionSegmentId);
  if (!seg) return [];
  const keys = [
    `location:${seg.location.continuityKey}`,
    `lighting:${seg.lighting.source}|${seg.lighting.temperature}`,
    `palette:global`,
  ];
  if (seg.character?.outfitId) keys.push(`outfit:${seg.character.outfitId}`);
  if (seg.character?.characterId) keys.push(`character:${seg.character.characterId}`);
  if (seg.environment.productVisibility !== "none") {
    keys.push(`product:${seg.environment.productVisibility}`);
  }
  keys.push(`screen_direction:${seg.composition.lookDirection}`);
  return keys;
}

export function projectContinuity(
  visual: VisualDirection,
  scenes: StoryboardScene[],
  intentionalBreaks: StoryboardContinuityReport["intentionalBreaks"] = [],
): {
  report: StoryboardContinuityReport;
  issues: StoryboardValidationIssue[];
  warnings: StoryboardWarning[];
} {
  const issues: StoryboardValidationIssue[] = [];
  const warnings: StoryboardWarning[] = [];
  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  const breakByScene = new Map(intentionalBreaks.map((b) => [b.sceneId, b]));

  const sceneKeys = sorted.map((sc) => {
    const fromVisual = keysFromVisualSegment(visual, sc.visualDirectionSegmentId);
    const declared = sc.continuityKeys ?? [];
    const br = breakByScene.get(sc.id);
    const brokenScope = br?.scope?.toLowerCase();
    // Scene must include projected keys (may add more), unless intentional break for that scope
    for (const k of fromVisual) {
      const scope = k.split(":")[0] ?? "";
      if (brokenScope && scope === brokenScope) continue;
      if (!declared.includes(k)) {
        issues.push(
          issue(
            "continuity_violation",
            `Clé de continuité manquante: ${k}`,
            `scenes.${sc.id}.continuityKeys`,
          ),
        );
      }
    }
    return { sceneId: sc.id, keys: declared.length ? declared : fromVisual };
  });

  // Detect silent outfit/location breaks vs previous scene
  for (let i = 1; i < sorted.length; i++) {
    const prev = sceneKeys[i - 1]!;
    const cur = sceneKeys[i]!;
    const prevOutfit = prev.keys.find((k) => k.startsWith("outfit:"));
    const curOutfit = cur.keys.find((k) => k.startsWith("outfit:"));
    if (prevOutfit && curOutfit && prevOutfit !== curOutfit) {
      const br = breakByScene.get(sorted[i]!.id);
      if (!br || !br.justification.trim()) {
        issues.push(
          issue(
            "continuity_violation",
            `Rupture tenue silencieuse entre ${sorted[i - 1]!.id} et ${sorted[i]!.id}.`,
            `scenes.${sorted[i]!.id}`,
          ),
        );
      }
    }
    const prevLoc = prev.keys.find((k) => k.startsWith("location:"));
    const curLoc = cur.keys.find((k) => k.startsWith("location:"));
    if (prevLoc && curLoc && prevLoc !== curLoc) {
      const br = breakByScene.get(sorted[i]!.id);
      if (!br || !br.justification.trim()) {
        issues.push(
          issue(
            "continuity_violation",
            `Rupture lieu silencieuse entre ${sorted[i - 1]!.id} et ${sorted[i]!.id}.`,
            `scenes.${sorted[i]!.id}`,
          ),
        );
      }
    }
  }

  for (const br of intentionalBreaks) {
    if (!sorted.some((s) => s.id === br.sceneId)) {
      issues.push(
        issue("continuity_violation", `Rupture sur scène inconnue: ${br.sceneId}`, "continuity"),
      );
    }
    if (!br.justification.trim()) {
      issues.push(
        issue("continuity_violation", "Rupture sans justification.", `continuity.${br.sceneId}`),
      );
    }
  }

  // Project rule ids from VisualDirection (do not mutate source rules)
  const projectedRuleIds = visual.continuityRules.map((r: ContinuityRule) => r.id);

  // Soft: required outfit stability across scenes sharing character
  for (const rule of visual.continuityRules) {
    if (rule.severity !== "required" || rule.scope !== "outfit") continue;
    const applicable = sorted.filter((sc) =>
      rule.appliesToSegmentIds.includes(
        visual.segments.find((v) => v.id === sc.visualDirectionSegmentId)?.id ?? "",
      ),
    );
    // Map rule appliesToSegmentIds which are VisualDirection segment ids
    const applicable2 = sorted.filter((sc) =>
      rule.appliesToSegmentIds.includes(sc.visualDirectionSegmentId),
    );
    const outfits = applicable2.map(
      (sc) => sceneKeys.find((k) => k.sceneId === sc.id)?.keys.find((x) => x.startsWith("outfit:")),
    );
    const unique = new Set(outfits.filter(Boolean));
    if (/\bstable\b|\bmême\b|\bsame\b|\bconserve\b/i.test(rule.description) && unique.size > 1) {
      const justified = intentionalBreaks.some((b) =>
        applicable2.some((s) => s.id === b.sceneId),
      );
      if (!justified) {
        issues.push(
          issue(
            "continuity_violation",
            `Règle tenue required non respectée (${rule.id}).`,
            `continuityRules.${rule.id}`,
          ),
        );
      } else {
        warnings.push({
          code: "continuity_break_justified",
          message: `Rupture tenue justifiée contre règle ${rule.id}.`,
        });
      }
    }
    void applicable;
  }

  return {
    report: {
      projectedRuleIds,
      sceneKeys,
      intentionalBreaks: intentionalBreaks.map((b) => ({ ...b })),
      warnings: warnings.map((w) => ({ code: w.code, message: w.message, field: w.field })),
    },
    issues,
    warnings,
  };
}

/** Build default continuity keys for a scene from VisualDirection. */
export function defaultContinuityKeys(
  visual: VisualDirection,
  visualDirectionSegmentId: string,
): string[] {
  return keysFromVisualSegment(visual, visualDirectionSegmentId);
}

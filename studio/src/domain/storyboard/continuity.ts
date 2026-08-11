/**
 * Project VisualDirection continuity rules onto storyboard scenes (VHS-105).
 */

import { createHash } from "node:crypto";
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
    // Porte 8R — appliesToSegmentIds are VideoScript segment IDs.
    // Legacy VisualDirections may still store VisualDirection segment ids;
    // accept either namespace fail-closed without fuzzy remapping.
    const applicable = sorted.filter(
      (sc) =>
        rule.appliesToSegmentIds.includes(sc.scriptSegmentId) ||
        rule.appliesToSegmentIds.includes(sc.visualDirectionSegmentId),
    );
    const outfits = applicable.map(
      (sc) => sceneKeys.find((k) => k.sceneId === sc.id)?.keys.find((x) => x.startsWith("outfit:")),
    );
    const unique = new Set(outfits.filter(Boolean));
    if (/\bstable\b|\bmême\b|\bsame\b|\bconserve\b/i.test(rule.description) && unique.size > 1) {
      const justified = intentionalBreaks.some((b) =>
        applicable.some((s) => s.id === b.sceneId),
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

/**
 * Authoritative map used by Storyboard prompt + dry-run gates.
 *
 * Naming: these tokens are **mandatory for projectContinuity**, independent of
 * VisualDirection.continuityRules severity (required vs preferred/advisory).
 * Preferred rules never authorize omitting a projected segment token.
 * Prompt delimiter: MANDATORY_CONTINUITY_KEYS_BY_VISUAL_SEGMENT_ID.
 */
export function mandatoryContinuityKeysByVisualSegmentId(
  visual: VisualDirection,
): Record<string, string[]> {
  return Object.fromEntries(
    visual.segments.map((seg) => [seg.id, defaultContinuityKeys(visual, seg.id)]),
  );
}

/** @deprecated use mandatoryContinuityKeysByVisualSegmentId */
export const requiredContinuityKeysByVisualSegmentId =
  mandatoryContinuityKeysByVisualSegmentId;

export type MandatoryContinuityInventory = {
  /** VisualDirection continuityRules with severity=required (rule metadata). */
  requiredContinuityRuleCount: number;
  /** Preferred/advisory rules (do not relax projected keys). */
  preferredContinuityRuleCount: number;
  /** Advisory token slots (always 0 — preferred rules do not emit omittable tokens). */
  advisoryContinuityTokenCount: number;
  /** Total projected token slots across all segments (validator contract). */
  mandatoryContinuityTokenCount: number;
  /** Unique opaque tokens across the project. */
  mandatoryContinuityUniqueTokenCount: number;
  /** Distinct scopes among projected tokens. */
  mandatoryContinuityScopeCount: number;
  mandatoryContinuityCoverage: "complete" | "incomplete";
  /**
   * Stable redacted proof of the segment→tokens matrix.
   * Algo: sha256(segId|token,token;segId|...)[0:16]
   */
  mandatoryContinuityTokensFingerprint: string;
  scopes: string[];
  map: Record<string, string[]>;
  /** @deprecated aliases — prefer mandatory* */
  requiredContinuityTokenCount: number;
  requiredContinuityUniqueTokenCount: number;
  requiredContinuityScopeCount: number;
  requiredContinuityCoverage: "complete" | "incomplete";
  requiredContinuityTokensFingerprint: string;
};

/** @deprecated use MandatoryContinuityInventory */
export type RequiredContinuityInventory = MandatoryContinuityInventory;

/** Canonical fingerprint for the mandatory segment→tokens matrix. */
export function fingerprintMandatoryContinuityMap(
  map: Record<string, string[]>,
  segmentIdsInOrder: string[],
): string {
  return createHash("sha256")
    .update(
      segmentIdsInOrder
        .map((id) => `${id}|${(map[id] ?? []).join(",")}`)
        .join(";"),
    )
    .digest("hex")
    .slice(0, 16);
}

/**
 * Inventory of projected continuity tokens (validator contract) + rule severities.
 * `keysFromVisualSegment` projects independently of rule severity.
 */
export function inventoryRequiredContinuity(
  visual: VisualDirection,
): MandatoryContinuityInventory {
  const map = mandatoryContinuityKeysByVisualSegmentId(visual);
  const allTokens = Object.values(map).flat();
  const unique = [...new Set(allTokens)];
  const scopes = [...new Set(allTokens.map((t) => t.split(":")[0] ?? ""))].filter(Boolean).sort();
  const complete =
    visual.segments.length > 0 &&
    visual.segments.every((seg) => (map[seg.id]?.length ?? 0) > 0) &&
    allTokens.every((t) => t.includes(":"));
  const fingerprint = fingerprintMandatoryContinuityMap(
    map,
    visual.segments.map((s) => s.id),
  );
  return {
    requiredContinuityRuleCount: visual.continuityRules.filter((r) => r.severity === "required").length,
    preferredContinuityRuleCount: visual.continuityRules.filter((r) => r.severity === "preferred").length,
    advisoryContinuityTokenCount: 0,
    mandatoryContinuityTokenCount: allTokens.length,
    mandatoryContinuityUniqueTokenCount: unique.length,
    mandatoryContinuityScopeCount: scopes.length,
    mandatoryContinuityCoverage: complete ? "complete" : "incomplete",
    mandatoryContinuityTokensFingerprint: fingerprint,
    scopes,
    map,
    requiredContinuityTokenCount: allTokens.length,
    requiredContinuityUniqueTokenCount: unique.length,
    requiredContinuityScopeCount: scopes.length,
    requiredContinuityCoverage: complete ? "complete" : "incomplete",
    requiredContinuityTokensFingerprint: fingerprint,
  };
}

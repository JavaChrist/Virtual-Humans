/**
 * Continuity invariants for VisualDirection (VHS-104 / Porte 8R).
 *
 * `appliesToSegmentIds` must reference authoritative VideoScript.segment IDs
 * (same namespace as `segments[].scriptSegmentId`), never a free-form label.
 */

import type { ContinuityRule, SegmentVisualDirection } from "./visual-direction";
import type { ArtValidationIssue, ArtWarning } from "./errors";

function issue(code: string, message: string, field?: string): ArtValidationIssue {
  return { code, message, field };
}

export function validateContinuityRules(
  rules: ContinuityRule[],
  /** Authoritative VideoScript.segments[].id values. */
  scriptSegmentIds: string[],
): { issues: ArtValidationIssue[]; warnings: ArtWarning[] } {
  const issues: ArtValidationIssue[] = [];
  const warnings: ArtWarning[] = [];
  const known = new Set(scriptSegmentIds);
  const ruleIds = new Set<string>();

  for (const rule of rules) {
    if (ruleIds.has(rule.id)) {
      issues.push(issue("invariant_violation", "ID de règle de continuité dupliqué.", `continuityRules.${rule.id}`));
    }
    ruleIds.add(rule.id);

    if (!rule.description.trim()) {
      issues.push(issue("invariant_violation", "Règle de continuité vide.", `continuityRules.${rule.id}`));
    }
    if (rule.appliesToSegmentIds.length === 0) {
      issues.push(
        issue(
          "invariant_violation",
          "Règle de continuité sans segment.",
          `continuityRules.${rule.id}`,
        ),
      );
    }
    for (const sid of rule.appliesToSegmentIds) {
      if (!known.has(sid)) {
        issues.push(
          issue(
            "continuity_violation",
            `Segment inconnu dans règle de continuité: ${sid}`,
            `continuityRules.${rule.id}`,
          ),
        );
      }
    }
  }

  // Required rules of same scope must not contradict on overlapping segments.
  const required = rules.filter((r) => r.severity === "required");
  for (let i = 0; i < required.length; i++) {
    for (let j = i + 1; j < required.length; j++) {
      const a = required[i]!;
      const b = required[j]!;
      if (a.scope !== b.scope) continue;
      const overlap = a.appliesToSegmentIds.filter((id) => b.appliesToSegmentIds.includes(id));
      if (overlap.length === 0) continue;
      const aStable = /\bstable\b|\bmême\b|\bsame\b|\bconserve\b/i.test(a.description);
      const bBreak = /\brupture\b|\bchange\b|\bdifférent\b|\bbreak\b/i.test(b.description);
      const bStable = /\bstable\b|\bmême\b|\bsame\b|\bconserve\b/i.test(b.description);
      const aBreak = /\brupture\b|\bchange\b|\bdifférent\b|\bbreak\b/i.test(a.description);
      if ((aStable && bBreak) || (bStable && aBreak)) {
        issues.push(
          issue(
            "continuity_violation",
            `Règles required contradictoires sur ${a.scope}.`,
            `continuityRules.${a.id}`,
          ),
        );
      }
    }
  }

  return { issues, warnings };
}

/**
 * Enforce outfit/location stability when required continuity rules demand it.
 */
export function validateContinuityAgainstSegments(
  rules: ContinuityRule[],
  segments: SegmentVisualDirection[],
): { issues: ArtValidationIssue[]; warnings: ArtWarning[] } {
  const issues: ArtValidationIssue[] = [];
  const warnings: ArtWarning[] = [];
  // Lookup by scriptSegmentId (Porte 8R). After normalization, id === scriptSegmentId.
  const byScriptId = new Map(segments.map((s) => [s.scriptSegmentId, s]));

  for (const rule of rules) {
    const applicable = rule.appliesToSegmentIds
      .map((id) => byScriptId.get(id))
      .filter((s): s is SegmentVisualDirection => Boolean(s));
    if (applicable.length < 2) continue;

    if (rule.scope === "outfit") {
      const outfits = applicable.map((s) => s.character?.outfitId ?? null);
      const unique = new Set(outfits.filter(Boolean));
      const wantsStable = /\bstable\b|\bmême\b|\bsame\b|\bconserve\b/i.test(rule.description);
      const wantsBreak = /\brupture\b|\bchange\b|\bdifférent\b/i.test(rule.description);
      if (wantsStable && unique.size > 1) {
        const msg = "Continuité tenue required non respectée.";
        if (rule.severity === "required") {
          issues.push(issue("continuity_violation", msg, `continuityRules.${rule.id}`));
        } else {
          warnings.push({ code: "continuity_preferred", message: msg, field: `continuityRules.${rule.id}` });
        }
      }
      if (wantsBreak && unique.size <= 1 && !rule.description.toLowerCase().includes("intention")) {
        // intentional break should still be allowed if described; no hard fail
      }
    }

    if (rule.scope === "location") {
      const keys = applicable.map((s) => s.location.continuityKey);
      const unique = new Set(keys);
      const wantsStable = /\bstable\b|\bmême\b|\bsame\b|\bconserve\b/i.test(rule.description);
      if (wantsStable && unique.size > 1) {
        const msg = "Continuité lieu required non respectée.";
        if (rule.severity === "required") {
          issues.push(issue("continuity_violation", msg, `continuityRules.${rule.id}`));
        } else {
          warnings.push({ code: "continuity_preferred", message: msg, field: `continuityRules.${rule.id}` });
        }
      }
    }

    if (rule.scope === "lighting") {
      const sig = applicable.map(
        (s) => `${s.lighting.source}|${s.lighting.temperature}|${s.lighting.quality}`,
      );
      const unique = new Set(sig);
      const wantsStable = /\bstable\b|\bmême\b|\bsame\b|\bconserve\b/i.test(rule.description);
      if (wantsStable && unique.size > 1) {
        const msg = "Continuité lumière non respectée.";
        if (rule.severity === "required") {
          issues.push(issue("continuity_violation", msg, `continuityRules.${rule.id}`));
        } else {
          warnings.push({ code: "continuity_preferred", message: msg, field: `continuityRules.${rule.id}` });
        }
      }
    }
  }

  return { issues, warnings };
}

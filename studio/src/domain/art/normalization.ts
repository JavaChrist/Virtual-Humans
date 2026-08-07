/**
 * Normalization for Art Director candidates.
 */

import { normalizeHex } from "./accessibility";
import type {
  ArtAnalysisCandidate,
  ArtAssumption,
  ColorToken,
  ContinuityRule,
  SegmentVisualDirection,
} from "./visual-direction";
import { ART_FIELD_LIMITS } from "./visual-direction";

function clean(text: string, max: number): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeColor(token: ColorToken): ColorToken {
  const hex = normalizeHex(token.hex) ?? token.hex.trim().toLowerCase();
  return {
    name: clean(token.name, ART_FIELD_LIMITS.colorName),
    hex,
    role: token.role,
  };
}

function dedupePalette(palette: ColorToken[]): ColorToken[] {
  const seen = new Set<string>();
  const out: ColorToken[] = [];
  for (const t of palette.map(normalizeColor)) {
    const key = `${t.role}:${t.hex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, ART_FIELD_LIMITS.paletteMax);
}

function normalizeSegment(seg: SegmentVisualDirection): SegmentVisualDirection {
  // Porte 8R / option C — Art segment id is derived from the authoritative
  // VideoScript segment id. Model-invented parallel namespaces (vd-*, etc.)
  // are discarded; unknown scriptSegmentId values remain fail-closed later.
  const scriptSegmentId = seg.scriptSegmentId.trim();
  const base: SegmentVisualDirection = {
    id: scriptSegmentId,
    scriptSegmentId,
    location: {
      kind: seg.location.kind,
      description: clean(seg.location.description, ART_FIELD_LIMITS.locationDescription),
      continuityKey: clean(seg.location.continuityKey, ART_FIELD_LIMITS.continuityKey),
      ...(seg.location.timeOfDay ? { timeOfDay: seg.location.timeOfDay } : {}),
      ...(seg.location.weather
        ? { weather: clean(seg.location.weather, ART_FIELD_LIMITS.weather) }
        : {}),
    },
    camera: {
      ...seg.camera,
      intent: clean(seg.camera.intent, ART_FIELD_LIMITS.cameraIntent),
    },
    lighting: {
      ...seg.lighting,
      intent: clean(seg.lighting.intent, ART_FIELD_LIMITS.lightingIntent),
    },
    environment: {
      ...seg.environment,
      description: clean(
        seg.environment.description,
        ART_FIELD_LIMITS.environmentDescription,
      ),
    },
    composition: {
      ...seg.composition,
      visualHierarchy: clean(
        seg.composition.visualHierarchy,
        ART_FIELD_LIMITS.compositionNote,
      ),
      ...(seg.composition.productPlacement
        ? {
            productPlacement: clean(
              seg.composition.productPlacement,
              ART_FIELD_LIMITS.compositionNote,
            ),
          }
        : {}),
    },
    transitionIntent: seg.transitionIntent,
  };
  if (seg.character) {
    base.character = {
      characterId: seg.character.characterId.trim(),
      framingIntent: clean(seg.character.framingIntent, ART_FIELD_LIMITS.framingIntent),
      ...(seg.character.outfitId ? { outfitId: seg.character.outfitId.trim() } : {}),
      ...(seg.character.expressionId
        ? { expressionId: seg.character.expressionId.trim() }
        : {}),
      ...(seg.character.poseId ? { poseId: seg.character.poseId.trim() } : {}),
      ...(seg.character.referenceId
        ? { referenceId: seg.character.referenceId.trim() }
        : {}),
    };
  }
  return base;
}

function normalizeRule(rule: ContinuityRule): ContinuityRule {
  return {
    id: rule.id.trim(),
    scope: rule.scope,
    description: clean(rule.description, ART_FIELD_LIMITS.continuityDescription),
    appliesToSegmentIds: [...new Set(rule.appliesToSegmentIds.map((id) => id.trim()))],
    severity: rule.severity,
  };
}

function normalizeAssumption(a: ArtAssumption): ArtAssumption {
  return {
    id: a.id.trim(),
    statement: clean(a.statement, ART_FIELD_LIMITS.assumptionStatement),
    status: a.status,
    ...(a.justification
      ? { justification: clean(a.justification, ART_FIELD_LIMITS.assumptionJustification) }
      : {}),
    ...(a.affectsFields ? { affectsFields: [...a.affectsFields] } : {}),
  };
}

export function normalizeArtCandidate(candidate: ArtAnalysisCandidate): ArtAnalysisCandidate {
  return {
    globalStyle: {
      style: candidate.globalStyle.style,
      mood: clean(candidate.globalStyle.mood, ART_FIELD_LIMITS.mood),
      realism: candidate.globalStyle.realism,
      colorIntent: clean(candidate.globalStyle.colorIntent, ART_FIELD_LIMITS.colorIntent),
      brandAlignment: clean(
        candidate.globalStyle.brandAlignment,
        ART_FIELD_LIMITS.brandAlignment,
      ),
      ...(candidate.globalStyle.textureIntent
        ? {
            textureIntent: clean(
              candidate.globalStyle.textureIntent,
              ART_FIELD_LIMITS.textureIntent,
            ),
          }
        : {}),
    },
    palette: dedupePalette(candidate.palette),
    continuityRules: candidate.continuityRules
      .map(normalizeRule)
      .slice(0, ART_FIELD_LIMITS.continuityRulesMax),
    segments: candidate.segments.map(normalizeSegment),
    ...(candidate.assumptions
      ? {
          assumptions: candidate.assumptions
            .map(normalizeAssumption)
            .slice(0, ART_FIELD_LIMITS.assumptionsMax),
        }
      : {}),
    ...(candidate.claimedEvidence
      ? { claimedEvidence: candidate.claimedEvidence.map((e) => ({ ...e })) }
      : {}),
    ...(candidate.notes ? { notes: clean(candidate.notes, 400) } : {}),
  };
}

/**
 * Source-aware validation for Art Director candidates.
 */

import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import {
  validateCompositionAccessibility,
  validatePaletteAccessibility,
} from "./accessibility";
import {
  validateContinuityAgainstSegments,
  validateContinuityRules,
} from "./continuity";
import type { ArtValidationIssue, ArtWarning, MissingInformation } from "./errors";
import type { CharacterCapabilitiesSnapshot } from "./runtime-capabilities";
import { assertAssetAvailable } from "./runtime-capabilities";
import { ArtAnalysisCandidateSchema, CharacterCapabilitiesSnapshotSchema } from "./schemas";
import type { ArtAnalysisCandidate, ArtEvidence, SegmentVisualDirection } from "./visual-direction";

const TECHNICAL_KEYS = [
  "provider",
  "providerId",
  "modelId",
  "model",
  "prompt",
  "negativePrompt",
  "systemPrompt",
  "costCents",
  "fallback",
  "apiParams",
  "shots",
  "shotBreakdown",
  "generationPlan",
] as const;

const PROMPT_LEAK =
  /\b(negative prompt|system prompt|prompt\s*:|\/imagine|cfg\s*scale|seed\s*=)\b/i;
const PROVIDER_LEAK =
  /\b(openai|gpt-4|claude-3|fal\.ai|elevenlabs|midjourney|runway|sora\b|veo\s*\d|pulid)\b/i;
const COST_LEAK =
  /\b(costCents|budgetUSD|generation plan|model router|providerCalled)\b/i;
const SHOT_BREAKDOWN_LEAK =
  /\b(shot\s*\d+|plan\s*\d+\s*[:=]|découpage\s+technique|storyboard\s+panel|timecode\s+\d)/i;

function issue(code: string, message: string, field?: string): ArtValidationIssue {
  return { code, message, field };
}

export function assertNoTechnicalLeak(
  value: ArtAnalysisCandidate | Record<string, unknown>,
): ArtValidationIssue[] {
  const issues: ArtValidationIssue[] = [];
  const record = value as unknown as Record<string, unknown>;
  for (const key of TECHNICAL_KEYS) {
    if (key in record) {
      issues.push(issue("technical_leak", "Paramètre technique interdit.", key));
    }
  }
  return issues;
}

export function detectResponsibilityLeaks(text: string, field: string): ArtValidationIssue[] {
  const issues: ArtValidationIssue[] = [];
  if (PROMPT_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Prompt détecté.", field));
  }
  if (PROVIDER_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Provider ou modèle détecté.", field));
  }
  if (COST_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Coût ou stratégie de génération détecté.", field));
  }
  if (SHOT_BREAKDOWN_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Découpage technique en plans détecté.", field));
  }
  return issues;
}

function collectTexts(candidate: ArtAnalysisCandidate): Array<{ field: string; text: string }> {
  const out: Array<{ field: string; text: string }> = [
    { field: "globalStyle.mood", text: candidate.globalStyle.mood },
    { field: "globalStyle.colorIntent", text: candidate.globalStyle.colorIntent },
    { field: "globalStyle.brandAlignment", text: candidate.globalStyle.brandAlignment },
  ];
  if (candidate.globalStyle.textureIntent) {
    out.push({ field: "globalStyle.textureIntent", text: candidate.globalStyle.textureIntent });
  }
  if (candidate.notes) out.push({ field: "notes", text: candidate.notes });
  for (const rule of candidate.continuityRules) {
    out.push({ field: `continuityRules.${rule.id}`, text: rule.description });
  }
  for (const seg of candidate.segments) {
    const p = `segments.${seg.id}`;
    out.push({ field: `${p}.location`, text: seg.location.description });
    out.push({ field: `${p}.camera`, text: seg.camera.intent });
    out.push({ field: `${p}.lighting`, text: seg.lighting.intent });
    out.push({ field: `${p}.environment`, text: seg.environment.description });
    out.push({ field: `${p}.composition`, text: seg.composition.visualHierarchy });
    if (seg.character) {
      out.push({ field: `${p}.character`, text: seg.character.framingIntent });
    }
  }
  return out;
}

export function validateSegmentCoverage(
  segments: SegmentVisualDirection[],
  script: VideoScript,
): ArtValidationIssue[] {
  const issues: ArtValidationIssue[] = [];
  const scriptIds = script.segments.map((s) => s.id);
  const scriptSet = new Set(scriptIds);
  const covered = segments.map((s) => s.scriptSegmentId);

  if (segments.length !== script.segments.length) {
    issues.push(
      issue(
        "invariant_violation",
        `Couverture segments incorrecte (${segments.length} vs ${script.segments.length}).`,
        "segments",
      ),
    );
  }

  const ids = segments.map((s) => s.id);
  if (new Set(ids).size !== ids.length) {
    issues.push(issue("invariant_violation", "IDs de direction dupliqués.", "segments"));
  }
  if (new Set(covered).size !== covered.length) {
    issues.push(issue("invariant_violation", "scriptSegmentId dupliqués.", "segments"));
  }

  for (const sid of covered) {
    if (!scriptSet.has(sid)) {
      issues.push(issue("invariant_violation", `scriptSegmentId inconnu: ${sid}`, "segments"));
    }
  }
  for (const sid of scriptIds) {
    if (!covered.includes(sid)) {
      issues.push(issue("invariant_violation", `Segment script non couvert: ${sid}`, "segments"));
    }
  }

  // Order must follow script order
  const scriptOrder = new Map(script.segments.map((s, i) => [s.id, i]));
  const ordered = [...segments].sort(
    (a, b) => (scriptOrder.get(a.scriptSegmentId) ?? 0) - (scriptOrder.get(b.scriptSegmentId) ?? 0),
  );
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i]?.scriptSegmentId !== scriptIds[i]) {
      issues.push(
        issue(
          "invariant_violation",
          "Ordre des directions différent de l'ordre du script.",
          "segments",
        ),
      );
      break;
    }
  }

  return issues;
}

export function validateRuntimeAssets(
  segments: SegmentVisualDirection[],
  brief: VideoProjectBrief,
  snapshot: CharacterCapabilitiesSnapshot | undefined,
): { issues: ArtValidationIssue[]; missing: MissingInformation[]; warnings: ArtWarning[] } {
  const issues: ArtValidationIssue[] = [];
  const missing: MissingInformation[] = [];
  const warnings: ArtWarning[] = [];

  const needsCharacter = Boolean(brief.characterId);
  const hasCharacterDir = segments.some((s) => s.character);

  if (!needsCharacter) {
    if (hasCharacterDir) {
      issues.push(
        issue(
          "incoherent_with_sources",
          "CharacterDirection présente sans personnage dans le brief.",
          "segments",
        ),
      );
    }
    return { issues, missing, warnings };
  }

  if (!snapshot) {
    missing.push({
      code: "character_snapshot_missing",
      field: "characterCapabilities",
      message: "Personnage requis mais snapshot Runtime absent.",
      required: true,
    });
    return { issues, missing, warnings };
  }

  const snapParsed = CharacterCapabilitiesSnapshotSchema.safeParse(snapshot);
  if (!snapParsed.success) {
    issues.push(issue("invalid_candidate", "Snapshot Runtime invalide.", "characterCapabilities"));
    return { issues, missing, warnings };
  }
  const snap = snapParsed.data;

  if (brief.characterId && snap.characterId !== brief.characterId) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "characterId du snapshot ≠ brief.",
        "characterCapabilities.characterId",
      ),
    );
  }

  // Sensitive path / URL leak in snapshot labels/tags
  const blob = JSON.stringify(snap);
  if (/[\\/](?:Users|home|var|tmp)[\\/]|https?:\/\/|signed[=_]|secret/i.test(blob)) {
    issues.push(
      issue(
        "technical_leak",
        "Snapshot contient chemin ou URL sensible.",
        "characterCapabilities",
      ),
    );
  }

  for (const seg of segments) {
    if (!seg.character) {
      warnings.push({
        code: "character_direction_absent",
        message: `Segment ${seg.id} sans CharacterDirection alors qu'un personnage est requis.`,
        field: `segments.${seg.id}`,
      });
      continue;
    }
    if (seg.character.characterId !== snap.characterId) {
      issues.push(
        issue(
          "asset_unavailable",
          "characterId segment ≠ snapshot.",
          `segments.${seg.id}.character`,
        ),
      );
    }
    for (const [kind, id, list] of [
      ["outfit", seg.character.outfitId, snap.availableOutfits],
      ["expression", seg.character.expressionId, snap.availableExpressions],
      ["pose", seg.character.poseId, snap.availablePoses],
      ["reference", seg.character.referenceId, snap.availableReferences],
    ] as const) {
      const err = assertAssetAvailable(list, id, kind);
      if (err) {
        missing.push({
          code: "asset_unavailable",
          field: `segments.${seg.id}.character.${kind}Id`,
          message: err,
          required: kind === "outfit",
        });
        if (kind === "outfit") {
          issues.push(issue("asset_unavailable", err, `segments.${seg.id}.character.outfitId`));
        }
      }
    }
  }

  return { issues, missing, warnings };
}

export function validateConservation(
  candidate: ArtAnalysisCandidate,
  script: VideoScript,
  plan: MarketingPlan,
  concept: CreativeConcept,
): { issues: ArtValidationIssue[]; warnings: ArtWarning[] } {
  const issues: ArtValidationIssue[] = [];
  const warnings: ArtWarning[] = [];
  const corpus = collectTexts(candidate)
    .map((t) => t.text)
    .join("\n");

  // Must not rewrite script dialogue into visual fields as "new dialogue"
  for (const seg of script.segments) {
    const spoken = (seg.dialogue || seg.voiceOver || "").trim();
    if (!spoken) continue;
    // Detect explicit rewrite claims
  }

  if (/\b(nouveau dialogue|rewrite dialogue|modifie le texte|change le CTA)\b/i.test(corpus)) {
    issues.push(
      issue("incoherent_with_sources", "Modification de texte/CTA refusée.", "notes"),
    );
  }

  if (/\b(ajoute un segment|supprime un segment|réordonne|new segment)\b/i.test(corpus)) {
    issues.push(
      issue("incoherent_with_sources", "Modification de structure script refusée.", "segments"),
    );
  }

  const ideaWords = concept.bigIdea
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
    .filter((w) => w.length > 4);
  const brand = candidate.globalStyle.brandAlignment.toLowerCase();
  if (
    ideaWords.length >= 2 &&
    ideaWords.filter((w) => brand.includes(w) || corpus.toLowerCase().includes(w)).length === 0 &&
    /\b(nouvelle grande idée|remplace le concept)\b/i.test(corpus)
  ) {
    issues.push(
      issue("incoherent_with_sources", "Remplacement de la grande idée refusé.", "globalStyle"),
    );
  }

  for (const a of plan.assumptions) {
    if (a.status === "inferred" || a.status === "unverified") {
      const snippet = a.statement.toLowerCase().slice(0, 40);
      if (
        snippet.length > 12 &&
        corpus.toLowerCase().includes(snippet) &&
        /\b(il est établi|it is a fact|prouvé que)\b/i.test(corpus)
      ) {
        issues.push(
          issue(
            "incoherent_with_sources",
            "Hypothèse transformée en fait refusée.",
            "assumptions",
          ),
        );
      }
    }
  }

  // Brand color invention without assumption
  const inventBrand =
    /\b(couleur officielle de la marque|brand official color|pantone officiel)\b/i.test(corpus);
  const hasColorAssumption = (candidate.assumptions ?? []).some((a) =>
    /couleur|color|palette|brand/i.test(a.statement),
  );
  if (inventBrand && !hasColorAssumption) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "Couleur de marque inventée sans hypothèse explicite.",
        "palette",
      ),
    );
  }

  // Soft conservation: benefit mentioned somewhere
  const benefitWords = plan.mainBenefit
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôùûüç0-9]+/i)
    .filter((w) => w.length > 4);
  if (
    benefitWords.length >= 2 &&
    !benefitWords.some((w) => corpus.toLowerCase().includes(w))
  ) {
    warnings.push({
      code: "benefit_weak_link",
      message: "Bénéfice marketing peu visible dans la direction visuelle.",
      field: "globalStyle",
    });
  }

  void script;
  return { issues, warnings };
}

export function rebuildArtEvidence(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  snapshot?: CharacterCapabilitiesSnapshot,
): ArtEvidence[] {
  const evidence: ArtEvidence[] = [
    {
      field: "audience",
      source: "marketing_plan",
      sourcePath: "primaryAudience",
      summary: `${plan.primaryAudience.label}: ${plan.primaryAudience.description}`.slice(0, 200),
    },
    {
      field: "mainBenefit",
      source: "marketing_plan",
      sourcePath: "mainBenefit",
      summary: plan.mainBenefit.slice(0, 200),
    },
    {
      field: "tone",
      source: "marketing_plan",
      sourcePath: "tone",
      summary: String(plan.tone).slice(0, 200),
    },
    {
      field: "callToAction",
      source: "video_script",
      sourcePath: "callToAction.text",
      summary: script.callToAction.text.slice(0, 200),
    },
    {
      field: "bigIdea",
      source: "creative_concept",
      sourcePath: "bigIdea",
      summary: concept.bigIdea.slice(0, 200),
    },
    {
      field: "emotionalArc",
      source: "creative_concept",
      sourcePath: "emotionalArc",
      summary: concept.emotionalArc
        .map((b) => `${b.order}:${b.emotion}`)
        .join(" → ")
        .slice(0, 200),
    },
    {
      field: "scriptSegments",
      source: "video_script",
      sourcePath: "segments",
      summary: `${script.segments.length} segments conservés dans l'ordre du script.`,
    },
    {
      field: "aspectRatio",
      source: "brief",
      sourcePath: "aspectRatio",
      summary: String(brief.aspectRatio ?? "unspecified"),
    },
  ];
  if (snapshot) {
    evidence.push({
      field: "characterCapabilities",
      source: "runtime_snapshot",
      summary: `Snapshot ${snapshot.characterId} v${snapshot.snapshotVersion}: ${snapshot.availableOutfits.length} tenues, ${snapshot.availableExpressions.length} expressions, ${snapshot.availablePoses.length} poses.`,
    });
  }
  return evidence;
}

export function validateCandidateAgainstSources(
  candidate: ArtAnalysisCandidate,
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  snapshot?: CharacterCapabilitiesSnapshot,
): {
  issues: ArtValidationIssue[];
  warnings: ArtWarning[];
  missingInformation: MissingInformation[];
} {
  const issues: ArtValidationIssue[] = [];
  const warnings: ArtWarning[] = [];
  const missingInformation: MissingInformation[] = [];

  const schema = ArtAnalysisCandidateSchema.safeParse(candidate);
  if (!schema.success) {
    for (const i of schema.error.issues) {
      issues.push({
        code: "invalid_candidate",
        field: i.path.join(".") || undefined,
        message: i.message,
      });
    }
    return { issues, warnings, missingInformation };
  }

  issues.push(...assertNoTechnicalLeak(candidate));
  issues.push(...validateSegmentCoverage(candidate.segments, script));

  const continuity = validateContinuityRules(
    candidate.continuityRules,
    candidate.segments.map((s) => s.id),
  );
  issues.push(...continuity.issues);
  warnings.push(...continuity.warnings);

  const continuitySeg = validateContinuityAgainstSegments(
    candidate.continuityRules,
    candidate.segments,
  );
  issues.push(...continuitySeg.issues);
  warnings.push(...continuitySeg.warnings);

  const paletteA11y = validatePaletteAccessibility(candidate.palette);
  issues.push(...paletteA11y.issues);
  warnings.push(...paletteA11y.warnings);

  const screenMap = new Map(
    script.segments.map((s) => [s.id, s.screenText] as const),
  );
  const compA11y = validateCompositionAccessibility(candidate.segments, screenMap);
  issues.push(...compA11y.issues);
  warnings.push(...compA11y.warnings);

  const runtime = validateRuntimeAssets(candidate.segments, brief, snapshot);
  issues.push(...runtime.issues);
  warnings.push(...runtime.warnings);
  missingInformation.push(...runtime.missing);

  const conservation = validateConservation(candidate, script, plan, concept);
  issues.push(...conservation.issues);
  warnings.push(...conservation.warnings);

  for (const { field, text } of collectTexts(candidate)) {
    issues.push(...detectResponsibilityLeaks(text, field));
  }

  // Chain links
  if (script.creativeConceptRevisionId !== concept.id) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "videoScript.creativeConceptRevisionId ≠ concept.id",
        "videoScriptRevisionId",
      ),
    );
  }
  if (concept.marketingPlanRevisionId !== plan.id) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "creativeConcept.marketingPlanRevisionId ≠ plan.id",
        "creativeConceptRevisionId",
      ),
    );
  }
  if (
    brief.projectId !== plan.projectId ||
    plan.projectId !== concept.projectId ||
    concept.projectId !== script.projectId
  ) {
    issues.push(issue("incoherent_with_sources", "Projets incompatibles.", "projectId"));
  }

  // Deduplicate issues by code+field+message
  const seen = new Set<string>();
  const uniqueIssues = issues.filter((i) => {
    const k = `${i.code}|${i.field}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { issues: uniqueIssues, warnings, missingInformation };
}

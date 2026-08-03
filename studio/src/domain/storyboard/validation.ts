/**
 * Source-aware validation for Storyboard candidates.
 */

import type { VisualDirection } from "@/domain/art";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import { projectContinuity } from "./continuity";
import { validateSceneCoverage } from "./coverage";
import type {
  MissingInformation,
  StoryboardValidationIssue,
  StoryboardWarning,
} from "./errors";
import type { StoryboardScene } from "./scene";
import { StoryboardAnalysisCandidateSchema } from "./schemas";
import type {
  StoryboardAnalysisCandidate,
  StoryboardEvidence,
} from "./storyboard-project";
import { allocateStoryboardDurations, assessRecommendedSceneCount } from "./timing";

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
  "merge",
  "mergedUrl",
  "generationPlan",
] as const;

const PROMPT_LEAK =
  /\b(negative prompt|system prompt|prompt\s*:|\/imagine|cfg\s*scale|seed\s*=)\b/i;
const PROVIDER_LEAK =
  /\b(openai|gpt-4|claude-3|fal\.ai|elevenlabs|midjourney|runway|kling|veo\s*\d|pulid)\b/i;
const COST_LEAK =
  /\b(costCents|budgetUSD|generation plan|model router|providerCalled)\b/i;
const MERGE_LEAK = /\b(merge réel|ffmpeg merge|concat demuxer|call \/api\/generate\/merge)\b/i;

function issue(code: string, message: string, field?: string): StoryboardValidationIssue {
  return { code, message, field };
}

export function assertNoTechnicalLeak(
  value: StoryboardAnalysisCandidate | Record<string, unknown>,
): StoryboardValidationIssue[] {
  const issues: StoryboardValidationIssue[] = [];
  const record = value as unknown as Record<string, unknown>;
  for (const key of TECHNICAL_KEYS) {
    if (key in record) {
      issues.push(issue("technical_leak", "Paramètre technique interdit.", key));
    }
  }
  for (const sc of (value as StoryboardAnalysisCandidate).scenes ?? []) {
    const srec = sc as unknown as Record<string, unknown>;
    for (const key of TECHNICAL_KEYS) {
      if (key in srec) {
        issues.push(issue("technical_leak", "Paramètre technique interdit.", `scenes.${sc.id}.${key}`));
      }
    }
  }
  return issues;
}

export function detectResponsibilityLeaks(text: string, field: string): StoryboardValidationIssue[] {
  const issues: StoryboardValidationIssue[] = [];
  if (PROMPT_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Prompt détecté.", field));
  }
  if (PROVIDER_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Provider ou modèle détecté.", field));
  }
  if (COST_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Coût ou stratégie de génération détecté.", field));
  }
  if (MERGE_LEAK.test(text)) {
    issues.push(issue("responsibility_leak", "Merge réel / exécution détecté.", field));
  }
  return issues;
}

function collectTexts(candidate: StoryboardAnalysisCandidate): Array<{ field: string; text: string }> {
  const out: Array<{ field: string; text: string }> = [{ field: "title", text: candidate.title }];
  if (candidate.notes) out.push({ field: "notes", text: candidate.notes });
  if (candidate.sceneCountJustification) {
    out.push({ field: "sceneCountJustification", text: candidate.sceneCountJustification });
  }
  for (const sc of candidate.scenes) {
    out.push({ field: `scenes.${sc.id}.title`, text: sc.title });
    if (sc.transition.justification) {
      out.push({
        field: `scenes.${sc.id}.transition`,
        text: sc.transition.justification,
      });
    }
  }
  return out;
}

export function validateReferences(
  scenes: Array<Pick<StoryboardScene, "id" | "references" | "visualDirectionSegmentId">>,
  visual: VisualDirection,
  brief: VideoProjectBrief,
): { issues: StoryboardValidationIssue[]; missing: MissingInformation[] } {
  const issues: StoryboardValidationIssue[] = [];
  const missing: MissingInformation[] = [];

  const allowed = new Set<string>();
  for (const seg of visual.segments) {
    if (seg.character) {
      allowed.add(`character:${seg.character.characterId}`);
      if (seg.character.outfitId) allowed.add(`outfit:${seg.character.outfitId}`);
      if (seg.character.expressionId) allowed.add(`expression:${seg.character.expressionId}`);
      if (seg.character.poseId) allowed.add(`pose:${seg.character.poseId}`);
      if (seg.character.referenceId) allowed.add(`reference:${seg.character.referenceId}`);
    }
  }
  for (const m of brief.mediaReferences ?? []) {
    allowed.add(`product:${m.id}`);
    allowed.add(`brand:${m.id}`);
    allowed.add(`screen:${m.id}`);
  }

  for (const sc of scenes) {
    for (const ref of sc.references) {
      if (/[\\/](?:Users|home)|https?:\/\/|signed[=_]/i.test(ref.sourceId + ref.role)) {
        issues.push(
          issue("technical_leak", "Référence avec chemin ou URL sensible.", `scenes.${sc.id}.references`),
        );
      }
      if (["outfit", "expression", "pose", "character"].includes(ref.kind)) {
        const key =
          ref.kind === "character"
            ? `character:${ref.sourceId}`
            : `${ref.kind}:${ref.sourceId}`;
        // Also accept expression:/pose: prefixed ids from snapshot
        const ok =
          allowed.has(key) ||
          allowed.has(`expression:${ref.sourceId}`) ||
          allowed.has(`pose:${ref.sourceId}`) ||
          [...allowed].some((a) => a.endsWith(`:${ref.sourceId}`) || a === `${ref.kind}:${ref.sourceId}`);
        // Visual direction character assets
        const vd = visual.segments.find((v) => v.id === sc.visualDirectionSegmentId);
        const fromVd =
          (ref.kind === "outfit" && vd?.character?.outfitId === ref.sourceId) ||
          (ref.kind === "expression" && vd?.character?.expressionId === ref.sourceId) ||
          (ref.kind === "pose" && vd?.character?.poseId === ref.sourceId) ||
          (ref.kind === "character" && vd?.character?.characterId === ref.sourceId);

        if (!ok && !fromVd) {
          if (ref.required) {
            missing.push({
              code: "reference_unavailable",
              field: `scenes.${sc.id}.references.${ref.id}`,
              message: `Référence requise introuvable: ${ref.kind}:${ref.sourceId}`,
              required: true,
            });
            issues.push(
              issue(
                "reference_unavailable",
                `Référence requise introuvable: ${ref.kind}:${ref.sourceId}`,
                `scenes.${sc.id}.references`,
              ),
            );
          } else {
            issues.push(
              issue(
                "reference_unavailable",
                `Référence inventée: ${ref.kind}:${ref.sourceId}`,
                `scenes.${sc.id}.references`,
              ),
            );
          }
        }
      }
    }
  }

  return { issues, missing };
}

export function validateConservation(
  candidate: StoryboardAnalysisCandidate,
  script: VideoScript,
  visual: VisualDirection,
): { issues: StoryboardValidationIssue[]; warnings: StoryboardWarning[] } {
  const issues: StoryboardValidationIssue[] = [];
  const warnings: StoryboardWarning[] = [];
  const corpus = collectTexts(candidate)
    .map((t) => t.text)
    .join("\n");

  if (/\b(nouveau dialogue|rewrite dialogue|modifie le texte|change le CTA)\b/i.test(corpus)) {
    issues.push(issue("incoherent_with_sources", "Réécriture de texte/CTA refusée.", "notes"));
  }
  if (/\b(ajoute un segment|supprime un segment|réordonne les segments)\b/i.test(corpus)) {
    issues.push(issue("incoherent_with_sources", "Modification de structure script refusée.", "scenes"));
  }
  if (/\b(change la tenue|nouvel outfit|remplace l'asset)\b/i.test(corpus)) {
    issues.push(issue("incoherent_with_sources", "Changement d'asset artistique refusé.", "scenes"));
  }

  for (const a of script.assumptions) {
    if (a.status === "inferred" || a.status === "unverified") {
      const snippet = a.statement.toLowerCase().slice(0, 40);
      if (
        snippet.length > 12 &&
        corpus.toLowerCase().includes(snippet) &&
        /\b(il est établi|it is a fact|prouvé que)\b/i.test(corpus)
      ) {
        issues.push(
          issue("incoherent_with_sources", "Hypothèse transformée en fait refusée.", "assumptions"),
        );
      }
    }
  }

  // Assets in references must match visual direction when present on character
  for (const sc of candidate.scenes) {
    const vd = visual.segments.find((v) => v.id === sc.visualDirectionSegmentId);
    if (!vd?.character) continue;
    for (const ref of sc.references) {
      if (ref.kind === "outfit" && vd.character.outfitId && ref.sourceId !== vd.character.outfitId) {
        issues.push(
          issue(
            "incoherent_with_sources",
            "Asset tenue différent de VisualDirection.",
            `scenes.${sc.id}.references`,
          ),
        );
      }
    }
  }

  if (!candidate.title.trim()) {
    issues.push(issue("invalid_candidate", "Titre vide.", "title"));
  }

  void script;
  return { issues, warnings };
}

export function rebuildStoryboardEvidence(
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  visual: VisualDirection,
): StoryboardEvidence[] {
  return [
    {
      field: "scriptSegments",
      source: "video_script",
      sourcePath: "segments",
      summary: `${script.segments.length} segments narratifs couverts.`,
    },
    {
      field: "callToAction",
      source: "video_script",
      sourcePath: "callToAction.text",
      summary: script.callToAction.text.slice(0, 200),
    },
    {
      field: "globalStyle",
      source: "visual_direction",
      sourcePath: "globalStyle",
      summary: `${visual.globalStyle.style} / ${visual.globalStyle.mood}`.slice(0, 200),
    },
    {
      field: "palette",
      source: "visual_direction",
      sourcePath: "palette",
      summary: `${visual.palette.length} tokens`,
    },
    {
      field: "bigIdea",
      source: "creative_concept",
      sourcePath: "bigIdea",
      summary: concept.bigIdea.slice(0, 200),
    },
    {
      field: "mainBenefit",
      source: "marketing_plan",
      sourcePath: "mainBenefit",
      summary: plan.mainBenefit.slice(0, 200),
    },
    {
      field: "aspectRatio",
      source: "brief",
      sourcePath: "aspectRatio",
      summary: brief.aspectRatio,
    },
    {
      field: "targetDuration",
      source: "video_script",
      sourcePath: "targetDurationSeconds",
      summary: String(script.targetDurationSeconds),
    },
  ];
}

export function validateCandidateAgainstSources(
  candidate: StoryboardAnalysisCandidate,
  brief: VideoProjectBrief,
  plan: MarketingPlan,
  concept: CreativeConcept,
  script: VideoScript,
  visual: VisualDirection,
): {
  issues: StoryboardValidationIssue[];
  warnings: StoryboardWarning[];
  missingInformation: MissingInformation[];
  timingStatus?: "exact" | "invalid";
} {
  const issues: StoryboardValidationIssue[] = [];
  const warnings: StoryboardWarning[] = [];
  const missingInformation: MissingInformation[] = [];

  const schema = StoryboardAnalysisCandidateSchema.safeParse(candidate);
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

  // Build provisional scenes with placeholder durations for coverage checks
  const provisional: StoryboardScene[] = candidate.scenes.map((sc) => ({
    ...sc,
    durationSeconds: sc.durationSeconds ?? 1,
  }));

  issues.push(...validateSceneCoverage(provisional, script, visual));

  const continuity = projectContinuity(
    visual,
    provisional,
    candidate.intentionalBreaks ?? [],
  );
  issues.push(...continuity.issues);
  warnings.push(...continuity.warnings);

  const refs = validateReferences(provisional, visual, brief);
  issues.push(...refs.issues);
  missingInformation.push(...refs.missing);

  const conservation = validateConservation(candidate, script, visual);
  issues.push(...conservation.issues);
  warnings.push(...conservation.warnings);

  for (const { field, text } of collectTexts(candidate)) {
    issues.push(...detectResponsibilityLeaks(text, field));
  }

  warnings.push(
    ...assessRecommendedSceneCount(
      candidate.scenes.length,
      script.targetDurationSeconds,
      candidate.sceneCountJustification,
    ),
  );

  // Timing recalculation (ignore claimed total)
  const timing = allocateStoryboardDurations(
    candidate.scenes.map((sc) => ({
      id: sc.id,
      order: sc.order,
      scriptSegmentId: sc.scriptSegmentId,
      spokenContent: sc.spokenContent,
      proposedDurationSeconds: sc.durationSeconds,
    })),
    script,
  );
  if (timing.status !== "exact") {
    issues.push(
      issue("timing_invalid", "Allocation de durées invalide.", "timing"),
    );
  }
  for (const tw of timing.warnings) {
    if (tw.code === "spoken_exceeds_target" || tw.code === "non_positive_duration") {
      issues.push(issue("timing_invalid", tw.message, tw.field));
    } else {
      warnings.push({ code: tw.code, message: tw.message, field: tw.field });
    }
  }

  // Chain
  if (visual.videoScriptRevisionId !== script.id) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "visualDirection.videoScriptRevisionId ≠ script.id",
        "visualDirectionRevisionId",
      ),
    );
  }
  if (script.creativeConceptRevisionId !== concept.id) {
    issues.push(
      issue(
        "incoherent_with_sources",
        "script.creativeConceptRevisionId ≠ concept.id",
        "videoScriptRevisionId",
      ),
    );
  }
  if (
    brief.projectId !== plan.projectId ||
    plan.projectId !== concept.projectId ||
    concept.projectId !== script.projectId ||
    script.projectId !== visual.projectId
  ) {
    issues.push(issue("incoherent_with_sources", "Projets incompatibles.", "projectId"));
  }

  if (script.timing.status === "too_long") {
    issues.push(issue("timing_invalid", "Script hors tolérance (trop long).", "videoScript.timing"));
  }

  const seen = new Set<string>();
  const uniqueIssues = issues.filter((i) => {
    const k = `${i.code}|${i.field}|${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    issues: uniqueIssues,
    warnings,
    missingInformation,
    timingStatus: timing.status,
  };
}

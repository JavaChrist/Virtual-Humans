import { createArtifactMetadata } from "@/domain/shared";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import { ScriptDomainError } from "./errors";
import { buildScriptRationale } from "./explanation";
import { normalizeScriptCandidate } from "./normalization";
import { VideoScriptSchema } from "./schemas";
import { calculateScriptTiming } from "./timing";
import {
  rebuildScriptEvidence,
  validateCandidateAgainstSources,
} from "./validation";
import {
  VIDEO_SCRIPT_SCHEMA_VERSION,
  type ScriptAnalysisCandidate,
  type ScriptAssumption,
  type VideoScript,
} from "./video-script";

export type FinalizeVideoScriptInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  candidate: ScriptAnalysisCandidate;
  metadata: {
    id: string;
    createdBy: string;
    correlationId: string;
    createdAt?: string;
    revision?: number;
  };
};

export function finalizeVideoScript(input: FinalizeVideoScriptInput): VideoScript {
  const brief = {
    ...input.brief,
    mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
  };
  const plan = JSON.parse(JSON.stringify(input.marketingPlan)) as MarketingPlan;
  const concept = JSON.parse(JSON.stringify(input.creativeConcept)) as CreativeConcept;
  const normalized = normalizeScriptCandidate(input.candidate);

  const { issues } = validateCandidateAgainstSources(normalized, brief, plan, concept);
  if (issues.length > 0) {
    throw new ScriptDomainError(
      "invalid_candidate",
      issues[0]?.message ?? "Candidat script invalide.",
      issues[0]?.field,
    );
  }

  // Always recalculate timing — never trust analyzer timing.
  const timing = calculateScriptTiming(
    normalized.segments,
    normalized.language || brief.language,
    brief.durationSeconds,
  );

  if (timing.status === "too_long") {
    throw new ScriptDomainError(
      "duration_out_of_range",
      `Script trop long (${timing.estimatedTotalSeconds}s vs cible ${timing.targetDurationSeconds}s, tolérance 10 %).`,
      "timing",
    );
  }

  const sorted = [...normalized.segments].sort((a, b) => a.order - b.order);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const evidence = rebuildScriptEvidence(brief, plan, concept);
  if (normalized.adaptationNote) {
    evidence.push({
      field: "callToAction.adaptation",
      source: "derived",
      summary: normalized.adaptationNote,
    });
  }

  const assumptions: ScriptAssumption[] = [...(normalized.assumptions ?? [])];
  if (assumptions.length === 0) {
    assumptions.push({
      id: "assumption-oral",
      statement: "Le rythme oral estimé repose sur le profil linguistique documenté.",
      status: "explicit",
      affectsFields: ["timing"],
    });
  }

  const rationale = buildScriptRationale(evidence, [
    { field: "hook", summary: normalized.hookText },
    { field: "callToAction", summary: normalized.callToActionText },
    { field: "timing", summary: `status=${timing.status}; total=${timing.estimatedTotalSeconds}s` },
    { field: "bigIdea", summary: "Narration alignée sur la grande idée créative." },
  ]);

  const meta = createArtifactMetadata({
    id: input.metadata.id,
    projectId: plan.projectId,
    createdBy: input.metadata.createdBy,
    correlationId: input.metadata.correlationId,
    createdAt: input.metadata.createdAt,
    revision: input.metadata.revision,
    schemaVersion: VIDEO_SCRIPT_SCHEMA_VERSION,
  });

  const script: VideoScript = {
    ...meta,
    creativeConceptRevisionId: concept.id,
    marketingPlanRevisionId: plan.id,
    title: normalized.title,
    summary: normalized.summary,
    language: normalized.language || brief.language,
    targetDurationSeconds: brief.durationSeconds,
    estimatedDurationSeconds: timing.estimatedTotalSeconds,
    estimatedReadingSeconds: timing.spokenDurationSeconds,
    hook: { segmentId: first.id, text: normalized.hookText },
    segments: sorted,
    callToAction: {
      segmentId: last.id,
      text: normalized.callToActionText,
      sourceMarketingCta: plan.callToAction,
      ...(normalized.adaptationNote
        ? { adaptationNote: normalized.adaptationNote }
        : {}),
    },
    timing,
    assumptions,
    evidence,
    rationale,
  };

  const parsed = VideoScriptSchema.safeParse(script);
  if (!parsed.success) {
    throw new ScriptDomainError(
      "invalid_script",
      parsed.error.issues[0]?.message ?? "Script invalide après finalisation.",
    );
  }

  return Object.freeze(JSON.parse(JSON.stringify(parsed.data)) as VideoScript);
}

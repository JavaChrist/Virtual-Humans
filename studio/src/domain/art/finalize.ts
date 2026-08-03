import { createArtifactMetadata } from "@/domain/shared";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CreativeConcept } from "@/domain/creative";
import type { MarketingPlan } from "@/domain/marketing";
import type { VideoScript } from "@/domain/script";
import { ArtDomainError } from "./errors";
import { buildArtRationale } from "./explanation";
import { normalizeArtCandidate } from "./normalization";
import type { CharacterCapabilitiesSnapshot } from "./runtime-capabilities";
import { VisualDirectionSchema } from "./schemas";
import { rebuildArtEvidence, validateCandidateAgainstSources } from "./validation";
import {
  VISUAL_DIRECTION_SCHEMA_VERSION,
  type ArtAnalysisCandidate,
  type ArtAssumption,
  type VisualDirection,
} from "./visual-direction";

export type FinalizeVisualDirectionInput = {
  brief: VideoProjectBrief;
  marketingPlan: MarketingPlan;
  creativeConcept: CreativeConcept;
  videoScript: VideoScript;
  candidate: ArtAnalysisCandidate;
  characterCapabilities?: CharacterCapabilitiesSnapshot;
  metadata: {
    id: string;
    createdBy: string;
    correlationId: string;
    createdAt?: string;
    revision?: number;
  };
};

export function finalizeVisualDirection(input: FinalizeVisualDirectionInput): VisualDirection {
  const brief = {
    ...input.brief,
    mediaReferences: input.brief.mediaReferences.map((m) => ({ ...m })),
  };
  const plan = JSON.parse(JSON.stringify(input.marketingPlan)) as MarketingPlan;
  const concept = JSON.parse(JSON.stringify(input.creativeConcept)) as CreativeConcept;
  const script = JSON.parse(JSON.stringify(input.videoScript)) as VideoScript;
  const normalized = normalizeArtCandidate(input.candidate);

  const { issues, missingInformation } = validateCandidateAgainstSources(
    normalized,
    brief,
    plan,
    concept,
    script,
    input.characterCapabilities,
  );
  const blocking = issues.filter((i) =>
    [
      "invariant_violation",
      "continuity_violation",
      "accessibility_violation",
      "responsibility_leak",
      "technical_leak",
      "incoherent_with_sources",
      "invalid_candidate",
      "asset_unavailable",
    ].includes(i.code),
  );
  if (blocking.length > 0) {
    throw new ArtDomainError(
      "invalid_candidate",
      blocking[0]?.message ?? "Candidat art invalide.",
      blocking[0]?.field,
    );
  }
  if (missingInformation.some((m) => m.required)) {
    throw new ArtDomainError(
      "missing_information",
      missingInformation.find((m) => m.required)?.message ?? "Information manquante.",
      missingInformation.find((m) => m.required)?.field,
    );
  }

  // Order segments exactly like script
  const order = new Map(script.segments.map((s, i) => [s.id, i]));
  const segments = [...normalized.segments].sort(
    (a, b) => (order.get(a.scriptSegmentId) ?? 0) - (order.get(b.scriptSegmentId) ?? 0),
  );

  const evidence = rebuildArtEvidence(
    brief,
    plan,
    concept,
    script,
    input.characterCapabilities,
  );

  const assumptions: ArtAssumption[] = [...(normalized.assumptions ?? [])];
  if (assumptions.length === 0) {
    assumptions.push({
      id: "assumption-visual-default",
      statement:
        "Les intentions caméra/lumière sont des directives narratives, pas des paramètres de modèle.",
      status: "explicit",
      affectsFields: ["camera", "lighting"],
    });
  }

  const rationale = buildArtRationale(evidence, [
    { field: "globalStyle", summary: `${normalized.globalStyle.style} / ${normalized.globalStyle.mood}` },
    { field: "palette", summary: `${normalized.palette.length} tokens` },
    { field: "segments", summary: `${segments.length} directions alignées sur le script` },
    {
      field: "continuity",
      summary: `${normalized.continuityRules.length} règles de continuité`,
    },
  ]);

  const meta = createArtifactMetadata({
    id: input.metadata.id,
    projectId: script.projectId,
    createdBy: input.metadata.createdBy,
    correlationId: input.metadata.correlationId,
    createdAt: input.metadata.createdAt,
    revision: input.metadata.revision,
    schemaVersion: VISUAL_DIRECTION_SCHEMA_VERSION,
  });

  const direction: VisualDirection = {
    ...meta,
    videoScriptRevisionId: script.id,
    creativeConceptRevisionId: concept.id,
    globalStyle: normalized.globalStyle,
    palette: normalized.palette,
    continuityRules: normalized.continuityRules,
    segments,
    assumptions,
    evidence,
    rationale,
  };

  const parsed = VisualDirectionSchema.safeParse(direction);
  if (!parsed.success) {
    throw new ArtDomainError(
      "invalid_direction",
      parsed.error.issues[0]?.message ?? "VisualDirection invalide après finalisation.",
    );
  }

  return Object.freeze(JSON.parse(JSON.stringify(parsed.data)) as VisualDirection);
}

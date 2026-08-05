import { z } from "zod";
import {
  ArtifactMetadataSchema,
  DomainIdSchema,
  openaiAbsentOptional,
} from "@/domain/shared";
import { CHARACTER_CAPABILITIES_SNAPSHOT_VERSION } from "./runtime-capabilities";
import {
  ART_FIELD_LIMITS,
  CameraAngleValues,
  CameraMovementValues,
  ColorRoleValues,
  ContinuityScopeValues,
  DepthOfFieldValues,
  GlobalStyleValues,
  LightContrastValues,
  LightQualityValues,
  LightSourceValues,
  LightTemperatureValues,
  LocationKindValues,
  RealismValues,
  ShotSizeValues,
  TimeOfDayValues,
  TransitionIntentValues,
  VISUAL_DIRECTION_SCHEMA_VERSION,
} from "./visual-direction";

const L = ART_FIELD_LIMITS;

export const RuntimeAssetCapabilitySchema = z.object({
  id: DomainIdSchema,
  label: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(40)).max(24),
});

export const RuntimeReferenceCapabilitySchema = RuntimeAssetCapabilitySchema;

export const CharacterCapabilitiesSnapshotSchema = z.object({
  characterId: DomainIdSchema,
  snapshotVersion: z.string().min(1).max(32),
  availableOutfits: z.array(RuntimeAssetCapabilitySchema).max(64),
  availableExpressions: z.array(RuntimeAssetCapabilitySchema).max(64),
  availablePoses: z.array(RuntimeAssetCapabilitySchema).max(64),
  availableReferences: z.array(RuntimeReferenceCapabilitySchema).max(64),
  supportsVoiceReference: z.boolean(),
});

export const CharacterDirectionSchema = z.object({
  characterId: DomainIdSchema,
  outfitId: openaiAbsentOptional(DomainIdSchema),
  expressionId: openaiAbsentOptional(DomainIdSchema),
  poseId: openaiAbsentOptional(DomainIdSchema),
  referenceId: openaiAbsentOptional(DomainIdSchema),
  framingIntent: z.string().min(1).max(L.framingIntent),
});

export const GlobalVisualStyleSchema = z.object({
  style: z.enum(GlobalStyleValues),
  mood: z.string().min(1).max(L.mood),
  realism: z.enum(RealismValues),
  colorIntent: z.string().min(1).max(L.colorIntent),
  textureIntent: openaiAbsentOptional(z.string().min(1).max(L.textureIntent)),
  brandAlignment: z.string().min(1).max(L.brandAlignment),
});

export const ColorTokenSchema = z.object({
  name: z.string().min(1).max(L.colorName),
  hex: z
    .string()
    .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "hex invalide"),
  role: z.enum(ColorRoleValues),
});

export const LocationDirectionSchema = z.object({
  kind: z.enum(LocationKindValues),
  description: z.string().min(1).max(L.locationDescription),
  timeOfDay: openaiAbsentOptional(z.enum(TimeOfDayValues)),
  weather: openaiAbsentOptional(z.string().min(1).max(L.weather)),
  continuityKey: z.string().min(1).max(L.continuityKey),
});

export const CameraDirectionSchema = z.object({
  shotSize: z.enum(ShotSizeValues),
  angle: z.enum(CameraAngleValues),
  movement: z.enum(CameraMovementValues),
  depthOfField: z.enum(DepthOfFieldValues),
  intent: z.string().min(1).max(L.cameraIntent),
});

export const LightingDirectionSchema = z.object({
  source: z.enum(LightSourceValues),
  quality: z.enum(LightQualityValues),
  temperature: z.enum(LightTemperatureValues),
  contrast: z.enum(LightContrastValues),
  intent: z.string().min(1).max(L.lightingIntent),
});

export const EnvironmentDirectionSchema = z.object({
  description: z.string().min(1).max(L.environmentDescription),
  productVisibility: z.enum(["none", "secondary", "hero"]),
  clutterLevel: z.enum(["minimal", "balanced", "busy"]),
});

export const CompositionDirectionSchema = z.object({
  subjectPosition: z.enum(["center", "left_third", "right_third"]),
  lookDirection: z.enum(["camera", "left", "right", "away", "product"]),
  visualHierarchy: z.string().min(1).max(L.compositionNote),
  textSafeArea: z.enum(["none", "top", "bottom", "left", "right"]),
  productPlacement: openaiAbsentOptional(
    z.string().min(1).max(L.compositionNote)
  ),
});

export const SegmentVisualDirectionSchema = z.object({
  id: DomainIdSchema,
  scriptSegmentId: DomainIdSchema,
  location: LocationDirectionSchema,
  camera: CameraDirectionSchema,
  lighting: LightingDirectionSchema,
  character: openaiAbsentOptional(CharacterDirectionSchema),
  environment: EnvironmentDirectionSchema,
  composition: CompositionDirectionSchema,
  transitionIntent: z.enum(TransitionIntentValues),
});

export const ContinuityRuleSchema = z.object({
  id: DomainIdSchema,
  scope: z.enum(ContinuityScopeValues),
  description: z.string().min(1).max(L.continuityDescription),
  appliesToSegmentIds: z.array(DomainIdSchema).min(1).max(32),
  severity: z.enum(["required", "preferred"]),
});

export const ArtAssumptionSchema = z.object({
  id: DomainIdSchema,
  statement: z.string().min(1).max(L.assumptionStatement),
  status: z.enum(["explicit", "inferred", "unverified"]),
  justification: openaiAbsentOptional(
    z.string().min(1).max(L.assumptionJustification)
  ),
  affectsFields: openaiAbsentOptional(
    z.array(z.string().min(1).max(80)).max(12)
  ),
});

export const ArtEvidenceSchema = z.object({
  field: z.string().min(1).max(L.evidenceField),
  source: z.enum([
    "marketing_plan",
    "creative_concept",
    "video_script",
    "brief",
    "runtime_snapshot",
    "user_constraint",
    "derived",
  ]),
  sourcePath: openaiAbsentOptional(
    z.string().min(1).max(L.evidenceSourcePath)
  ),
  summary: z.string().min(1).max(L.evidenceSummary),
});

export const ArtRationaleSchema = z.object({
  summary: z.string().min(1).max(L.rationaleSummary),
  decisions: z
    .array(
      z.object({
        field: z.string().min(1).max(80),
        summary: z.string().min(1).max(240),
        evidenceRefs: z.array(z.string().min(1).max(80)).max(8),
      }),
    )
    .max(L.decisionCountMax),
});

export const VisualDirectionFieldsSchema = z.object({
  videoScriptRevisionId: DomainIdSchema,
  creativeConceptRevisionId: DomainIdSchema,
  globalStyle: GlobalVisualStyleSchema,
  palette: z.array(ColorTokenSchema).min(1).max(L.paletteMax),
  continuityRules: z.array(ContinuityRuleSchema).max(L.continuityRulesMax),
  segments: z.array(SegmentVisualDirectionSchema).min(1).max(32),
  assumptions: z.array(ArtAssumptionSchema).max(L.assumptionsMax),
  evidence: z.array(ArtEvidenceSchema).max(L.evidenceMax),
  rationale: ArtRationaleSchema,
});

export const VisualDirectionSchema = ArtifactMetadataSchema.extend(
  VisualDirectionFieldsSchema.shape,
).superRefine((dir, ctx) => {
  if (dir.schemaVersion !== VISUAL_DIRECTION_SCHEMA_VERSION) {
    ctx.addIssue({
      code: "custom",
      message: `schemaVersion must be ${VISUAL_DIRECTION_SCHEMA_VERSION}`,
      path: ["schemaVersion"],
    });
  }
  const segIds = dir.segments.map((s) => s.id);
  if (new Set(segIds).size !== segIds.length) {
    ctx.addIssue({ code: "custom", message: "IDs de segments dupliqués.", path: ["segments"] });
  }
  const scriptIds = dir.segments.map((s) => s.scriptSegmentId);
  if (new Set(scriptIds).size !== scriptIds.length) {
    ctx.addIssue({
      code: "custom",
      message: "scriptSegmentId dupliqués.",
      path: ["segments"],
    });
  }
});

/** Untrusted analyzer candidate — no metadata/approvals/paths/prompts. */
export const ArtAnalysisCandidateSchema = z
  .object({
    globalStyle: GlobalVisualStyleSchema,
    palette: z.array(ColorTokenSchema).min(1).max(L.paletteMax),
    continuityRules: z.array(ContinuityRuleSchema).max(L.continuityRulesMax),
    segments: z.array(SegmentVisualDirectionSchema).min(1).max(32),
    assumptions: openaiAbsentOptional(
      z.array(ArtAssumptionSchema).max(L.assumptionsMax)
    ),
    claimedEvidence: openaiAbsentOptional(
      z.array(ArtEvidenceSchema).max(L.evidenceMax)
    ),
    notes: openaiAbsentOptional(z.string().max(400)),
  })
  .strict()
  .superRefine((c, ctx) => {
    const forbidden = [
      "id",
      "projectId",
      "schemaVersion",
      "revision",
      "createdAt",
      "createdBy",
      "correlationId",
      "approval",
      "prompt",
      "negativePrompt",
      "model",
      "modelId",
      "provider",
      "providerId",
      "costCents",
      "fallback",
      "apiParams",
      "shots",
      "shotBreakdown",
    ] as const;
    const record = c as unknown as Record<string, unknown>;
    for (const key of forbidden) {
      if (key in record) {
        ctx.addIssue({
          code: "custom",
          message: `Champ interdit dans le candidat: ${key}`,
          path: [key],
        });
      }
    }
  });

export const SNAPSHOT_VERSION_EXPECTED = CHARACTER_CAPABILITIES_SNAPSHOT_VERSION;

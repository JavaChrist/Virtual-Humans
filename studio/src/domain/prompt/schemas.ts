import { z } from "zod";
import { ArtifactMetadataSchema, DomainIdSchema } from "@/domain/shared";
import { ProductionIntentValues } from "@/domain/storyboard";
import { PromptBlockNameValues } from "./blocks";
import { CapabilityProfileValues, MediaTypeValues } from "./capability-profiles";
import {
  PROMPT_FIELD_LIMITS,
  PROMPT_RENDERER_VERSION,
  SCENE_PACKAGE_ARTIFACT_TYPE,
  SCENE_PACKAGE_SCHEMA_VERSION,
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  SCENE_PACKAGE_SET_SCHEMA_VERSION,
} from "./scene-package";

const L = PROMPT_FIELD_LIMITS;

export const SubjectBlockSchema = z.object({
  kind: z.enum(["character", "product", "environment", "interface", "text"]),
  description: z.string().min(1).max(L.description),
  characterId: DomainIdSchema.optional(),
  productId: DomainIdSchema.optional(),
  identityRequirements: z.array(z.string().min(1).max(L.identityReqItem)).max(L.identityReqMax),
});

export const ActionBlockSchema = z.object({
  primaryAction: z.string().min(1).max(L.action),
  secondaryActions: z.array(z.string().min(1).max(L.action)).max(L.secondaryActionsMax),
  motionIntensity: z.enum(["none", "low", "medium", "high"]),
});

export const EnvironmentBlockSchema = z.object({
  kind: z.string().min(1).max(40),
  description: z.string().min(1).max(L.description),
  timeOfDay: z.string().min(1).max(40).optional(),
  weather: z.string().min(1).max(60).optional(),
  continuityKey: z.string().min(1).max(64),
  mood: z.string().min(1).max(120),
});

export const CameraBlockSchema = z.object({
  shotSize: z.string().min(1).max(40),
  angle: z.string().min(1).max(40),
  movement: z.string().min(1).max(40),
  depthOfField: z.string().min(1).max(40),
  intent: z.string().min(1).max(160),
});

export const LightingBlockSchema = z.object({
  source: z.string().min(1).max(40),
  quality: z.string().min(1).max(40),
  temperature: z.string().min(1).max(40),
  contrast: z.string().min(1).max(40),
  intent: z.string().min(1).max(160),
});

export const StyleBlockSchema = z.object({
  style: z.string().min(1).max(40),
  realism: z.string().min(1).max(40),
  colorIntent: z.string().min(1).max(160),
  textureIntent: z.string().min(1).max(160).optional(),
  brandAlignment: z.string().min(1).max(200),
  paletteRoles: z.array(z.string().min(1).max(40)).max(8),
});

export const CompositionBlockSchema = z.object({
  subjectPosition: z.string().min(1).max(40),
  lookDirection: z.string().min(1).max(40),
  visualHierarchy: z.string().min(1).max(200),
  textSafeArea: z.string().min(1).max(40),
  productPlacement: z.string().min(1).max(200).optional(),
});

export const DialogueBlockSchema = z.object({
  kind: z.enum(["dialogue", "voice_over"]),
  text: z.string().min(1).max(400),
  language: z.string().min(2).max(16),
  emotion: z.string().min(1).max(60),
  pronunciationNotes: z
    .array(
      z.object({
        term: z.string().min(1).max(80),
        pronunciation: z.string().min(1).max(120),
        language: z.string().min(2).max(16).optional(),
      }),
    )
    .max(8),
  fidelity: z.literal("verbatim"),
});

export const AudioBlockSchema = z.object({
  kind: z.enum(["voice", "ambient_none"]),
  language: z.string().min(2).max(16),
  emotion: z.string().min(1).max(60).optional(),
  requiresLipsync: z.boolean(),
});

export const ScreenTextBlockSchema = z.object({
  text: z.string().min(1).max(120),
  renderMode: z.enum(["post_production", "model_generated"]),
  safeAreaRequired: z.boolean(),
});

export const PromptConstraintSchema = z.object({
  code: z.string().min(1).max(64),
  description: z.string().min(1).max(L.constraintDescription),
  source: z.enum([
    "brief",
    "marketing_plan",
    "creative_concept",
    "video_script",
    "visual_direction",
    "storyboard",
  ]),
  severity: z.enum(["required", "preferred"]),
});

export const ConstraintBlockSchema = z.object({
  required: z.array(PromptConstraintSchema).max(24),
  forbidden: z.array(PromptConstraintSchema).max(24),
  continuity: z.array(PromptConstraintSchema).max(24),
  safety: z.array(PromptConstraintSchema).max(16),
});

export const PromptReferenceSchema = z.object({
  id: DomainIdSchema,
  kind: z.enum([
    "character",
    "outfit",
    "expression",
    "pose",
    "product",
    "background",
    "brand",
    "screen",
    "voice",
  ]),
  sourceId: DomainIdSchema,
  role: z.string().min(1).max(80),
  required: z.boolean(),
  checksum: z.string().min(1).max(128).optional(),
});

export const PromptVariantSchema = z.object({
  id: DomainIdSchema,
  capabilityProfile: z.enum(CapabilityProfileValues),
  mediaType: z.enum(MediaTypeValues),
  positive: z.string().min(1).max(L.positiveMax),
  negative: z.string().min(1).max(L.negativeMax).optional(),
  rendererVersion: z.string().min(1).max(64),
  language: z.string().min(2).max(16),
  includedBlocks: z.array(z.enum(PromptBlockNameValues)).min(1).max(16),
});

export const PromptAssumptionSchema = z.object({
  id: DomainIdSchema,
  statement: z.string().min(1).max(L.assumptionStatement),
  status: z.enum(["explicit", "inferred", "unverified"]),
  justification: z.string().min(1).max(300).optional(),
  affectsFields: z.array(z.string().min(1).max(80)).max(12).optional(),
});

export const PromptEvidenceSchema = z.object({
  field: z.string().min(1).max(80),
  source: z.enum([
    "marketing_plan",
    "creative_concept",
    "video_script",
    "visual_direction",
    "storyboard",
    "brief",
    "derived",
  ]),
  sourcePath: z.string().min(1).max(120).optional(),
  summary: z.string().min(1).max(L.evidenceSummary),
});

export const PromptRationaleSchema = z.object({
  summary: z.string().min(1).max(L.rationaleSummary),
  decisions: z
    .array(
      z.object({
        field: z.string().min(1).max(80),
        summary: z.string().min(1).max(240),
        evidenceRefs: z.array(z.string().min(1).max(80)).max(8),
      }),
    )
    .max(24),
});

export const ScenePackageSchema = ArtifactMetadataSchema.extend({
  artifactType: z.literal(SCENE_PACKAGE_ARTIFACT_TYPE),
  storyboardRevisionId: DomainIdSchema,
  sceneId: DomainIdSchema,
  sceneOrder: z.number().int().positive(),
  productionIntent: z.enum(ProductionIntentValues),
  subject: SubjectBlockSchema,
  action: ActionBlockSchema,
  environment: EnvironmentBlockSchema,
  camera: CameraBlockSchema,
  lighting: LightingBlockSchema,
  style: StyleBlockSchema,
  composition: CompositionBlockSchema,
  dialogue: DialogueBlockSchema.optional(),
  audio: AudioBlockSchema.optional(),
  screenText: ScreenTextBlockSchema.optional(),
  references: z.array(PromptReferenceSchema).max(L.referencesMax),
  constraints: ConstraintBlockSchema,
  variants: z.array(PromptVariantSchema).min(1).max(L.variantsMax),
  assumptions: z.array(PromptAssumptionSchema).max(L.assumptionsMax),
  evidence: z.array(PromptEvidenceSchema).max(L.evidenceMax),
  rationale: PromptRationaleSchema,
}).superRefine((pkg, ctx) => {
  if (pkg.schemaVersion !== SCENE_PACKAGE_SCHEMA_VERSION) {
    ctx.addIssue({
      code: "custom",
      message: `schemaVersion must be ${SCENE_PACKAGE_SCHEMA_VERSION}`,
      path: ["schemaVersion"],
    });
  }
  const ids = pkg.variants.map((v) => v.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", message: "Variantes dupliquées.", path: ["variants"] });
  }
  const profiles = pkg.variants.map((v) => v.capabilityProfile);
  if (new Set(profiles).size !== profiles.length) {
    ctx.addIssue({
      code: "custom",
      message: "Profils de variantes dupliqués.",
      path: ["variants"],
    });
  }
});

/** Atomic lot persisted as a single active artifact (VHS-122). */
export const ScenePackageSetSchema = ArtifactMetadataSchema.extend({
  artifactType: z.literal(SCENE_PACKAGE_SET_ARTIFACT_TYPE),
  storyboardRevisionId: DomainIdSchema,
  rendererVersion: z.literal(PROMPT_RENDERER_VERSION),
  packages: z.array(ScenePackageSchema).min(1).max(64),
}).superRefine((set, ctx) => {
  if (set.schemaVersion !== SCENE_PACKAGE_SET_SCHEMA_VERSION) {
    ctx.addIssue({
      code: "custom",
      message: `schemaVersion must be ${SCENE_PACKAGE_SET_SCHEMA_VERSION}`,
      path: ["schemaVersion"],
    });
  }
  const orders = set.packages.map((p) => p.sceneOrder);
  const sorted = [...orders].sort((a, b) => a - b);
  if (orders.join(",") !== sorted.join(",")) {
    ctx.addIssue({ code: "custom", message: "Packages hors ordre storyboard.", path: ["packages"] });
  }
  const sceneIds = set.packages.map((p) => p.sceneId);
  if (new Set(sceneIds).size !== sceneIds.length) {
    ctx.addIssue({ code: "custom", message: "sceneId dupliqués dans le lot.", path: ["packages"] });
  }
});

export const PromptAnalysisCandidateSchema = z
  .object({
    sceneHints: z
      .array(
        z.object({
          sceneId: DomainIdSchema,
          primaryActionHint: z.string().max(L.action).optional(),
          motionIntensityHint: z.enum(["none", "low", "medium", "high"]).optional(),
          notes: z.string().max(400).optional(),
        }),
      )
      .max(20)
      .optional(),
    assumptions: z.array(PromptAssumptionSchema).max(L.assumptionsMax).optional(),
    notes: z.string().max(400).optional(),
  })
  .strict();

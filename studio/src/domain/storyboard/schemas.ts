import { z } from "zod";
import { ArtifactMetadataSchema, DomainIdSchema } from "@/domain/shared";
import { AspectRatioValues } from "@/domain/brief";
import {
  ProductionIntentValues,
  ScenePurposeValues,
  SceneReferenceKindValues,
} from "./scene";
import { STORYBOARD_FIELD_LIMITS, STORYBOARD_PROJECT_SCHEMA_VERSION } from "./storyboard-project";
import { TransitionTypeValues, TRANSITION_DURATION_MAX_SECONDS } from "./transitions";

const L = STORYBOARD_FIELD_LIMITS;

export const SceneSpokenContentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dialogue"),
    sourceText: z.string().min(1).max(L.spokenText),
    characterId: DomainIdSchema.optional(),
  }),
  z.object({
    kind: z.literal("voice_over"),
    sourceText: z.string().min(1).max(L.spokenText),
  }),
  z.object({ kind: z.literal("none") }),
]);

export const SceneReferenceSchema = z.object({
  id: DomainIdSchema,
  kind: z.enum(SceneReferenceKindValues),
  sourceId: DomainIdSchema,
  role: z.string().min(1).max(L.referenceRole),
  required: z.boolean(),
});

export const StoryboardTransitionSchema = z.object({
  type: z.enum(TransitionTypeValues),
  durationSeconds: z
    .number()
    .min(0)
    .max(TRANSITION_DURATION_MAX_SECONDS)
    .optional(),
  justification: z.string().min(1).max(L.transitionJustification).optional(),
});

export const StoryboardSceneSchema = z.object({
  id: DomainIdSchema,
  order: z.number().int().positive(),
  title: z.string().min(1).max(L.sceneTitle),
  purpose: z.enum(ScenePurposeValues),
  durationSeconds: z.number().positive(),
  scriptSegmentId: DomainIdSchema,
  visualDirectionSegmentId: DomainIdSchema,
  productionIntent: z.enum(ProductionIntentValues),
  spokenContent: SceneSpokenContentSchema,
  screenText: z.string().min(1).max(L.screenText).optional(),
  references: z.array(SceneReferenceSchema).max(L.referencesMax),
  transition: StoryboardTransitionSchema,
  continuityKeys: z.array(z.string().min(1).max(L.continuityKey)).max(L.continuityKeysMax),
});

export const StoryboardSceneTimingSchema = z.object({
  sceneId: DomainIdSchema,
  order: z.number().int().positive(),
  scriptSegmentId: DomainIdSchema,
  durationSeconds: z.number().positive(),
  minimumSpokenSeconds: z.number().nonnegative(),
});

export const StoryboardTimingReportSchema = z.object({
  targetDurationSeconds: z.number().positive(),
  totalSceneDurationSeconds: z.number().nonnegative(),
  differenceSeconds: z.number(),
  precisionSeconds: z.number().positive(),
  status: z.enum(["exact", "invalid"]),
  sceneTimings: z.array(StoryboardSceneTimingSchema),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      field: z.string().optional(),
    }),
  ),
});

export const StoryboardContinuityReportSchema = z.object({
  projectedRuleIds: z.array(DomainIdSchema),
  sceneKeys: z.array(
    z.object({
      sceneId: DomainIdSchema,
      keys: z.array(z.string()),
    }),
  ),
  intentionalBreaks: z.array(
    z.object({
      sceneId: DomainIdSchema,
      scope: z.string().min(1).max(40),
      justification: z.string().min(1).max(L.transitionJustification),
    }),
  ),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      field: z.string().optional(),
    }),
  ),
});

export const StoryboardAssumptionSchema = z.object({
  id: DomainIdSchema,
  statement: z.string().min(1).max(L.assumptionStatement),
  status: z.enum(["explicit", "inferred", "unverified"]),
  justification: z.string().min(1).max(L.assumptionJustification).optional(),
  affectsFields: z.array(z.string().min(1).max(80)).max(12).optional(),
});

export const StoryboardEvidenceSchema = z.object({
  field: z.string().min(1).max(L.evidenceField),
  source: z.enum([
    "marketing_plan",
    "creative_concept",
    "video_script",
    "visual_direction",
    "brief",
    "user_constraint",
    "derived",
  ]),
  sourcePath: z.string().min(1).max(L.evidenceSourcePath).optional(),
  summary: z.string().min(1).max(L.evidenceSummary),
});

export const StoryboardRationaleSchema = z.object({
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

export const StoryboardProjectSchema = ArtifactMetadataSchema.extend({
  videoScriptRevisionId: DomainIdSchema,
  visualDirectionRevisionId: DomainIdSchema,
  title: z.string().min(1).max(L.title),
  durationSeconds: z.union([
    z.literal(15),
    z.literal(20),
    z.literal(30),
    z.literal(60),
  ]),
  aspectRatio: z.enum(AspectRatioValues),
  scenes: z.array(StoryboardSceneSchema).min(L.scenesMin).max(L.scenesMax),
  timing: StoryboardTimingReportSchema,
  continuity: StoryboardContinuityReportSchema,
  assumptions: z.array(StoryboardAssumptionSchema).max(L.assumptionsMax),
  evidence: z.array(StoryboardEvidenceSchema).max(L.evidenceMax),
  rationale: StoryboardRationaleSchema,
}).superRefine((sb, ctx) => {
  if (sb.schemaVersion !== STORYBOARD_PROJECT_SCHEMA_VERSION) {
    ctx.addIssue({
      code: "custom",
      message: `schemaVersion must be ${STORYBOARD_PROJECT_SCHEMA_VERSION}`,
      path: ["schemaVersion"],
    });
  }
  const orders = sb.scenes.map((s) => s.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      ctx.addIssue({
        code: "custom",
        message: "Ordres de scènes non contigus.",
        path: ["scenes"],
      });
      break;
    }
  }
  if (new Set(sb.scenes.map((s) => s.id)).size !== sb.scenes.length) {
    ctx.addIssue({ code: "custom", message: "IDs de scènes dupliqués.", path: ["scenes"] });
  }
  const last = [...sb.scenes].sort((a, b) => a.order - b.order).at(-1);
  if (last && last.transition.type !== "none") {
    ctx.addIssue({
      code: "custom",
      message: "La dernière scène doit avoir transition none.",
      path: ["scenes", sb.scenes.length - 1, "transition"],
    });
  }
});

export const StoryboardAnalysisCandidateSchema = z
  .object({
    title: z.string().min(1).max(L.title),
    scenes: z
      .array(
        StoryboardSceneSchema.omit({ durationSeconds: true }).extend({
          durationSeconds: z.number().positive().optional(),
        }),
      )
      .min(L.scenesMin)
      .max(L.scenesMax),
    intentionalBreaks: StoryboardContinuityReportSchema.shape.intentionalBreaks.optional(),
    assumptions: z.array(StoryboardAssumptionSchema).max(L.assumptionsMax).optional(),
    claimedEvidence: z.array(StoryboardEvidenceSchema).max(L.evidenceMax).optional(),
    claimedTotalDurationSeconds: z.number().optional(),
    notes: z.string().max(400).optional(),
    sceneCountJustification: z.string().max(240).optional(),
  })
  .strict();

import { z } from "zod";
import {
  ArtifactMetadataSchema,
  DomainIdSchema,
  openaiAbsentOptional,
} from "@/domain/shared";
import { DurationValues } from "@/domain/brief";
import {
  SCRIPT_FIELD_LIMITS,
  ScriptSegmentPurposeValues,
  ScriptSpeakerValues,
  VIDEO_SCRIPT_SCHEMA_VERSION,
} from "./video-script";

const L = SCRIPT_FIELD_LIMITS;

export const PronunciationNoteSchema = z.object({
  term: z.string().min(1).max(L.pronunciationTerm),
  pronunciation: z.string().min(1).max(L.pronunciationValue),
  language: openaiAbsentOptional(z.string().min(2).max(16)),
});

export const ScriptSegmentSchema = z
  .object({
    id: DomainIdSchema,
    order: z.number().int().positive(),
    purpose: z.enum(ScriptSegmentPurposeValues),
    speaker: z.enum(ScriptSpeakerValues),
    dialogue: openaiAbsentOptional(z.string().min(1).max(L.dialogue)),
    voiceOver: openaiAbsentOptional(z.string().min(1).max(L.voiceOver)),
    screenText: openaiAbsentOptional(z.string().min(1).max(L.screenText)),
    emotion: z.string().min(1).max(L.emotion),
    pauseAfterMs: z.number().int().min(L.pauseAfterMsMin).max(L.pauseAfterMsMax),
    pronunciationNotes: z.array(PronunciationNoteSchema).max(L.pronunciationNotesMax),
  })
  .superRefine((seg, ctx) => {
    if (seg.speaker === "character" && !seg.dialogue?.trim()) {
      ctx.addIssue({ code: "custom", message: "character speaker requires dialogue.", path: ["dialogue"] });
    }
    if (seg.speaker === "voice_over" && !seg.voiceOver?.trim()) {
      ctx.addIssue({ code: "custom", message: "voice_over speaker requires voiceOver.", path: ["voiceOver"] });
    }
    if (seg.speaker === "none" && (seg.dialogue || seg.voiceOver)) {
      ctx.addIssue({
        code: "custom",
        message: "speaker none forbids dialogue and voiceOver.",
        path: ["speaker"],
      });
    }
    if (seg.dialogue && seg.voiceOver) {
      ctx.addIssue({
        code: "custom",
        message: "dialogue and voiceOver cannot coexist in the same segment.",
        path: ["voiceOver"],
      });
    }
    const terms = new Set<string>();
    for (const note of seg.pronunciationNotes) {
      const key = note.term.toLowerCase();
      if (terms.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate pronunciation term in segment.",
          path: ["pronunciationNotes"],
        });
      }
      terms.add(key);
    }
  });

export const ScriptHookSchema = z.object({
  segmentId: DomainIdSchema,
  text: z.string().min(1).max(L.hookText),
});

export const ScriptCallToActionSchema = z.object({
  segmentId: DomainIdSchema,
  text: z.string().min(1).max(L.ctaText),
  sourceMarketingCta: z.string().min(1).max(L.ctaText),
  adaptationNote: openaiAbsentOptional(
    z.string().min(1).max(L.ctaAdaptationNote)
  ),
});

export const ScriptAssumptionSchema = z
  .object({
    id: DomainIdSchema,
    statement: z.string().min(1).max(L.assumptionStatement),
    status: z.enum(["explicit", "inferred", "unverified"]),
    justification: openaiAbsentOptional(
      z.string().min(1).max(L.assumptionJustification)
    ),
    affectsFields: openaiAbsentOptional(
      z.array(z.string().min(1).max(L.evidenceField)).max(8)
    ),
  })
  .superRefine((value, ctx) => {
    if (
      (value.status === "inferred" || value.status === "unverified") &&
      !value.justification?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Derived/unverified assumptions require justification.",
        path: ["justification"],
      });
    }
  });

export const ScriptEvidenceSchema = z
  .object({
    field: z.string().min(1).max(L.evidenceField),
    source: z.enum(["marketing_plan", "creative_concept", "brief", "user_constraint", "derived"]),
    sourcePath: openaiAbsentOptional(
      z.string().min(1).max(L.evidenceSourcePath)
    ),
    summary: z.string().min(1).max(L.evidenceSummary),
  })
  .superRefine((value, ctx) => {
    if (value.sourcePath != null && !/^[a-zA-Z0-9_.]+$/.test(value.sourcePath)) {
      ctx.addIssue({ code: "custom", message: "Invalid evidence sourcePath.", path: ["sourcePath"] });
    }
  });

export const ScriptRationaleSchema = z.object({
  summary: z.string().min(1).max(L.rationaleSummary),
  decisions: z
    .array(
      z.object({
        field: z.string().min(1).max(L.evidenceField),
        summary: z.string().min(1).max(L.evidenceSummary),
        evidenceRefs: z.array(z.string().min(1).max(64)).max(12),
      }),
    )
    .max(L.decisionCountMax),
});

export const SegmentTimingSchema = z.object({
  segmentId: DomainIdSchema,
  order: z.number().int().positive(),
  spokenDurationSeconds: z.number().nonnegative(),
  screenDurationSeconds: z.number().nonnegative(),
  pauseDurationSeconds: z.number().nonnegative(),
  totalDurationSeconds: z.number().nonnegative(),
});

export const ScriptTimingReportSchema = z.object({
  profileId: z.string().min(1).max(64),
  spokenWordCount: z.number().int().nonnegative(),
  screenWordCount: z.number().int().nonnegative(),
  spokenDurationSeconds: z.number().nonnegative(),
  screenDurationSeconds: z.number().nonnegative(),
  pausesDurationSeconds: z.number().nonnegative(),
  estimatedTotalSeconds: z.number().nonnegative(),
  targetDurationSeconds: z.union([
    z.literal(15),
    z.literal(20),
    z.literal(30),
    z.literal(60),
  ]),
  differenceSeconds: z.number(),
  status: z.enum(["within_target", "too_short", "too_long"]),
  segmentTimings: z.array(SegmentTimingSchema),
});

export const VideoScriptFieldsSchema = z
  .object({
    creativeConceptRevisionId: DomainIdSchema,
    marketingPlanRevisionId: DomainIdSchema,
    title: z.string().min(1).max(L.title),
    summary: z.string().min(1).max(L.summary),
    language: z.string().min(2).max(16),
    targetDurationSeconds: z.union([
      z.literal(15),
      z.literal(20),
      z.literal(30),
      z.literal(60),
    ]),
    estimatedDurationSeconds: z.number().positive(),
    estimatedReadingSeconds: z.number().nonnegative(),
    hook: ScriptHookSchema,
    segments: z.array(ScriptSegmentSchema).min(L.segmentsMin).max(L.segmentsMax),
    callToAction: ScriptCallToActionSchema,
    timing: ScriptTimingReportSchema,
    assumptions: z.array(ScriptAssumptionSchema).max(L.assumptionsMax),
    evidence: z.array(ScriptEvidenceSchema).min(1).max(L.evidenceMax),
    rationale: ScriptRationaleSchema,
  })
  .superRefine((value, ctx) => {
    const orders = value.segments.map((s) => s.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        ctx.addIssue({
          code: "custom",
          message: "Segment orders must be unique, contiguous, and start at 1.",
          path: ["segments"],
        });
        break;
      }
    }
    const ids = value.segments.map((s) => s.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "Segment ids must be unique.", path: ["segments"] });
    }
    if (!(DurationValues as readonly number[]).includes(value.targetDurationSeconds)) {
      ctx.addIssue({
        code: "custom",
        message: "Unsupported target duration.",
        path: ["targetDurationSeconds"],
      });
    }
  });

export const VideoScriptSchema = ArtifactMetadataSchema.extend({
  schemaVersion: z.literal(VIDEO_SCRIPT_SCHEMA_VERSION),
}).and(VideoScriptFieldsSchema);

export const ScriptAnalysisCandidateSchema = z.object({
  title: z.string().min(1).max(L.title),
  summary: z.string().min(1).max(L.summary),
  language: z.string().min(2).max(16),
  hookText: z.string().min(1).max(L.hookText),
  segments: z.array(ScriptSegmentSchema).min(L.segmentsMin).max(L.segmentsMax),
  callToActionText: z.string().min(1).max(L.ctaText),
  adaptationNote: openaiAbsentOptional(
    z.string().min(1).max(L.ctaAdaptationNote)
  ),
  assumptions: openaiAbsentOptional(
    z.array(ScriptAssumptionSchema).max(L.assumptionsMax)
  ),
  claimedEvidence: openaiAbsentOptional(
    z.array(ScriptEvidenceSchema).max(L.evidenceMax)
  ),
  notes: openaiAbsentOptional(z.string().max(500)),
});

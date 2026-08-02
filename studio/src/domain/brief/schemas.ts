import { z } from "zod";
import { ArtifactMetadataSchema, DomainIdSchema } from "@/domain/shared";
import {
  AspectRatioValues,
  BRIEF_SCHEMA_VERSION,
  FIELD_LIMITS,
  MediaKindValues,
  ObjectiveValues,
  PlatformValues,
  SubjectTypeValues,
  ToneValues,
} from "./brief";

export const BriefMediaReferenceSchema = z.object({
  id: z.string().min(1).max(128),
  kind: z.enum(MediaKindValues),
  label: z.string().min(1).max(FIELD_LIMITS.mediaLabel),
  uri: z
    .string()
    .max(FIELD_LIMITS.mediaUri)
    .refine((u) => !/^data:/i.test(u) && !/^blob:/i.test(u), "Binary media URIs are not allowed")
    .optional(),
});

export const VideoProjectBriefFieldsSchema = z.object({
  projectName: z.string().min(1).max(FIELD_LIMITS.projectName),
  subjectType: z.enum(SubjectTypeValues),
  subjectName: z.string().min(1).max(FIELD_LIMITS.subjectName),
  subjectDescription: z.string().min(1).max(FIELD_LIMITS.subjectDescription),
  objective: z.enum(ObjectiveValues),
  platform: z.enum(PlatformValues),
  durationSeconds: z.union([
    z.literal(15),
    z.literal(20),
    z.literal(30),
    z.literal(60),
  ]),
  aspectRatio: z.enum(AspectRatioValues),
  language: z.string().regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/),
  tone: z.enum(ToneValues),
  characterId: DomainIdSchema.optional(),
  callToAction: z.string().max(FIELD_LIMITS.callToAction).optional(),
  audienceDescription: z.string().max(FIELD_LIMITS.audienceDescription).optional(),
  brandConstraints: z.string().max(FIELD_LIMITS.brandConstraints).optional(),
  mediaReferences: z.array(BriefMediaReferenceSchema).max(FIELD_LIMITS.mediaMax),
});

export const VideoProjectBriefSchema = ArtifactMetadataSchema.extend({
  schemaVersion: z.literal(BRIEF_SCHEMA_VERSION),
}).and(VideoProjectBriefFieldsSchema);

export const VideoProjectBriefDraftSchema = z.object({
  draftVersion: z.string().min(1).max(32),
  updatedAt: z.iso.datetime({ offset: true }),
  currentStep: z.number().int().min(0).max(20),
  fields: VideoProjectBriefFieldsSchema.partial(),
});

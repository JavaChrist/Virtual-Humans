/**
 * Zod schemas for capability registry (VHS-107).
 */

import { z } from "zod";
import { CapabilityProfileValues } from "@/domain/prompt";
import { AspectRatioValues } from "@/domain/brief";
import { MoneySchema } from "@/domain/cost/schemas";
import { IsoDateTimeSchema } from "@/domain/shared";
import {
  EvidenceConfidenceValues,
  EvidenceSourceValues,
  MediaInputTypeValues,
  MediaOutputTypeValues,
  ModelStatusValues,
} from "./model";
import {
  PricingConfidenceValues,
  PricingSourceValues,
  PricingUnitValues,
} from "./pricing";
import { ProviderStatusValues, RegionCodeValues } from "./provider";

const IdProvider = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/);
const IdModel = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/\-]*$/);

export const ScoreSchema = z.number().int().min(0).max(100);

export const PricingConditionSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string().min(1).max(120),
});

export const PricingDefinitionSchema = z.object({
  id: z.string().min(1).max(128),
  unit: z.enum(PricingUnitValues),
  unitCost: MoneySchema,
  minimumCharge: MoneySchema.optional(),
  conditions: z.array(PricingConditionSchema).max(16),
  pricingVersion: z.string().min(1).max(64),
  validFrom: IsoDateTimeSchema.optional(),
  validUntil: IsoDateTimeSchema.optional(),
  source: z.enum(PricingSourceValues),
  confidence: z.enum(PricingConfidenceValues),
});

export const CapabilityEvidenceSchema = z.object({
  field: z.string().min(1).max(80),
  source: z.enum(EvidenceSourceValues),
  reference: z.string().min(1).max(200),
  verifiedAt: IsoDateTimeSchema.optional(),
  confidence: z.enum(EvidenceConfidenceValues),
});

export const CapabilityScoresSchema = z
  .object({
    quality: ScoreSchema.optional(),
    identity: ScoreSchema.optional(),
    speed: ScoreSchema.optional(),
    reliability: ScoreSchema.optional(),
    costEfficiency: ScoreSchema.optional(),
  })
  .strict();

export const DurationCapabilitiesSchema = z
  .object({
    minimumSeconds: z.number().positive().optional(),
    maximumSeconds: z.number().positive().optional(),
    supportedValuesSeconds: z.array(z.number().positive()).max(32).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (
      d.minimumSeconds !== undefined &&
      d.maximumSeconds !== undefined &&
      d.minimumSeconds > d.maximumSeconds
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minimumSeconds must be ≤ maximumSeconds",
        path: ["minimumSeconds"],
      });
    }
    if (d.supportedValuesSeconds) {
      for (const v of d.supportedValuesSeconds) {
        if (d.minimumSeconds !== undefined && v < d.minimumSeconds) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "discrete value below minimum",
            path: ["supportedValuesSeconds"],
          });
        }
        if (d.maximumSeconds !== undefined && v > d.maximumSeconds) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "discrete value above maximum",
            path: ["supportedValuesSeconds"],
          });
        }
      }
    }
  });

export const ReferenceCapabilitiesSchema = z
  .object({
    referenceImages: z.boolean().optional(),
    startFrame: z.boolean().optional(),
    endFrame: z.boolean().optional(),
    characterIdentity: z.boolean().optional(),
    product: z.boolean().optional(),
    audioVoice: z.boolean().optional(),
    maxReferences: z.number().int().positive().max(64).optional(),
  })
  .strict();

export const AudioCapabilitiesSchema = z
  .object({
    inputAudio: z.boolean().optional(),
    nativeAudioOutput: z.boolean().optional(),
    nativeDialogue: z.boolean().optional(),
    voiceOver: z.boolean().optional(),
    lipsync: z.boolean().optional(),
    voiceControl: z.boolean().optional(),
  })
  .strict();

export const CharacterCapabilitiesSchema = z
  .object({
    maxCharacters: z.number().int().nonnegative().max(16).optional(),
    identityPreservation: z.boolean().optional(),
    multiCharacter: z.boolean().optional(),
  })
  .strict();

export const ModelLimitsSchema = z
  .object({
    maxPromptChars: z.number().int().positive().optional(),
    maxOutputSeconds: z.number().positive().optional(),
    concurrencyHint: z.number().int().positive().optional(),
  })
  .strict();

export const ProviderDefinitionSchema = z.object({
  id: IdProvider,
  displayName: z.string().min(1).max(120),
  adapterKind: z.string().min(1).max(64),
  enabled: z.boolean(),
  regions: z.array(z.enum(RegionCodeValues)).max(8),
  dataResidency: z.array(z.enum(RegionCodeValues)).max(8).optional(),
  supportsIdempotency: z.boolean(),
  supportsCancellation: z.boolean(),
  supportsWebhooks: z.boolean(),
  status: z.enum(ProviderStatusValues),
  statusCheckedAt: IsoDateTimeSchema.optional(),
});

export const ModelCapabilitiesSchema = z
  .object({
    providerId: IdProvider,
    modelId: IdModel,
    externalModelId: IdModel.optional(),
    displayName: z.string().min(1).max(160),
    enabled: z.boolean(),
    status: z.enum(ModelStatusValues),
    supportedProfiles: z.array(z.enum(CapabilityProfileValues)).max(16),
    mediaInputs: z.array(z.enum(MediaInputTypeValues)).max(16),
    mediaOutputs: z.array(z.enum(MediaOutputTypeValues)).max(8),
    supportedAspectRatios: z.array(z.enum(AspectRatioValues)).max(8),
    duration: DurationCapabilitiesSchema,
    references: ReferenceCapabilitiesSchema,
    audio: AudioCapabilitiesSchema,
    characters: CharacterCapabilitiesSchema,
    limits: ModelLimitsSchema,
    pricing: z.array(PricingDefinitionSchema).max(24),
    quality: CapabilityScoresSchema,
    regions: z.array(z.enum(RegionCodeValues)).max(8),
    evidence: z.array(CapabilityEvidenceSchema).max(48),
    verifiedAt: IsoDateTimeSchema.optional(),
  })
  .superRefine((m, ctx) => {
    const scores = m.quality;
    const scoreFields = [
      "quality",
      "identity",
      "speed",
      "reliability",
      "costEfficiency",
    ] as const;
    for (const f of scoreFields) {
      if (scores[f] !== undefined) {
        const has = m.evidence.some((e) => e.field === `quality.${f}` || e.field === f);
        if (!has) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Score ${f} requires evidence`,
            path: ["quality", f],
          });
        }
      }
    }
  });

export const CapabilityRegistrySnapshotSchema = z
  .object({
    schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    registryVersion: z.string().min(1).max(64),
    createdAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema.optional(),
    providers: z.array(ProviderDefinitionSchema).max(32),
    models: z.array(ModelCapabilitiesSchema).max(256),
  })
  .superRefine((snap, ctx) => {
    if (snap.expiresAt) {
      const created = Date.parse(snap.createdAt);
      const exp = Date.parse(snap.expiresAt);
      if (!Number.isFinite(created) || !Number.isFinite(exp) || exp <= created) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "expiresAt must be after createdAt",
          path: ["expiresAt"],
        });
      }
    }
    const providerIds = new Set<string>();
    for (const p of snap.providers) {
      if (providerIds.has(p.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate provider",
          path: ["providers"],
        });
      }
      providerIds.add(p.id);
    }
    const modelKeys = new Set<string>();
    for (const m of snap.models) {
      const key = `${m.providerId}::${m.modelId}`;
      if (modelKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "duplicate model",
          path: ["models"],
        });
      }
      modelKeys.add(key);
      if (!providerIds.has(m.providerId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "orphan model",
          path: ["models"],
        });
      }
    }
  });

export type CapabilityRegistrySnapshotParsed = z.infer<
  typeof CapabilityRegistrySnapshotSchema
>;

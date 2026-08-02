import { z } from "zod";
import { ArtifactMetadataSchema, DomainIdSchema } from "@/domain/shared";
import {
  ConfidenceValues,
  COST_ESTIMATE_SCHEMA_VERSION,
  EstimationUnitValues,
  MediaActionSchemaValues,
} from "./estimate";

export const MoneySchema = z.object({
  amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export const MediaActionSchema = z.enum(MediaActionSchemaValues);
export const EstimationUnitSchema = z.enum(EstimationUnitValues);
export const EstimateConfidenceSchema = z.enum(ConfidenceValues);

export const CostEstimateSchema = ArtifactMetadataSchema.extend({
  schemaVersion: z.literal(COST_ESTIMATE_SCHEMA_VERSION),
  sceneId: DomainIdSchema.optional(),
  action: MediaActionSchema,
  modelId: z.string().min(1).max(256).optional(),
  providerId: z.string().min(1).max(128).optional(),
  quantity: z.number().int().nonnegative(),
  unit: EstimationUnitSchema,
  unitCost: MoneySchema,
  subtotal: MoneySchema,
  margin: MoneySchema,
  total: MoneySchema,
  confidence: EstimateConfidenceSchema,
  pricingVersion: z.string().min(1).max(128),
  validUntil: z.iso.datetime({ offset: true }).optional(),
  assumptions: z.array(z.string()),
});

export const BudgetPolicySchema = z.object({
  hardLimit: MoneySchema,
  warningThreshold: MoneySchema.optional(),
  allowOverage: z.literal(false),
});

export const BudgetSnapshotSchema = z.object({
  limit: MoneySchema,
  reserved: MoneySchema,
  spent: MoneySchema,
  available: MoneySchema,
});

export const DryRunRequestSchema = z.object({
  mode: z.literal("dry-run"),
  projectId: DomainIdSchema.optional(),
  sceneId: DomainIdSchema.optional(),
  action: MediaActionSchema,
  inputs: z.object({
    refs: z.array(z.string()).optional(),
    refKinds: z.array(z.string()).optional(),
    durationSeconds: z.number().int().nonnegative().optional(),
    aspectRatio: z.string().optional(),
    format: z.string().optional(),
    modelId: z.string().optional(),
    extras: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
});

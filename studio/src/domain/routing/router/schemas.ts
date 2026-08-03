/**
 * Lightweight Zod schemas for routing policy (VHS-108).
 */

import { z } from "zod";

export const RoutingPolicySchema = z.object({
  version: z.string().min(1).max(64),
  priorities: z.object({
    quality: z.number().int().min(0).max(100),
    identity: z.number().int().min(0).max(100),
    speed: z.number().int().min(0).max(100),
    reliability: z.number().int().min(0).max(100),
    cost: z.number().int().min(0).max(100),
  }),
  hardRequirements: z.object({
    identityScoreRequiredWhenHighPriority: z.boolean(),
    requireFirmPricing: z.boolean(),
    rejectUnknownPricingConfidence: z.boolean(),
  }),
  maximumCandidatesPerStep: z.number().int().min(1).max(20),
  maximumStrategyCombinations: z.number().int().min(1).max(256),
  maximumFallbacksPerStep: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  unknownScorePolicy: z.object({
    quality: z.enum(["block", "exclude_from_denominator", "penalty"]),
    identity: z.enum(["block", "exclude_from_denominator", "penalty"]),
    speed: z.enum(["block", "exclude_from_denominator", "penalty"]),
    reliability: z.enum(["block", "exclude_from_denominator", "penalty"]),
    cost: z.enum(["block", "exclude_from_denominator", "penalty"]),
    penaltyPoints: z.number().int().min(0).max(100),
  }),
  tieBreakers: z
    .array(
      z.enum([
        "total_score_desc",
        "reliability_desc",
        "cost_asc",
        "duration_asc",
        "providerId_asc",
        "modelId_asc",
        "strategyId_asc",
      ]),
    )
    .min(1),
  maxRejectedAlternatives: z.number().int().min(0).max(32),
});

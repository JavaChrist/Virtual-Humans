/**
 * Zod schemas for production boundary validation (lightweight).
 */

import { z } from "zod";

export const ProductionPolicySchema = z.object({
  version: z.string().min(1),
  maxConcurrentScenes: z.number().int().min(1).max(32),
  maxConcurrentSteps: z.number().int().min(1).max(64),
  stopProjectOnSceneFailure: z.boolean(),
  allowPartialResult: z.boolean(),
  qualityFailureAllowsFallback: z.boolean(),
});

export const StepRunStatusSchema = z.enum([
  "pending",
  "ready",
  "reserved",
  "executing",
  "submitted",
  "polling",
  "validating",
  "completed",
  "fallback_ready",
  "failed",
  "cancelled",
  "skipped",
]);

export const ProductionRunStatusSchema = z.enum([
  "pending",
  "validating",
  "running",
  "cancelling",
  "completed",
  "partial",
  "failed",
  "cancelled",
]);

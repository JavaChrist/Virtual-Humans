/**
 * Zod schemas for generation domain boundaries (VHS-109).
 */

import { z } from "zod";
import { GenerationErrorCodeValues } from "./errors";

export const ExternalJobRefSchema = z.object({
  providerId: z.string().min(1).max(64),
  modelId: z.string().min(1).max(160),
  externalJobId: z.string().min(1).max(256),
});

export const GenerationErrorSchema = z.object({
  code: z.enum(GenerationErrorCodeValues),
  retryable: z.boolean(),
  publicMessage: z.string().min(1).max(500),
  internalCode: z.string().max(120).optional(),
  providerId: z.string().max(64).optional(),
  modelId: z.string().max(160).optional(),
});

export const IdempotencyKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9:._\-]+$/);

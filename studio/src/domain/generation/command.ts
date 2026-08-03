/**
 * GenerationCommand contract (VHS-109).
 */

import type { ScenePackage } from "@/domain/prompt";
import type { GenerationStep } from "@/domain/routing/router";
import type { ResolvedGenerationInput } from "./input";

export type GenerationCommand = {
  projectId: string;
  planRevisionId: string;
  sceneId: string;
  step: GenerationStep;
  scenePackage: ScenePackage;
  resolvedInputs: ResolvedGenerationInput[];
  idempotencyKey: string;
  requestedAt: string;
  /** Positive attempt number encoded in the idempotency key. */
  attempt: number;
};

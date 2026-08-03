/**
 * Idempotency keys and command fingerprints (VHS-109).
 * No persistence in this increment — keys are validated and transmitted only.
 */

import { createHash } from "node:crypto";
import { GenerationDomainError } from "./errors";

export const IDEMPOTENCY_KEY_MAX = 200;
const SAFE_RE = /^[A-Za-z0-9:._\-]{1,200}$/;

/**
 * Canonical key: projectId:planRevisionId:sceneId:stepId:attempt
 * No user content, prompts, or secrets.
 */
export function buildIdempotencyKey(parts: {
  projectId: string;
  planRevisionId: string;
  sceneId: string;
  stepId: string;
  attempt: number;
}): string {
  if (!Number.isInteger(parts.attempt) || parts.attempt < 1) {
    throw new GenerationDomainError("invalid_input", "Idempotency attempt must be a positive integer.");
  }
  const key = [
    parts.projectId,
    parts.planRevisionId,
    parts.sceneId,
    parts.stepId,
    String(parts.attempt),
  ].join(":");
  validateIdempotencyKey(key);
  return key;
}

export function validateIdempotencyKey(key: string): void {
  if (!key || key.length > IDEMPOTENCY_KEY_MAX || !SAFE_RE.test(key)) {
    throw new GenerationDomainError(
      "invalid_input",
      "Invalid idempotency key.",
      { diagnostic: "key format or length invalid" },
    );
  }
}

/**
 * Deterministic fingerprint of a command for conflict detection.
 * EXCLUDES: signed URLs, secrets, volatile timestamps, binaries.
 * INCLUDES: project/plan/scene/step ids, action, provider, model, profile,
 * promptVariantId, reference assetIds (not URLs), duration, aspect ratio,
 * dialogue length (not text), dependency step ids, attempt.
 */
export type CommandFingerprintInput = {
  projectId: string;
  planRevisionId: string;
  sceneId: string;
  stepId: string;
  action: string;
  providerId: string;
  modelId: string;
  capabilityProfile: string;
  promptVariantId?: string;
  referenceAssetIds: string[];
  durationSeconds?: number;
  aspectRatio?: string;
  dialogueCharCount?: number;
  dependsOnStepIds: string[];
  attempt: number;
};

export function buildCommandFingerprint(input: CommandFingerprintInput): string {
  const payload = {
    projectId: input.projectId,
    planRevisionId: input.planRevisionId,
    sceneId: input.sceneId,
    stepId: input.stepId,
    action: input.action,
    providerId: input.providerId,
    modelId: input.modelId,
    capabilityProfile: input.capabilityProfile,
    promptVariantId: input.promptVariantId ?? null,
    referenceAssetIds: [...input.referenceAssetIds].sort(),
    durationSeconds: input.durationSeconds ?? null,
    aspectRatio: input.aspectRatio ?? null,
    dialogueCharCount: input.dialogueCharCount ?? null,
    dependsOnStepIds: [...input.dependsOnStepIds],
    attempt: input.attempt,
  };
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json).digest("hex");
}

/** Future port — no Supabase implementation in this increment. */
export type StoredExecution = {
  key: string;
  fingerprint: string;
  status: "begun" | "completed" | "failed";
};

export type BeginResult =
  | { status: "begun" }
  | { status: "conflict"; reason: "fingerprint_mismatch" | "already_completed" };

export interface IdempotencyStore {
  find(key: string): Promise<StoredExecution | null>;
  begin(key: string, commandFingerprint: string): Promise<BeginResult>;
  complete(key: string, resultFingerprint: string): Promise<void>;
  fail(key: string, errorCode: string): Promise<void>;
}

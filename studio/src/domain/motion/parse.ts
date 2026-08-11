/**
 * Parse + invariant enforcement for Motion Transfer contracts (MT-001).
 */

import { MotionTransferDomainError } from "./errors";
import {
  fingerprintMotionMediaReference,
  validateMotionMediaReference,
  type MotionMediaReference,
} from "./media-reference";
import {
  MotionQcResultSchema,
  MotionReferenceSpecSchema,
  MotionTransferInputSchema,
  MotionTransferResultSchema,
} from "./schemas";
import type {
  MotionFidelity,
  MotionQcResult,
  MotionReferenceSpec,
  MotionTransferInput,
  MotionTransferResult,
} from "./types";
import { modelSupportsMotionFidelity } from "./types";
import { deepFreeze } from "./freeze";
import { redactMotionTransferInput } from "./redact";

export type ParseMotionTransferOptions = {
  allowDataUrl?: boolean;
  at?: string;
  /**
   * Optional future registry declaration — when provided, fidelity must be listed.
   * MT-001 exposes the invariant without selecting a provider.
   */
  declaredMotionFidelityLevels?: readonly MotionFidelity[];
};

function uniqueIds(ids: string[], field: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new MotionTransferDomainError("duplicate_id", "Duplicate id in motion contract.", {
        field,
      });
    }
    seen.add(id);
  }
}

function assertMedia(
  ref: MotionMediaReference,
  role: MotionMediaReference["role"],
  options: ParseMotionTransferOptions,
  expectedKinds: readonly ("video" | "character" | "outfit" | "image")[],
): void {
  validateMotionMediaReference(ref, {
    role,
    allowDataUrl: options.allowDataUrl === true,
    at: options.at,
    expectedKinds,
  });
}

export function assertMotionReferenceSpecInvariants(spec: MotionReferenceSpec): void {
  uniqueIds(
    spec.phases.map((p) => p.phaseId),
    "referenceSpec.phases.phaseId",
  );
  uniqueIds(
    spec.checkpoints.map((c) => c.checkpointId),
    "referenceSpec.checkpoints.checkpointId",
  );
  uniqueIds(
    spec.bodyRelations.map((r) => r.relationId),
    "referenceSpec.bodyRelations.relationId",
  );
  uniqueIds(
    spec.forbiddenPatterns.map((p) => p.patternId),
    "referenceSpec.forbiddenPatterns.patternId",
  );
  uniqueIds(
    spec.timingConstraints.map((t) => t.constraintId),
    "referenceSpec.timingConstraints.constraintId",
  );
  uniqueIds(
    spec.cameraConstraints.map((c) => c.constraintId),
    "referenceSpec.cameraConstraints.constraintId",
  );

  const phaseIds = new Set(spec.phases.map((p) => p.phaseId));
  for (const checkpoint of spec.checkpoints) {
    if (!phaseIds.has(checkpoint.phaseId)) {
      throw new MotionTransferDomainError(
        "invalid_motion_checkpoint",
        "Checkpoint references an unknown phase.",
        { field: "referenceSpec.checkpoints.phaseId" },
      );
    }
    if (!checkpoint.description.trim()) {
      throw new MotionTransferDomainError(
        "invalid_motion_reference_spec",
        "Checkpoint description must be non-empty.",
        { field: "referenceSpec.checkpoints.description" },
      );
    }
  }

  for (const relation of spec.bodyRelations) {
    if (!relation.description.trim()) {
      throw new MotionTransferDomainError(
        "invalid_motion_reference_spec",
        "Body relation description must be non-empty.",
        { field: "referenceSpec.bodyRelations.description" },
      );
    }
  }

  for (const pattern of spec.forbiddenPatterns) {
    if (!pattern.description.trim()) {
      throw new MotionTransferDomainError(
        "invalid_motion_reference_spec",
        "Forbidden pattern description must be non-empty.",
        { field: "referenceSpec.forbiddenPatterns.description" },
      );
    }
  }

  for (const phase of spec.phases) {
    const range = phase.expectedDurationSeconds;
    if (range?.min != null && range?.max != null && range.min > range.max) {
      throw new MotionTransferDomainError(
        "contradictory_constraints",
        "Phase duration range is contradictory.",
        { field: "referenceSpec.phases.expectedDurationSeconds" },
      );
    }
  }
}

export function assertMotionTransferInputInvariants(
  input: MotionTransferInput,
  options: ParseMotionTransferOptions = {},
): void {
  if (input.schemaVersion !== "1.0.0") {
    throw new MotionTransferDomainError(
      "unknown_schema_version",
      "Unknown MotionTransferInput schema version.",
      { field: "schemaVersion" },
    );
  }

  if (input.capability !== "video.motion_transfer") {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "Capability must be video.motion_transfer.",
      { field: "capability" },
    );
  }

  assertMedia(input.sourceVideo, "source_video", options, ["video"]);

  if (!input.character.characterId.trim()) {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "characterId is required.",
      { field: "character.characterId" },
    );
  }

  for (const ref of input.character.identityReferences) {
    assertMedia(ref, "identity", options, ["character", "image"]);
  }

  if (
    input.character.identityLock === "required" &&
    input.character.identityReferences.length < 1
  ) {
    throw new MotionTransferDomainError(
      "identity_reference_required",
      "At least one identity reference is required when identityLock=required.",
      { field: "character.identityReferences" },
    );
  }

  if (input.character.outfitLock === "required") {
    if (!input.character.outfitReference) {
      throw new MotionTransferDomainError(
        "outfit_reference_required",
        "outfitReference is required when outfitLock=required.",
        { field: "character.outfitReference" },
      );
    }
  }

  if (input.character.outfitReference) {
    assertMedia(input.character.outfitReference, "outfit", options, [
      "outfit",
      "image",
    ]);
  }

  if (input.motion.preserveMotion !== true) {
    throw new MotionTransferDomainError(
      "contradictory_constraints",
      "preserveMotion must be true for video.motion_transfer.",
      { field: "motion.preserveMotion" },
    );
  }

  if (options.declaredMotionFidelityLevels) {
    if (
      !modelSupportsMotionFidelity(
        input.motion.fidelity,
        options.declaredMotionFidelityLevels,
      )
    ) {
      throw new MotionTransferDomainError(
        "unsupported_motion_fidelity",
        "Motion fidelity is not declared as supported.",
        { field: "motion.fidelity" },
      );
    }
  }

  if (input.motion.fidelity === "critical") {
    const humanRequired =
      input.qcRequirements.some((q) => q.humanValidationRequired === true) ||
      input.referenceSpec?.humanValidationRequired === true;
    if (!humanRequired) {
      throw new MotionTransferDomainError(
        "human_validation_required",
        "fidelity=critical requires humanValidationRequired.",
        { field: "qcRequirements" },
      );
    }
  }

  if (input.referenceSpec) {
    if (input.referenceSpec.schemaVersion !== "1.0.0") {
      throw new MotionTransferDomainError(
        "unknown_schema_version",
        "Unknown MotionReferenceSpec schema version.",
        { field: "referenceSpec.schemaVersion" },
      );
    }
    assertMotionReferenceSpecInvariants(input.referenceSpec);
  }

  // No I2V fallback fields allowed on this contract.
  const hostile = input as MotionTransferInput & {
    startFrame?: unknown;
    imageToVideo?: unknown;
  };
  if (hostile.startFrame != null || hostile.imageToVideo != null) {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "I2V fields are not allowed on MotionTransferInput.",
      { field: "capability" },
    );
  }
}

export function parseMotionTransferInput(
  raw: unknown,
  options: ParseMotionTransferOptions = {},
): MotionTransferInput {
  if (
    raw &&
    typeof raw === "object" &&
    "schemaVersion" in raw &&
    (raw as { schemaVersion?: unknown }).schemaVersion !== "1.0.0"
  ) {
    throw new MotionTransferDomainError(
      "unknown_schema_version",
      "Unknown MotionTransferInput schema version.",
      { field: "schemaVersion" },
    );
  }

  const parsed = MotionTransferInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.join(".") || undefined;
    const unrecognized =
      issue?.code === "unrecognized_keys" ||
      String(issue?.message ?? "").toLowerCase().includes("unrecognized");
    if (unrecognized) {
      throw new MotionTransferDomainError(
        "invalid_motion_transfer_input",
        "I2V fields are not allowed on MotionTransferInput.",
        { field: "capability" },
      );
    }
    if (issue?.path?.[0] === "sourceVideo") {
      throw new MotionTransferDomainError(
        "source_video_required",
        "sourceVideo is required and must be a valid media reference.",
        { field: "sourceVideo" },
      );
    }
    if (issue?.path?.[0] === "schemaVersion") {
      throw new MotionTransferDomainError(
        "unknown_schema_version",
        "Unknown MotionTransferInput schema version.",
        { field: "schemaVersion" },
      );
    }
    if (issue?.path?.includes("aspectRatio")) {
      throw new MotionTransferDomainError(
        "invalid_aspect_ratio",
        "aspectRatio is invalid.",
        { field: "output.aspectRatio" },
      );
    }
    if (issue?.path?.includes("fps")) {
      throw new MotionTransferDomainError(
        "invalid_fps",
        "fps is out of bounds.",
        { field: "output.fps" },
      );
    }
    if (issue?.path?.includes("durationSeconds")) {
      throw new MotionTransferDomainError(
        "invalid_duration",
        "durationSeconds is out of bounds.",
        { field: "output.durationSeconds" },
      );
    }
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "MotionTransferInput failed validation.",
      { field, diagnostic: issue?.message },
    );
  }

  assertMotionTransferInputInvariants(parsed.data, options);
  return deepFreeze(structuredClone(parsed.data));
}

export function parseMotionReferenceSpec(raw: unknown): MotionReferenceSpec {
  if (
    raw &&
    typeof raw === "object" &&
    "schemaVersion" in raw &&
    (raw as { schemaVersion?: unknown }).schemaVersion !== "1.0.0"
  ) {
    throw new MotionTransferDomainError(
      "unknown_schema_version",
      "Unknown MotionReferenceSpec schema version.",
      { field: "schemaVersion" },
    );
  }
  const parsed = MotionReferenceSpecSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MotionTransferDomainError(
      "invalid_motion_reference_spec",
      "MotionReferenceSpec failed validation.",
      { diagnostic: parsed.error.issues[0]?.message },
    );
  }
  assertMotionReferenceSpecInvariants(parsed.data);
  return deepFreeze(structuredClone(parsed.data));
}

export function parseMotionQcResult(raw: unknown): MotionQcResult {
  if (
    raw &&
    typeof raw === "object" &&
    "schemaVersion" in raw &&
    (raw as { schemaVersion?: unknown }).schemaVersion !== "1.0.0"
  ) {
    throw new MotionTransferDomainError(
      "unknown_schema_version",
      "Unknown MotionQcResult schema version.",
      { field: "schemaVersion" },
    );
  }
  const parsed = MotionQcResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "MotionQcResult failed validation.",
      { diagnostic: parsed.error.issues[0]?.message },
    );
  }
  return deepFreeze(structuredClone(parsed.data));
}

export function parseMotionTransferResult(raw: unknown): MotionTransferResult {
  if (
    raw &&
    typeof raw === "object" &&
    "schemaVersion" in raw &&
    (raw as { schemaVersion?: unknown }).schemaVersion !== "1.0.0"
  ) {
    throw new MotionTransferDomainError(
      "unknown_schema_version",
      "Unknown MotionTransferResult schema version.",
      { field: "schemaVersion" },
    );
  }
  const parsed = MotionTransferResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new MotionTransferDomainError(
      "invalid_motion_transfer_input",
      "MotionTransferResult failed validation.",
      { diagnostic: parsed.error.issues[0]?.message },
    );
  }
  return deepFreeze(structuredClone(parsed.data));
}

/** Safe view for persistence / logs — never includes signed URLs. */
export function toPersistableMotionTransferInput(
  input: MotionTransferInput,
): unknown {
  return redactMotionTransferInput(input);
}

export function listIdentityFingerprints(input: MotionTransferInput): string[] {
  return input.character.identityReferences
    .map(fingerprintMotionMediaReference)
    .sort();
}

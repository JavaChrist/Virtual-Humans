/**
 * Technical Motion QC — deterministic metadata checks only (MT-009).
 * Does not claim to verify motion fidelity.
 */

import type { MotionTransferProviderOutputDescriptor } from "../types";
import type { MotionTransferOutputConstraints } from "../types";
import type { MotionQcIssue } from "../types";
import type { MotionQcPolicy } from "./policy";
import { deepFreeze } from "../freeze";

export const MOTION_QC_ALLOWED_OUTPUT_MIME = [
  "video/mp4",
  "video/webm",
] as const;

export type MotionQcTechnicalInput = {
  output: MotionTransferProviderOutputDescriptor;
  outputConstraints: MotionTransferOutputConstraints;
  sourceDurationSeconds?: number;
  policy: MotionQcPolicy;
};

export type MotionQcTechnicalResult = {
  status: "pass" | "fail";
  issues: readonly MotionQcIssue[];
};

function issue(
  code: string,
  message: string,
  retryClass: MotionQcIssue["retryClass"] = "nonRetryable",
): MotionQcIssue {
  return {
    code,
    severity: "blocking",
    message,
    layer: "technical",
    requirementClass: "required",
    retryClass,
    reviewIntent: retryClass === "retryable" ? "RETRY_WITH_UPDATED_CONSTRAINTS" : "REJECT",
  };
}

/**
 * Evaluate technical QC on opaque output descriptor + constraints.
 */
export function evaluateMotionTechnicalQc(
  input: MotionQcTechnicalInput,
): Readonly<MotionQcTechnicalResult> {
  const issues: MotionQcIssue[] = [];
  const out = input.output;

  if (!out.providerOutputRef?.trim()) {
    issues.push(issue("technical.output_ref_missing", "Descriptor output incomplet (ref)."));
  } else if (
    /^https?:\/\//i.test(out.providerOutputRef) ||
    /data:/i.test(out.providerOutputRef) ||
    out.providerOutputRef.includes("..")
  ) {
    issues.push(
      issue(
        "technical.output_ref_public",
        "Référence output non opaque / URL publique interdite.",
      ),
    );
  }

  if (
    !(MOTION_QC_ALLOWED_OUTPUT_MIME as readonly string[]).includes(out.mimeType)
  ) {
    issues.push(
      issue("technical.mime_invalid", `MIME non autorisé: ${out.mimeType}`),
    );
  }

  if (out.durationSeconds == null || !(out.durationSeconds > 0)) {
    issues.push(issue("technical.duration_missing", "Durée output absente."));
  } else {
    const expected = input.outputConstraints.durationSeconds;
    if (expected != null && expected > 0) {
      const tol = Math.max(
        input.policy.durationToleranceSeconds,
        expected * input.policy.durationToleranceRatio,
      );
      if (Math.abs(out.durationSeconds - expected) > tol) {
        issues.push(
          issue(
            "technical.duration_mismatch",
            "Durée output hors tolérance policy.",
            "retryable",
          ),
        );
      }
    }
    if (
      input.sourceDurationSeconds != null &&
      input.sourceDurationSeconds > 0
    ) {
      const tol = Math.max(
        input.policy.durationToleranceSeconds,
        input.sourceDurationSeconds * input.policy.durationToleranceRatio,
      );
      if (Math.abs(out.durationSeconds - input.sourceDurationSeconds) > tol) {
        issues.push(
          issue(
            "technical.source_duration_mismatch",
            "Durée source/output hors tolérance.",
            "retryable",
          ),
        );
      }
    }
  }

  if (out.width == null || out.height == null || out.width <= 0 || out.height <= 0) {
    issues.push(issue("technical.dimensions_missing", "Dimensions absentes."));
  }

  if (out.fps == null || out.fps <= 0) {
    issues.push(issue("technical.fps_missing", "fps absent."));
  } else if (
    input.outputConstraints.fps != null &&
    out.fps !== input.outputConstraints.fps
  ) {
    issues.push(
      issue("technical.fps_mismatch", "fps output ≠ contrainte.", "retryable"),
    );
  }

  if (out.sizeBytes == null || out.sizeBytes <= 0) {
    issues.push(issue("technical.size_empty", "Fichier vide ou taille absente."));
  }

  if (!out.providerChecksum?.trim()) {
    issues.push(
      issue("technical.checksum_missing", "Checksum absente.", "retryable"),
    );
  }

  if (!out.completedAt?.trim()) {
    issues.push(issue("technical.completed_at_missing", "completedAt absent."));
  }

  return deepFreeze({
    status: issues.length === 0 ? "pass" : "fail",
    issues,
  });
}

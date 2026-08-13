/**
 * Phase 11A — Human Review comparison card for provider vs composed overlay.
 * Decisions are recorded by a later Auth; retry remains intent-only.
 */

import type { ImageTextOverlaySpec } from "@/domain/production/image-text-overlay";
import type { Phase11ATypographicQcResult } from "./phase-11a-typographic-qc";
import type { ProviderImageTextGateResult } from "./phase-11a-ocr-gate";
import { PHASE_11A_HUMAN_REVIEW_REQUIRED } from "./phase-11a-human-review-gate";

export const PHASE_11A_OVERLAY_REVIEW_DECISIONS = [
  "APPROVE",
  "REJECT",
  "RETRY_WITH_UPDATED_CONSTRAINTS",
  "REQUEST_NEW_REFERENCE",
] as const;

export type Phase11AOverlayReviewDecision = (typeof PHASE_11A_OVERLAY_REVIEW_DECISIONS)[number];

export type Phase11AOverlayReviewCard = {
  humanReviewRequired: true;
  providerAssetId: string;
  composedAssetId: string;
  expectedStrings: string[];
  typographicQc: {
    status: Phase11ATypographicQcResult["status"];
    reasonCodes: string[];
  };
  ocrGate: ProviderImageTextGateResult["status"] | ProviderImageTextGateResult["measure"];
  overlayVersion: string;
  compositorVersion: string;
  providerCostMinorAlreadySettled: number;
  provenance: {
    parentAssetId: string;
    overlayFingerprint: string;
    providerStoragePathRole: "provider" | "legacy_image";
    composedStoragePathRole: "composed";
  };
  autoActive: false;
  retryCreatesJob: false;
  redacted: true;
};

export function buildPhase11AOverlayReviewCard(input: {
  providerAssetId: string;
  composedAssetId: string;
  spec: ImageTextOverlaySpec;
  typographicQc: Phase11ATypographicQcResult;
  ocrGate: ProviderImageTextGateResult;
  overlayFingerprint: string;
  overlayVersion: string;
  compositorVersion: string;
  providerCostMinorAlreadySettled: number;
  providerPathIsLegacyFiveSegment?: boolean;
}): Phase11AOverlayReviewCard {
  if (!PHASE_11A_HUMAN_REVIEW_REQUIRED) {
    throw new Error("Phase 11A overlay review: Human Review flag unexpectedly off.");
  }
  return {
    humanReviewRequired: true,
    providerAssetId: input.providerAssetId,
    composedAssetId: input.composedAssetId,
    expectedStrings: input.typographicQc.expectedStrings,
    typographicQc: {
      status: input.typographicQc.status,
      reasonCodes: input.typographicQc.reasons.map((r) => r.code),
    },
    ocrGate: input.ocrGate.status,
    overlayVersion: input.overlayVersion,
    compositorVersion: input.compositorVersion,
    providerCostMinorAlreadySettled: input.providerCostMinorAlreadySettled,
    provenance: {
      parentAssetId: input.providerAssetId,
      overlayFingerprint: input.overlayFingerprint,
      providerStoragePathRole: input.providerPathIsLegacyFiveSegment ? "legacy_image" : "provider",
      composedStoragePathRole: "composed",
    },
    autoActive: false,
    retryCreatesJob: false,
    redacted: true,
  };
}

export function assertPhase11AOverlayRetryIntentOnly(decision: Phase11AOverlayReviewDecision): void {
  if (decision === "RETRY_WITH_UPDATED_CONSTRAINTS" || decision === "REQUEST_NEW_REFERENCE") {
    return;
  }
  throw new Error("Phase 11A overlay review: expected intent-only retry/reference decision.");
}

export function assertPhase11AOverlayDecisionDoesNotExecute(input: {
  decision: Phase11AOverlayReviewDecision;
  providerCalls: number;
  jobsCreated: number;
  storageWrites: number;
}): void {
  if (input.providerCalls !== 0 || input.jobsCreated !== 0 || input.storageWrites !== 0) {
    throw new Error("Phase 11A overlay review decision must not create provider calls, jobs, or Storage writes.");
  }
}

export function assertPhase11AOverlayPipelineGuards(input: {
  overlayRuntime: string;
  legacyEndpoint: boolean;
  motionReferenced: boolean;
  downstreamRequested: boolean;
  humanReviewPresent: boolean;
  providerCalls: number;
}): void {
  if (input.overlayRuntime !== "WIRED_DISABLED") {
    throw new Error("Phase 11A overlay pipeline must remain WIRED_DISABLED this phase.");
  }
  if (input.legacyEndpoint) {
    throw new Error("Phase 11A overlay: legacy generate endpoint forbidden.");
  }
  if (input.motionReferenced) {
    throw new Error("Phase 11A overlay: Motion reference forbidden.");
  }
  if (input.downstreamRequested) {
    throw new Error("Phase 11A overlay: downstream forbidden.");
  }
  if (!input.humanReviewPresent) {
    throw new Error("Phase 11A overlay: Human Review required.");
  }
  if (input.providerCalls !== 0) {
    throw new Error("Phase 11A overlay: real provider calls forbidden this phase.");
  }
}

/**
 * Delivery / postproduction status on ProductionResult 1.1.0 (VHS-111).
 * Distinct from execution `status` (scenes).
 */

import { ProductionDomainError } from "./errors";

export const DELIVERY_STATUSES = [
  "not_started",
  "quality_review",
  "blocked",
  "merge_ready",
  "merging",
  "merged",
  "export_ready",
  "delivered",
  "failed",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Explicit allowed transitions. Same-state allowed (idempotent). */
export const DELIVERY_TRANSITIONS: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> =
  Object.freeze({
    not_started: ["not_started", "quality_review", "blocked", "merge_ready", "failed"],
    quality_review: ["quality_review", "blocked", "merge_ready", "failed"],
    blocked: ["blocked", "quality_review", "failed"],
    merge_ready: ["merge_ready", "merging", "blocked", "failed"],
    merging: ["merging", "merged", "failed", "blocked"],
    merged: ["merged", "export_ready", "quality_review", "failed"],
    export_ready: ["export_ready", "delivered", "failed", "blocked"],
    delivered: ["delivered"],
    failed: ["failed", "quality_review", "merge_ready"],
  });

export type ProductionDelivery = {
  status: DeliveryStatus;
  updatedAt: string;
  /** Optional refs — never URLs/secrets. */
  mergePlanId?: string;
  finalAssetId?: string;
  exportPackageId?: string;
  qualityReportId?: string;
  humanReviewId?: string;
  blockingCodes?: string[];
};

export function canTransitionDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}

export function assertDeliveryTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  if (!canTransitionDelivery(from, to)) {
    throw new ProductionDomainError(
      "invalid_transition",
      `Transition delivery interdite: ${from} → ${to}.`
    );
  }
}

export function createInitialDelivery(updatedAt: string): ProductionDelivery {
  return Object.freeze({ status: "not_started", updatedAt });
}

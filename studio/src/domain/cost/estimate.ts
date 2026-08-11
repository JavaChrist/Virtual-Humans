import {
  createArtifactMetadata,
  type ArtifactMetadata,
  type DomainId,
} from "@/domain/shared";
import { CostDomainError } from "./errors";
import {
  addMoney,
  compareMoney,
  money,
  multiplyMoney,
  type Money,
} from "./money";

/** Media actions aligned with existing studio capabilities (no provider SDK). */
export const MediaActionSchemaValues = [
  "image",
  "voice",
  "video",
  "lipsync",
  "scene_image",
  "duo_frame",
  "merge",
  "merge_audio",
  "carousel",
  "motion_transfer",
] as const;
export type MediaAction = (typeof MediaActionSchemaValues)[number];

export const EstimationUnitValues = [
  "images",
  "seconds",
  "characters",
  "tokens",
  "minutes",
  "flat",
] as const;
export type EstimationUnit = (typeof EstimationUnitValues)[number];

export const ConfidenceValues = ["exact", "high", "medium", "low", "unknown"] as const;
export type EstimateConfidence = (typeof ConfidenceValues)[number];

/** Current CostEstimate contract version. */
export const COST_ESTIMATE_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Unified cost estimate artifact.
 * Deterministic for identical inputs; no floating-point arithmetic.
 */
export type CostEstimate = ArtifactMetadata & {
  sceneId?: DomainId;
  action: MediaAction;
  modelId?: string;
  providerId?: string;
  quantity: number;
  unit: EstimationUnit;
  unitCost: Money;
  subtotal: Money;
  margin: Money;
  total: Money;
  confidence: EstimateConfidence;
  pricingVersion: string;
  validUntil?: string;
  assumptions: string[];
};

export type BuildCostEstimateInput = {
  id: string;
  projectId: string;
  createdBy: string;
  correlationId: string;
  sceneId?: string;
  action: MediaAction;
  modelId?: string;
  providerId?: string;
  quantity: number;
  unit: EstimationUnit;
  unitCost: Money;
  /** Margin in minor units (same currency). Default 0. */
  margin?: Money;
  confidence: EstimateConfidence;
  pricingVersion: string;
  validUntil?: string;
  assumptions?: string[];
  revision?: number;
  createdAt?: string;
};

function assertMediaAction(action: string): asserts action is MediaAction {
  if (!(MediaActionSchemaValues as readonly string[]).includes(action)) {
    throw new CostDomainError("invalid_estimate", "Unsupported media action.");
  }
}

function assertUnit(unit: string): asserts unit is EstimationUnit {
  if (!(EstimationUnitValues as readonly string[]).includes(unit)) {
    throw new CostDomainError("invalid_unit", "Unsupported estimation unit.");
  }
}

function assertQuantity(quantity: number, unit: EstimationUnit): void {
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || !Number.isInteger(quantity)) {
    throw new CostDomainError("invalid_estimate", "Quantity must be a finite integer.");
  }
  if (quantity < 0) {
    throw new CostDomainError("invalid_estimate", "Quantity cannot be negative.");
  }
  // Flat actions use quantity 1 (or 0 for free no-op estimates).
  if (unit === "flat" && quantity > 1) {
    throw new CostDomainError(
      "invalid_estimate",
      "Flat estimates accept quantity 0 or 1 only.",
    );
  }
}

/**
 * Build and validate a CostEstimate.
 * Ensures subtotal = unitCost × quantity and total = subtotal + margin.
 */
export function buildCostEstimate(input: BuildCostEstimateInput): CostEstimate {
  assertMediaAction(input.action);
  assertUnit(input.unit);
  assertQuantity(input.quantity, input.unit);

  if (!input.pricingVersion || typeof input.pricingVersion !== "string") {
    throw new CostDomainError("invalid_estimate", "pricingVersion is required.");
  }
  if (!(ConfidenceValues as readonly string[]).includes(input.confidence)) {
    throw new CostDomainError("invalid_estimate", "Invalid confidence level.");
  }

  const margin = input.margin ?? money(0, input.unitCost.currency);
  if (margin.currency !== input.unitCost.currency) {
    throw new CostDomainError("currency_mismatch", "Margin currency must match unit cost.");
  }

  const subtotal = multiplyMoney(input.unitCost, input.quantity);
  const total = addMoney(subtotal, margin);

  const meta = createArtifactMetadata({
    id: input.id,
    projectId: input.projectId,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    revision: input.revision,
    schemaVersion: COST_ESTIMATE_SCHEMA_VERSION,
    createdAt: input.createdAt,
  });

  const estimate: CostEstimate = {
    ...meta,
    action: input.action,
    quantity: input.quantity,
    unit: input.unit,
    unitCost: input.unitCost,
    subtotal,
    margin,
    total,
    confidence: input.confidence,
    pricingVersion: input.pricingVersion,
    assumptions: Object.freeze([...(input.assumptions ?? [])]) as string[],
  };

  if (input.sceneId) estimate.sceneId = input.sceneId;
  if (input.modelId) estimate.modelId = input.modelId;
  if (input.providerId) estimate.providerId = input.providerId;
  if (input.validUntil) estimate.validUntil = input.validUntil;

  assertEstimateCoherent(estimate);
  return Object.freeze(estimate);
}

/** Verify arithmetic invariants; throws CostDomainError on mismatch. */
export function assertEstimateCoherent(estimate: CostEstimate): void {
  const expectedSub = multiplyMoney(estimate.unitCost, estimate.quantity);
  if (compareMoney(expectedSub, estimate.subtotal) !== 0) {
    throw new CostDomainError(
      "invalid_estimate",
      "Estimate subtotal is inconsistent with unit cost and quantity.",
    );
  }
  const expectedTotal = addMoney(estimate.subtotal, estimate.margin);
  if (compareMoney(expectedTotal, estimate.total) !== 0) {
    throw new CostDomainError(
      "invalid_estimate",
      "Estimate total is inconsistent with subtotal and margin.",
    );
  }
}

/**
 * When a legacy path cannot produce a price (unknown model), signal explicitly
 * instead of returning a silent zero (unlike lib/pricing.estimateVideo).
 */
export function estimationImpossible(reason: string): never {
  throw new CostDomainError("estimation_impossible", "Unable to estimate cost for this request.", reason);
}

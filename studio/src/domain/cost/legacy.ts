/**
 * Pure adapters between legacy studio pricing (USD floats) and V2 domain contracts.
 * Does NOT import lib/pricing or call providers — caller passes already-computed USD.
 */

import { CostDomainError } from "./errors";
import {
  buildCostEstimate,
  estimationImpossible,
  type CostEstimate,
  type EstimateConfidence,
  type EstimationUnit,
  type MediaAction,
} from "./estimate";
import { addMoney, fromDecimalAmount, money, toDecimalAmount, type Money } from "./money";

/** Pricing catalogue version tag for legacy indicative rates. */
export const LEGACY_PRICING_VERSION = "legacy-pricing-usd-v1";

export type LegacyEstimateType = "image" | "voice" | "video" | "lipsync";

export type LegacyEstimateResponse = {
  type: LegacyEstimateType;
  usd: number;
  currency: "USD";
  credits?: number;
};

const ACTION_UNIT: Record<MediaAction, EstimationUnit> = {
  image: "images",
  voice: "characters",
  video: "seconds",
  lipsync: "seconds",
  scene_image: "images",
  duo_frame: "images",
  merge: "seconds",
  merge_audio: "seconds",
  carousel: "seconds",
  motion_transfer: "seconds",
};

export type FromLegacyUsdInput = {
  id: string;
  projectId: string;
  createdBy: string;
  correlationId: string;
  sceneId?: string;
  action: MediaAction;
  /** Pre-computed USD major units from lib/pricing (caller responsibility). */
  usd: number;
  quantity: number;
  modelId?: string;
  providerId?: string;
  /** When true and usd === 0 with a modelId, treat as estimation failure. */
  rejectZeroWithModel?: boolean;
  confidence?: EstimateConfidence;
  assumptions?: string[];
  marginUsd?: number;
  validUntil?: string;
};

/**
 * Convert a legacy USD float estimate into a canonical CostEstimate.
 * Uses half-up rounding to integer cents (amountMinor).
 *
 * unitCost × quantity + margin = total (integer arithmetic).
 * Any remainder from division is placed in margin.
 */
export function fromLegacyUsdEstimate(input: FromLegacyUsdInput): CostEstimate {
  if (input.rejectZeroWithModel && input.modelId && input.usd === 0) {
    estimationImpossible("legacy estimate returned zero for a known model id");
  }
  if (!Number.isFinite(input.usd) || input.usd < 0) {
    throw new CostDomainError("estimation_impossible", "Legacy USD estimate is invalid.");
  }

  const total = fromDecimalAmount(input.usd, "USD", { decimals: 2, round: "half_up" });
  const qty = input.quantity;
  if (!Number.isInteger(qty) || qty < 0) {
    throw new CostDomainError("invalid_estimate", "Quantity must be a non-negative integer.");
  }

  let unitCost: Money;
  let margin: Money;
  if (qty === 0) {
    unitCost = money(0, "USD");
    margin = total;
  } else {
    const perUnitMinor = Math.floor(total.amountMinor / qty);
    unitCost = money(perUnitMinor, "USD");
    margin = money(total.amountMinor - perUnitMinor * qty, "USD");
  }

  if (input.marginUsd) {
    margin = addMoney(
      margin,
      fromDecimalAmount(input.marginUsd, "USD", { decimals: 2, round: "half_up" }),
    );
  }

  return buildCostEstimate({
    id: input.id,
    projectId: input.projectId,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    sceneId: input.sceneId,
    action: input.action,
    modelId: input.modelId,
    providerId: input.providerId,
    quantity: qty,
    unit: ACTION_UNIT[input.action],
    unitCost,
    margin,
    confidence: input.confidence ?? "medium",
    pricingVersion: LEGACY_PRICING_VERSION,
    validUntil: input.validUntil,
    assumptions: [
      "Converted from legacy USD float estimate (half-up to cents).",
      "Indicative provider list prices; confirm on provider billing.",
      ...(input.assumptions ?? []),
    ],
  });
}

/** Map a domain estimate back to the public /api/estimate JSON shape. */
export function toLegacyEstimateResponse(
  estimate: CostEstimate,
  type: LegacyEstimateType,
  extras?: { credits?: number },
): LegacyEstimateResponse {
  const res: LegacyEstimateResponse = {
    type,
    usd: toDecimalAmount(estimate.total, 2),
    currency: "USD",
  };
  if (extras?.credits != null) res.credits = extras.credits;
  return res;
}

/**
 * Step cost estimation from registry pricing (VHS-108).
 * Integer Money only; no implicit FX; no guessed units.
 */

import {
  addMoney,
  buildCostEstimate,
  money,
  type CostEstimate,
  type MediaAction,
  type Money,
} from "@/domain/cost";
import {
  isPricingValidAt,
  type ModelCapabilities,
  type PricingDefinition,
  type PricingUnit,
} from "@/domain/routing/capabilities";
import { estimateId } from "./deterministic-id";
import { RoutingDomainError } from "./errors";
import type { RoutingPolicy } from "./policy";

export type StepEstimateContext = {
  projectId: string;
  sceneId: string;
  stepId: string;
  action: MediaAction;
  durationSeconds: number;
  /** Dialogue / VO character count when available. */
  characterCount: number;
  at: string;
  correlationId: string;
  createdBy: string;
  createdAt: string;
  role: "primary" | "fallback1" | "fallback2";
  requireFirmPricing: boolean;
  rejectUnknownPricingConfidence: boolean;
};

function ceilPositiveInt(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.ceil(n));
}

function quantityForUnit(
  unit: PricingUnit,
  ctx: StepEstimateContext,
): { quantity: number; estimateUnit: CostEstimate["unit"] } | null {
  switch (unit) {
    case "image":
    case "request":
    case "video":
      return { quantity: 1, estimateUnit: unit === "video" || unit === "request" ? "flat" : "images" };
    case "second":
      return { quantity: ceilPositiveInt(ctx.durationSeconds), estimateUnit: "seconds" };
    case "minute":
      return {
        quantity: ceilPositiveInt(ctx.durationSeconds / 60),
        estimateUnit: "minutes",
      };
    case "character":
      return {
        quantity: Math.max(0, Math.round(ctx.characterCount)),
        estimateUnit: "characters",
      };
    case "thousand_tokens":
      return {
        quantity: ceilPositiveInt(ctx.characterCount / 1000),
        estimateUnit: "tokens",
      };
    case "token":
      return {
        quantity: Math.max(0, Math.round(ctx.characterCount)),
        estimateUnit: "tokens",
      };
    default: {
      const _e: never = unit;
      void _e;
      return null;
    }
  }
}

function pickPricingLine(
  model: ModelCapabilities,
  action: MediaAction,
  at: string,
): PricingDefinition | null {
  const valid = model.pricing.filter((p) => isPricingValidAt(p, at));
  if (valid.length === 0) return null;

  const preferredUnits: PricingUnit[] =
    action === "image"
      ? ["image", "request"]
      : action === "video" || action === "carousel" || action === "motion_transfer"
        ? ["second", "video", "request", "minute"]
        : action === "voice"
          ? ["thousand_tokens", "character", "token", "minute", "request"]
          : action === "lipsync"
            ? ["minute", "second", "request"]
            : ["request"];

  for (const u of preferredUnits) {
    const found = valid
      .filter((p) => p.unit === u)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (found[0]) return found[0];
  }
  // No compatible unit — do not guess
  return null;
}

export type StepCostResult = {
  estimate: CostEstimate;
  pricingEvidence: string[];
};

export function estimateStepCost(
  model: ModelCapabilities,
  ctx: StepEstimateContext,
): StepCostResult {
  const line = pickPricingLine(model, ctx.action, ctx.at);
  if (!line) {
    throw new RoutingDomainError(
      "estimation_failed",
      "No compatible pricing line for step action.",
      `${model.providerId}::${model.modelId}:${ctx.action}`,
    );
  }
  if (ctx.rejectUnknownPricingConfidence && line.confidence === "unknown") {
    throw new RoutingDomainError(
      "estimation_failed",
      "Pricing confidence unknown while firm pricing required.",
    );
  }
  if (ctx.requireFirmPricing && line.confidence === "unknown") {
    // still allow medium/low — unknown only blocked above when flag set
  }

  const qty = quantityForUnit(line.unit, ctx);
  if (!qty) {
    throw new RoutingDomainError("estimation_failed", "Unknown pricing unit.");
  }

  const unitCost = line.unitCost;
  let margin = money(0, unitCost.currency);
  const assumptions = [
    `pricing_id=${line.id}`,
    `pricing_version=${line.pricingVersion}`,
    `source=${line.source}`,
    `confidence=${line.confidence}`,
  ];

  // Apply minimum charge as margin top-up if subtotal below minimum
  const provisional = unitCost.amountMinor * qty.quantity;
  if (line.minimumCharge && provisional < line.minimumCharge.amountMinor) {
    if (line.minimumCharge.currency !== unitCost.currency) {
      throw new RoutingDomainError("estimation_failed", "Minimum charge currency mismatch.");
    }
    margin = money(line.minimumCharge.amountMinor - provisional, unitCost.currency);
    assumptions.push("minimum_charge_applied");
  }

  const estimate = buildCostEstimate({
    id: estimateId({
      stepId: ctx.stepId,
      providerId: model.providerId,
      modelId: model.modelId,
      role: ctx.role,
    }),
    projectId: ctx.projectId,
    createdBy: ctx.createdBy,
    correlationId: ctx.correlationId,
    createdAt: ctx.createdAt,
    sceneId: ctx.sceneId,
    action: ctx.action,
    modelId: model.modelId,
    providerId: model.providerId,
    quantity: qty.quantity,
    unit: qty.estimateUnit,
    unitCost,
    margin,
    confidence:
      line.confidence === "exact"
        ? "exact"
        : line.confidence === "high"
          ? "high"
          : line.confidence === "medium"
            ? "medium"
            : line.confidence === "low"
              ? "low"
              : "unknown",
    pricingVersion: line.pricingVersion,
    validUntil: line.validUntil,
    assumptions,
  });

  return {
    estimate,
    pricingEvidence: [
      `pricing:${line.id}`,
      `unit:${line.unit}`,
      `qty:${qty.quantity}`,
      `source:${line.source}`,
    ],
  };
}

export function sumEstimates(estimates: readonly CostEstimate[]): Money {
  if (estimates.length === 0) {
    throw new RoutingDomainError("incoherent_cost", "Cannot sum empty estimates.");
  }
  let total = money(0, estimates[0]!.total.currency);
  for (const e of estimates) {
    total = addMoney(total, e.total);
  }
  return total;
}

export function assertSameCurrency(amounts: readonly Money[]): void {
  if (amounts.length === 0) return;
  const c = amounts[0]!.currency;
  for (const a of amounts) {
    if (a.currency !== c) {
      throw new RoutingDomainError("estimation_failed", "Currency mismatch in estimates.");
    }
  }
}

export function policyToEstimateFlags(policy: RoutingPolicy): {
  requireFirmPricing: boolean;
  rejectUnknownPricingConfidence: boolean;
} {
  return {
    requireFirmPricing: policy.hardRequirements.requireFirmPricing,
    rejectUnknownPricingConfidence: policy.hardRequirements.rejectUnknownPricingConfidence,
  };
}

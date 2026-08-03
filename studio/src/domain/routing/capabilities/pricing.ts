/**
 * Pricing definitions compatible with Money (VHS-107).
 * No floating-point in domain values — unitCost is Money (minor units).
 */

import type { Money } from "@/domain/cost";

export const PricingUnitValues = [
  "image",
  "second",
  "video",
  "character",
  "token",
  "thousand_tokens",
  "minute",
  "request",
] as const;
export type PricingUnit = (typeof PricingUnitValues)[number];

export const PricingSourceValues = [
  "legacy_catalog",
  "provider_documentation",
  "manual",
  "unknown",
] as const;
export type PricingSource = (typeof PricingSourceValues)[number];

export const PricingConfidenceValues = [
  "exact",
  "high",
  "medium",
  "low",
  "unknown",
] as const;
export type PricingConfidence = (typeof PricingConfidenceValues)[number];

export type PricingCondition = {
  key: string;
  value: string;
};

export type PricingDefinition = {
  id: string;
  unit: PricingUnit;
  unitCost: Money;
  minimumCharge?: Money;
  conditions: PricingCondition[];
  pricingVersion: string;
  validFrom?: string;
  validUntil?: string;
  source: PricingSource;
  confidence: PricingConfidence;
};

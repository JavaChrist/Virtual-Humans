import { z } from "zod";

/**
 * Explicit domain units (V2 / 05_DEVELOPMENT_RULES).
 * Never use bare `number` for money or duration at domain boundaries.
 */

/** Duration in milliseconds (non-negative integer). */
export const DurationMsSchema = z.number().int().nonnegative();
export type DurationMs = z.infer<typeof DurationMsSchema>;

/** Cost in minor currency units (cents), non-negative integer. */
export const CostCentsSchema = z.number().int().nonnegative();
export type CostCents = z.infer<typeof CostCentsSchema>;

/** ISO 4217 currency code (uppercase). */
export const CurrencyCodeSchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, "Currency must be ISO 4217 uppercase (e.g. USD, EUR)");
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** Money amount with explicit currency. */
export const MoneySchema = z.object({
  amountCents: CostCentsSchema,
  currency: CurrencyCodeSchema,
});
export type Money = z.infer<typeof MoneySchema>;

/** UTC instant as ISO 8601 string (offset required, Zod 4). */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/** Convert indicative USD float (legacy studio estimates) to integer cents. */
export function usdToCents(usd: number): CostCents {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error(`usdToCents: invalid USD value ${usd}`);
  }
  return Math.round(usd * 100);
}

/** Convert integer cents to USD float for display (legacy UI). */
export function centsToUsd(cents: CostCents): number {
  return +(cents / 100).toFixed(4);
}

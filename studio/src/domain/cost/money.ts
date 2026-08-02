import { CurrencyCodeSchema, type CurrencyCode } from "@/domain/shared";
import { CostDomainError } from "./errors";

/**
 * Canonical monetary value — integer minor units only (VHS-006 / 05_DEVELOPMENT_RULES).
 * No floating-point arithmetic in the domain.
 */
export type Money = {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
};

const ISO_CURRENCY = /^[A-Z]{3}$/;

function assertSafeNonNegativeInt(n: number, label: string): number {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new CostDomainError("invalid_money", "Invalid monetary amount.", `${label} is not finite`);
  }
  if (!Number.isInteger(n)) {
    throw new CostDomainError(
      "invalid_money",
      "Monetary amounts must be whole minor units.",
      `${label} is not an integer: ${n}`,
    );
  }
  if (n < 0) {
    throw new CostDomainError("invalid_money", "Monetary amounts cannot be negative.", `${label}=${n}`);
  }
  if (n > Number.MAX_SAFE_INTEGER) {
    throw new CostDomainError(
      "integer_overflow",
      "Monetary amount exceeds safe integer range.",
      `${label}=${n}`,
    );
  }
  return n;
}

function normalizeCurrency(currency: string): CurrencyCode {
  const upper = currency.trim().toUpperCase();
  const parsed = CurrencyCodeSchema.safeParse(upper);
  if (!parsed.success || !ISO_CURRENCY.test(upper)) {
    throw new CostDomainError("invalid_money", "Unsupported or invalid currency code.", `currency=${currency}`);
  }
  return parsed.data;
}

/** Create a validated Money value. */
export function money(amountMinor: number, currency: string = "USD"): Money {
  return Object.freeze({
    amountMinor: assertSafeNonNegativeInt(amountMinor, "amountMinor"),
    currency: normalizeCurrency(currency),
  });
}

export function zeroMoney(currency: string = "USD"): Money {
  return money(0, currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CostDomainError(
      "currency_mismatch",
      "Cannot combine amounts in different currencies.",
      `${a.currency} vs ${b.currency}`,
    );
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const sum = a.amountMinor + b.amountMinor;
  if (sum > Number.MAX_SAFE_INTEGER) {
    throw new CostDomainError("integer_overflow", "Addition exceeds safe integer range.");
  }
  return money(sum, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  const diff = a.amountMinor - b.amountMinor;
  if (diff < 0) {
    throw new CostDomainError(
      "invalid_money",
      "Subtraction would produce a negative amount.",
      `${a.amountMinor} - ${b.amountMinor}`,
    );
  }
  return money(diff, a.currency);
}

/** -1 if a < b, 0 if equal, 1 if a > b. Same currency required. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

/**
 * Multiply by a non-negative integer factor (quantity).
 * Factor must be a safe non-negative integer.
 */
export function multiplyMoney(value: Money, factor: number): Money {
  if (typeof factor !== "number" || !Number.isFinite(factor) || !Number.isInteger(factor) || factor < 0) {
    throw new CostDomainError("invalid_money", "Multiplication factor must be a non-negative integer.");
  }
  if (factor === 0 || value.amountMinor === 0) return money(0, value.currency);
  // Overflow guard: value * factor <= MAX_SAFE_INTEGER
  if (value.amountMinor > 0 && factor > Math.floor(Number.MAX_SAFE_INTEGER / value.amountMinor)) {
    throw new CostDomainError("integer_overflow", "Multiplication exceeds safe integer range.");
  }
  return money(value.amountMinor * factor, value.currency);
}

export type DecimalRoundMode = "half_up" | "floor" | "ceil";

/**
 * Convert a decimal major-unit amount (e.g. legacy USD float) to Money.
 * Rounding is explicit — never silent float accumulation in domain ops.
 */
export function fromDecimalAmount(
  amount: number,
  currency: string = "USD",
  options: { decimals?: number; round?: DecimalRoundMode } = {},
): Money {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new CostDomainError("invalid_money", "Decimal amount must be a finite number.");
  }
  if (amount < 0) {
    throw new CostDomainError("invalid_money", "Decimal amount cannot be negative.");
  }
  const decimals = options.decimals ?? 2;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new CostDomainError("invalid_money", "Invalid decimal scale.");
  }
  const scale = 10 ** decimals;
  const scaled = amount * scale;
  const mode = options.round ?? "half_up";
  let minor: number;
  if (mode === "floor") minor = Math.floor(scaled);
  else if (mode === "ceil") minor = Math.ceil(scaled - Number.EPSILON);
  else minor = Math.round(scaled);
  return money(minor, currency);
}

/** Stable display string, e.g. "USD 1.50" (2 decimal places for ISO currencies with 2 minors). */
export function formatMoney(value: Money, options: { decimals?: number } = {}): string {
  const decimals = options.decimals ?? 2;
  const scale = 10 ** decimals;
  const whole = Math.trunc(value.amountMinor / scale);
  const frac = Math.abs(value.amountMinor % scale);
  const fracStr = String(frac).padStart(decimals, "0");
  return `${value.currency} ${whole}.${fracStr}`;
}

/** Legacy bridge: major-unit float for existing UI / vh_spend (display only). */
export function toDecimalAmount(value: Money, decimals: number = 2): number {
  const scale = 10 ** decimals;
  return value.amountMinor / scale;
}

export function isMoney(value: unknown): value is Money {
  if (!value || typeof value !== "object") return false;
  const m = value as Money;
  return (
    typeof m.amountMinor === "number" &&
    Number.isInteger(m.amountMinor) &&
    m.amountMinor >= 0 &&
    m.amountMinor <= Number.MAX_SAFE_INTEGER &&
    typeof m.currency === "string" &&
    CurrencyCodeSchema.safeParse(m.currency).success
  );
}

import { CostDomainError } from "./errors";
import {
  addMoney,
  compareMoney,
  money,
  subtractMoney,
  type Money,
} from "./money";

export type BudgetRejectionReason =
  | "insufficient_funds"
  | "hard_limit_reached"
  | "currency_mismatch"
  | "incoherent_snapshot";

/**
 * Hard budget policy. allowOverage is literally false — no soft overspend.
 */
export type BudgetPolicy = {
  hardLimit: Money;
  warningThreshold?: Money;
  allowOverage: false;
};

export type BudgetSnapshot = {
  limit: Money;
  reserved: Money;
  spent: Money;
  available: Money;
};

export type BudgetDecision =
  | { allowed: true; estimated: Money; availableAfter: Money }
  | {
      allowed: false;
      estimated: Money;
      available: Money;
      reason: BudgetRejectionReason;
    };

export function createBudgetPolicy(
  hardLimit: Money,
  warningThreshold?: Money,
): BudgetPolicy {
  if (warningThreshold) {
    if (warningThreshold.currency !== hardLimit.currency) {
      throw new CostDomainError("currency_mismatch", "Warning threshold currency must match limit.");
    }
    if (compareMoney(warningThreshold, hardLimit) > 0) {
      throw new CostDomainError(
        "incoherent_budget",
        "Warning threshold cannot exceed the hard limit.",
      );
    }
  }
  const policy: BudgetPolicy = { hardLimit, allowOverage: false };
  if (warningThreshold) policy.warningThreshold = warningThreshold;
  return Object.freeze(policy);
}

/**
 * Build a snapshot and enforce:
 *   available = limit - reserved - spent
 *   reserved + spent ≤ limit
 * Incoherence throws — never silently corrected.
 */
export function createBudgetSnapshot(input: {
  limit: Money;
  reserved: Money;
  spent: Money;
}): BudgetSnapshot {
  const { limit, reserved, spent } = input;
  if (reserved.currency !== limit.currency || spent.currency !== limit.currency) {
    throw new CostDomainError("currency_mismatch", "Budget snapshot currencies must match.");
  }

  const committed = addMoney(reserved, spent);
  if (compareMoney(committed, limit) > 0) {
    throw new CostDomainError(
      "incoherent_budget",
      "Reserved and spent amounts exceed the budget limit.",
      `committed=${committed.amountMinor} limit=${limit.amountMinor}`,
    );
  }

  const available = subtractMoney(limit, committed);
  return Object.freeze({ limit, reserved, spent, available });
}

/**
 * Pure decision: can we afford `estimated` against the snapshot?
 * Does not mutate state or persist a reservation.
 */
export function decideBudget(snapshot: BudgetSnapshot, estimated: Money): BudgetDecision {
  // Re-validate snapshot invariants (defensive).
  try {
    createBudgetSnapshot(snapshot);
  } catch (e) {
    if (e instanceof CostDomainError && e.code === "incoherent_budget") {
      return {
        allowed: false,
        estimated,
        available: money(0, snapshot.limit.currency),
        reason: "incoherent_snapshot",
      };
    }
    if (e instanceof CostDomainError && e.code === "currency_mismatch") {
      return {
        allowed: false,
        estimated,
        available: snapshot.available,
        reason: "currency_mismatch",
      };
    }
    throw e;
  }

  if (estimated.currency !== snapshot.limit.currency) {
    return {
      allowed: false,
      estimated,
      available: snapshot.available,
      reason: "currency_mismatch",
    };
  }

  if (compareMoney(estimated, snapshot.available) > 0) {
    const reason: BudgetRejectionReason =
      snapshot.available.amountMinor === 0 ? "hard_limit_reached" : "insufficient_funds";
    return {
      allowed: false,
      estimated,
      available: snapshot.available,
      reason,
    };
  }

  return {
    allowed: true,
    estimated,
    availableAfter: subtractMoney(snapshot.available, estimated),
  };
}

/** True when spent+reserved reached the warning threshold (non-blocking). */
export function isBudgetWarning(policy: BudgetPolicy, snapshot: BudgetSnapshot): boolean {
  if (!policy.warningThreshold) return false;
  if (policy.warningThreshold.currency !== snapshot.limit.currency) return false;
  const committed = addMoney(snapshot.reserved, snapshot.spent);
  return compareMoney(committed, policy.warningThreshold) >= 0;
}

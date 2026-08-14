/**
 * Phase 11B — compare-and-swap workspace hard limit 274¢ → 437¢.
 * Does not reserve, commit, or call a provider.
 */
import { PHASE_11B_WORKSPACE_ID, assertPhase11BI2vFlagsRemainOff } from "./phase-11b-i2v-allowlist";

export const PHASE_11B_BUDGET_HARD_LIMIT_AUTH = "AUTH_11B_I2V_BUDGET_HARD_LIMIT_437" as const;
export const PHASE_11B_HARD_LIMIT_OLD_MINOR = 274 as const;
export const PHASE_11B_HARD_LIMIT_NEW_MINOR = 437 as const;
export const PHASE_11B_COMMITTED_UNCHANGED_MINOR = 249 as const;
export const PHASE_11B_RESERVED_UNCHANGED_MINOR = 0 as const;
export const PHASE_11B_AVAILABLE_AFTER_MINOR = 188 as const;
export const PHASE_11B_FUTURE_RESERVE_MINOR = 168 as const;
export const PHASE_11B_FUTURE_MARGIN_MINOR = 20 as const;
export const PHASE_11B_KLING_ESTIMATE_MINOR = 140 as const;

export type Phase11BBudgetSnapshot = {
  workspaceId: string;
  policyCount: number;
  hardMinor: number;
  committedMinor: number;
  reservedMinor: number;
  activeReservations: number;
  i2vReservations: number;
  openReconciliations: number;
};

export type Phase11BHardLimitMutationPlan = {
  workspaceId: typeof PHASE_11B_WORKSPACE_ID;
  expectedOldHardMinor: typeof PHASE_11B_HARD_LIMIT_OLD_MINOR;
  newHardMinor: typeof PHASE_11B_HARD_LIMIT_NEW_MINOR;
  column: "hard_limit_minor";
  createPolicy: false;
  touchCommitted: false;
  touchReserved: false;
  createReservation: false;
  maxRows: 1;
};

export const PHASE_11B_HARD_LIMIT_MUTATION_PLAN: Phase11BHardLimitMutationPlan = {
  workspaceId: PHASE_11B_WORKSPACE_ID,
  expectedOldHardMinor: PHASE_11B_HARD_LIMIT_OLD_MINOR,
  newHardMinor: PHASE_11B_HARD_LIMIT_NEW_MINOR,
  column: "hard_limit_minor",
  createPolicy: false,
  touchCommitted: false,
  touchReserved: false,
  createReservation: false,
  maxRows: 1,
};

export function redactPhase11BBudgetError(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]");
}

export function assertPhase11BHardLimitRaisePreconditions(snapshot: Phase11BBudgetSnapshot): void {
  if (snapshot.workspaceId !== PHASE_11B_WORKSPACE_ID) {
    throw new Error("Phase 11B budget: workspace is not the allowlisted policy.");
  }
  if (snapshot.policyCount !== 1) {
    throw new Error("Phase 11B budget: expected exactly one workspace policy.");
  }
  if (snapshot.hardMinor !== PHASE_11B_HARD_LIMIT_OLD_MINOR) {
    throw new Error("BLOCKED_I2V_BUDGET_HARD_LIMIT_DIVERGENCE: hard limit is not 274.");
  }
  if (snapshot.committedMinor !== PHASE_11B_COMMITTED_UNCHANGED_MINOR) {
    throw new Error("BLOCKED_I2V_BUDGET_HARD_LIMIT_DIVERGENCE: committed changed.");
  }
  if (snapshot.reservedMinor !== PHASE_11B_RESERVED_UNCHANGED_MINOR || snapshot.activeReservations !== 0) {
    throw new Error("BLOCKED_I2V_BUDGET_HARD_LIMIT_DIVERGENCE: reserved changed.");
  }
  if (snapshot.i2vReservations !== 0) {
    throw new Error("Phase 11B budget: I2V reservation already exists.");
  }
  if (snapshot.openReconciliations !== 0) {
    throw new Error("BLOCKED_I2V_BUDGET_HARD_LIMIT_DIVERGENCE: open reconciliation.");
  }
}

export function availableAfterPhase11BHardLimitRaise(input: {
  hardMinor: number;
  committedMinor: number;
  reservedMinor: number;
}): number {
  return input.hardMinor - input.committedMinor - input.reservedMinor;
}

export function phase11BFutureReserveAfterHardLimit(): {
  estimateMinor: typeof PHASE_11B_KLING_ESTIMATE_MINOR;
  futureReserveMinor: typeof PHASE_11B_FUTURE_RESERVE_MINOR;
  availableAfterRaise: typeof PHASE_11B_AVAILABLE_AFTER_MINOR;
  futureAvailableAfterReserve: typeof PHASE_11B_FUTURE_MARGIN_MINOR;
  reservationCreated: false;
} {
  return {
    estimateMinor: PHASE_11B_KLING_ESTIMATE_MINOR,
    futureReserveMinor: PHASE_11B_FUTURE_RESERVE_MINOR,
    availableAfterRaise: PHASE_11B_AVAILABLE_AFTER_MINOR,
    futureAvailableAfterReserve: PHASE_11B_FUTURE_MARGIN_MINOR,
    reservationCreated: false,
  };
}

export function applyPhase11BHardLimitCompareAndSwap(input: {
  snapshot: Phase11BBudgetSnapshot;
  flags?: Record<string, string | undefined>;
  mutate: (plan: Phase11BHardLimitMutationPlan) => { rowsAffected: number; hardAfter: number };
}): {
  rowsAffected: 1;
  hardBefore: typeof PHASE_11B_HARD_LIMIT_OLD_MINOR;
  hardAfter: typeof PHASE_11B_HARD_LIMIT_NEW_MINOR;
  committedMinor: typeof PHASE_11B_COMMITTED_UNCHANGED_MINOR;
  reservedMinor: typeof PHASE_11B_RESERVED_UNCHANGED_MINOR;
  availableMinor: typeof PHASE_11B_AVAILABLE_AFTER_MINOR;
  reservationsCreated: 0;
  providerCalled: false;
} {
  assertPhase11BI2vFlagsRemainOff(input.flags ?? {});
  assertPhase11BHardLimitRaisePreconditions(input.snapshot);
  const result = input.mutate(PHASE_11B_HARD_LIMIT_MUTATION_PLAN);
  if (result.rowsAffected !== 1) {
    throw new Error("BLOCKED_I2V_BUDGET_HARD_LIMIT_WRITE_UNCERTAIN: expected exactly one row.");
  }
  if (result.hardAfter !== PHASE_11B_HARD_LIMIT_NEW_MINOR) {
    throw new Error("BLOCKED_I2V_BUDGET_HARD_LIMIT_WRITE_UNCERTAIN: hard after write is not 437.");
  }
  const available = availableAfterPhase11BHardLimitRaise({
    hardMinor: result.hardAfter,
    committedMinor: input.snapshot.committedMinor,
    reservedMinor: input.snapshot.reservedMinor,
  });
  if (available !== PHASE_11B_AVAILABLE_AFTER_MINOR) {
    throw new Error("Phase 11B budget: available after raise is not 188.");
  }
  return {
    rowsAffected: 1,
    hardBefore: PHASE_11B_HARD_LIMIT_OLD_MINOR,
    hardAfter: PHASE_11B_HARD_LIMIT_NEW_MINOR,
    committedMinor: PHASE_11B_COMMITTED_UNCHANGED_MINOR,
    reservedMinor: PHASE_11B_RESERVED_UNCHANGED_MINOR,
    availableMinor: PHASE_11B_AVAILABLE_AFTER_MINOR,
    reservationsCreated: 0,
    providerCalled: false,
  };
}

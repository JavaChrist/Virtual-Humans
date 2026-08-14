/**
 * Phase 11B hard-limit raise guards — no provider, no reservation, no live write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_11B_I2V_PAID_FLAG_ENV, PHASE_11B_WORKSPACE_ID } from "../phase-11b-i2v-allowlist";
import {
  PHASE_11B_AVAILABLE_AFTER_MINOR,
  PHASE_11B_BUDGET_HARD_LIMIT_AUTH,
  PHASE_11B_COMMITTED_UNCHANGED_MINOR,
  PHASE_11B_FUTURE_MARGIN_MINOR,
  PHASE_11B_FUTURE_RESERVE_MINOR,
  PHASE_11B_HARD_LIMIT_MUTATION_PLAN,
  PHASE_11B_HARD_LIMIT_NEW_MINOR,
  PHASE_11B_HARD_LIMIT_OLD_MINOR,
  applyPhase11BHardLimitCompareAndSwap,
  assertPhase11BHardLimitRaisePreconditions,
  availableAfterPhase11BHardLimitRaise,
  phase11BFutureReserveAfterHardLimit,
  redactPhase11BBudgetError,
  type Phase11BBudgetSnapshot,
} from "../phase-11b-i2v-budget-hard-limit";

const LIVE: Phase11BBudgetSnapshot = {
  workspaceId: PHASE_11B_WORKSPACE_ID,
  policyCount: 1,
  hardMinor: 274,
  committedMinor: 249,
  reservedMinor: 0,
  activeReservations: 0,
  i2vReservations: 0,
  openReconciliations: 0,
};

test("11B budget — mutation plan targets only hard_limit_minor", () => {
  assert.equal(PHASE_11B_BUDGET_HARD_LIMIT_AUTH, "AUTH_11B_I2V_BUDGET_HARD_LIMIT_437");
  assert.equal(PHASE_11B_HARD_LIMIT_MUTATION_PLAN.workspaceId, PHASE_11B_WORKSPACE_ID);
  assert.equal(PHASE_11B_HARD_LIMIT_MUTATION_PLAN.expectedOldHardMinor, 274);
  assert.equal(PHASE_11B_HARD_LIMIT_MUTATION_PLAN.newHardMinor, 437);
  assert.equal(PHASE_11B_HARD_LIMIT_MUTATION_PLAN.column, "hard_limit_minor");
  assert.equal(PHASE_11B_HARD_LIMIT_MUTATION_PLAN.createPolicy, false);
  assert.equal(PHASE_11B_HARD_LIMIT_MUTATION_PLAN.createReservation, false);
  assert.equal(PHASE_11B_HARD_LIMIT_MUTATION_PLAN.maxRows, 1);
});

test("11B budget — compare-and-swap succeeds once and keeps ledger unchanged", () => {
  let writes = 0;
  const applied = applyPhase11BHardLimitCompareAndSwap({
    snapshot: LIVE,
    flags: {},
    mutate: (plan) => {
      writes += 1;
      assert.equal(plan.expectedOldHardMinor, PHASE_11B_HARD_LIMIT_OLD_MINOR);
      assert.equal(plan.newHardMinor, PHASE_11B_HARD_LIMIT_NEW_MINOR);
      return { rowsAffected: 1, hardAfter: 437 };
    },
  });
  assert.equal(writes, 1);
  assert.equal(applied.rowsAffected, 1);
  assert.equal(applied.hardBefore, 274);
  assert.equal(applied.hardAfter, 437);
  assert.equal(applied.committedMinor, PHASE_11B_COMMITTED_UNCHANGED_MINOR);
  assert.equal(applied.reservedMinor, 0);
  assert.equal(applied.availableMinor, PHASE_11B_AVAILABLE_AFTER_MINOR);
  assert.equal(applied.reservationsCreated, 0);
  assert.equal(applied.providerCalled, false);
});

test("11B budget — refuses hard/committed/reserved divergence", () => {
  assert.throws(
    () => assertPhase11BHardLimitRaisePreconditions({ ...LIVE, hardMinor: 275 }),
    /DIVERGENCE/,
  );
  assert.throws(
    () => assertPhase11BHardLimitRaisePreconditions({ ...LIVE, committedMinor: 250 }),
    /DIVERGENCE/,
  );
  assert.throws(
    () => assertPhase11BHardLimitRaisePreconditions({ ...LIVE, reservedMinor: 1 }),
    /DIVERGENCE/,
  );
  assert.throws(
    () => applyPhase11BHardLimitCompareAndSwap({
      snapshot: LIVE,
      mutate: () => ({ rowsAffected: 0, hardAfter: 274 }),
    }),
    /UNCERTAIN/,
  );
  assert.throws(
    () => applyPhase11BHardLimitCompareAndSwap({
      snapshot: LIVE,
      mutate: () => ({ rowsAffected: 2, hardAfter: 437 }),
    }),
    /UNCERTAIN/,
  );
});

test("11B budget — available 188 and future reserve 168 stay uncreated", () => {
  assert.equal(
    availableAfterPhase11BHardLimitRaise({ hardMinor: 437, committedMinor: 249, reservedMinor: 0 }),
    188,
  );
  const future = phase11BFutureReserveAfterHardLimit();
  assert.equal(future.estimateMinor, 140);
  assert.equal(future.futureReserveMinor, PHASE_11B_FUTURE_RESERVE_MINOR);
  assert.equal(future.futureAvailableAfterReserve, PHASE_11B_FUTURE_MARGIN_MINOR);
  assert.equal(future.reservationCreated, false);
});

test("11B budget — flags OFF and errors redacted", () => {
  assert.throws(
    () =>
      applyPhase11BHardLimitCompareAndSwap({
        snapshot: LIVE,
        flags: { [PHASE_11B_I2V_PAID_FLAG_ENV]: "1" },
        mutate: () => ({ rowsAffected: 1, hardAfter: 437 }),
      }),
    /OFF/,
  );
  assert.match(
    redactPhase11BBudgetError("failed https://db.example/x?token=supersecrettokenvalue"),
    /\[redacted-url\]/,
  );
});

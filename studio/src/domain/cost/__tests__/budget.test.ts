import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createBudgetPolicy,
  createBudgetSnapshot,
  decideBudget,
} from "../budget";
import { CostDomainError } from "../errors";
import { money } from "../money";

test("available budget with no reservation or spend", () => {
  const snap = createBudgetSnapshot({
    limit: money(1000, "USD"),
    reserved: money(0, "USD"),
    spent: money(0, "USD"),
  });
  assert.equal(snap.available.amountMinor, 1000);
  const decision = decideBudget(snap, money(250, "USD"));
  assert.equal(decision.allowed, true);
  if (decision.allowed) assert.equal(decision.availableAfter.amountMinor, 750);
});

test("existing reservation and spend reduce availability", () => {
  const snap = createBudgetSnapshot({
    limit: money(1000, "USD"),
    reserved: money(200, "USD"),
    spent: money(300, "USD"),
  });
  assert.equal(snap.available.amountMinor, 500);
});

test("exact limit is allowed", () => {
  const snap = createBudgetSnapshot({
    limit: money(100, "USD"),
    reserved: money(0, "USD"),
    spent: money(0, "USD"),
  });
  const decision = decideBudget(snap, money(100, "USD"));
  assert.equal(decision.allowed, true);
  if (decision.allowed) assert.equal(decision.availableAfter.amountMinor, 0);
});

test("one cent over available is rejected", () => {
  const snap = createBudgetSnapshot({
    limit: money(100, "USD"),
    reserved: money(0, "USD"),
    spent: money(50, "USD"),
  });
  const decision = decideBudget(snap, money(51, "USD"));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) {
    assert.equal(decision.reason, "insufficient_funds");
    assert.equal(decision.available.amountMinor, 50);
  }
});

test("currency mismatch is rejected", () => {
  const snap = createBudgetSnapshot({
    limit: money(100, "USD"),
    reserved: money(0, "USD"),
    spent: money(0, "USD"),
  });
  const decision = decideBudget(snap, money(10, "EUR"));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, "currency_mismatch");
});

test("incoherent snapshot throws and is never silently fixed", () => {
  assert.throws(
    () =>
      createBudgetSnapshot({
        limit: money(100, "USD"),
        reserved: money(80, "USD"),
        spent: money(30, "USD"),
      }),
    CostDomainError,
  );
});

test("createBudgetPolicy rejects warning above hard limit", () => {
  assert.throws(
    () => createBudgetPolicy(money(100, "USD"), money(200, "USD")),
    CostDomainError,
  );
});

test("hard limit reached when available is zero", () => {
  const snap = createBudgetSnapshot({
    limit: money(50, "USD"),
    reserved: money(20, "USD"),
    spent: money(30, "USD"),
  });
  const decision = decideBudget(snap, money(1, "USD"));
  assert.equal(decision.allowed, false);
  if (!decision.allowed) assert.equal(decision.reason, "hard_limit_reached");
});

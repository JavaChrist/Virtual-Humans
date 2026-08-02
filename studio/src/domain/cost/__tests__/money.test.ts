import assert from "node:assert/strict";
import { test } from "node:test";
import { CostDomainError } from "../errors";
import {
  addMoney,
  compareMoney,
  formatMoney,
  fromDecimalAmount,
  money,
  multiplyMoney,
  subtractMoney,
  toDecimalAmount,
} from "../money";

test("money() creates a valid amount", () => {
  const m = money(150, "usd");
  assert.equal(m.amountMinor, 150);
  assert.equal(m.currency, "USD");
});

test("money() rejects floats, negatives, NaN, Infinity", () => {
  assert.throws(() => money(1.5, "USD"), CostDomainError);
  assert.throws(() => money(-1, "USD"), CostDomainError);
  assert.throws(() => money(NaN, "USD"), CostDomainError);
  assert.throws(() => money(Infinity, "USD"), CostDomainError);
});

test("money() rejects above MAX_SAFE_INTEGER", () => {
  assert.throws(() => money(Number.MAX_SAFE_INTEGER + 1, "USD"), CostDomainError);
});

test("addMoney and subtractMoney", () => {
  const a = money(100, "USD");
  const b = money(40, "USD");
  assert.equal(addMoney(a, b).amountMinor, 140);
  assert.equal(subtractMoney(a, b).amountMinor, 60);
  assert.throws(() => subtractMoney(b, a), CostDomainError);
});

test("addMoney rejects currency mismatch and overflow", () => {
  assert.throws(() => addMoney(money(1, "USD"), money(1, "EUR")), CostDomainError);
  assert.throws(() => addMoney(money(Number.MAX_SAFE_INTEGER, "USD"), money(1, "USD")), CostDomainError);
});

test("multiplyMoney and compareMoney", () => {
  assert.equal(multiplyMoney(money(25, "USD"), 4).amountMinor, 100);
  assert.equal(compareMoney(money(1, "USD"), money(2, "USD")), -1);
  assert.equal(compareMoney(money(2, "USD"), money(2, "USD")), 0);
  assert.throws(() => multiplyMoney(money(1, "USD"), 1.5), CostDomainError);
  assert.throws(
    () => multiplyMoney(money(Number.MAX_SAFE_INTEGER, "USD"), 2),
    CostDomainError,
  );
});

test("fromDecimalAmount rounds explicitly", () => {
  assert.equal(fromDecimalAmount(0.011, "USD", { round: "half_up" }).amountMinor, 1);
  assert.equal(fromDecimalAmount(0.015, "USD", { round: "half_up" }).amountMinor, 2);
  assert.equal(fromDecimalAmount(1.5, "USD").amountMinor, 150);
  assert.throws(() => fromDecimalAmount(-0.01, "USD"), CostDomainError);
  assert.throws(() => fromDecimalAmount(NaN, "USD"), CostDomainError);
});

test("formatMoney is stable", () => {
  assert.equal(formatMoney(money(150, "USD")), "USD 1.50");
  assert.equal(formatMoney(money(5, "USD")), "USD 0.05");
  assert.equal(formatMoney(money(0, "USD")), "USD 0.00");
  assert.equal(toDecimalAmount(money(28, "USD"), 2), 0.28);
});

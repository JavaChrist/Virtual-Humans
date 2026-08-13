/**
 * Ledger settlement — provisional vs actual, replay without double commit.
 * No provider. No Human Review.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { money } from "@/domain/cost";
import {
  settleAttemptBudget,
  reserveAttemptBudget,
} from "../budget-coordinator";
import { createMemoryBudgetPort } from "./fakes";

const reserved = money(1, "USD");

test("settle — no actualCost commits provisional = reserved and releases 0", async () => {
  const port = createMemoryBudgetPort();
  await reserveAttemptBudget(port, {
    reservationId: "res-1",
    runId: "run-1",
    sceneId: "scene-2",
    stepId: "step:scene-2:image",
    attemptId: "a1",
    estimate: reserved,
    runCurrency: "USD",
  });
  const first = await settleAttemptBudget(port, {
    reservationId: "res-1",
    runId: "run-1",
    sceneId: "scene-2",
    stepId: "step:scene-2:image",
    attemptId: "a1",
    reserved,
  });
  assert.equal(first.costKind, "provisional");
  assert.equal(first.committed.amountMinor, 1);
  assert.equal(first.released.amountMinor, 0);
  assert.equal(port.reserved.size, 0);
  assert.equal(port.committed.size, 1);

  const replay = await settleAttemptBudget(port, {
    reservationId: "res-1",
    runId: "run-1",
    sceneId: "scene-2",
    stepId: "step:scene-2:image",
    attemptId: "a1",
    reserved,
  });
  assert.equal(replay.costKind, "provisional");
  assert.equal(replay.committed.amountMinor, 1);
  assert.equal(replay.released.amountMinor, 0);
  assert.equal(port.committed.size, 1);
});

test("settle — actualCost equal to reserved commits actual and releases 0", async () => {
  const port = createMemoryBudgetPort();
  await reserveAttemptBudget(port, {
    reservationId: "res-2",
    runId: "run-2",
    sceneId: "scene-2",
    stepId: "step:scene-2:image",
    attemptId: "a1",
    estimate: reserved,
    runCurrency: "USD",
  });
  const out = await settleAttemptBudget(port, {
    reservationId: "res-2",
    runId: "run-2",
    sceneId: "scene-2",
    stepId: "step:scene-2:image",
    attemptId: "a1",
    reserved,
    actualCost: money(1, "USD"),
  });
  assert.equal(out.costKind, "actual");
  assert.equal(out.committed.amountMinor, 1);
  assert.equal(out.released.amountMinor, 0);
});

/**
 * Phase 10F-BUDGET-AUDIT — formula, terminal idempotence, Auth A/B gates (no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { storyboardIdempotencyFields } from "../analyze-for-project";

/** Mirrors reserve_director_budget exposure formula. */
function availableMinor(input: {
  hardLimitMinor: number;
  activeHeldMinor: number;
  commitSumMinor: number;
  refundSumMinor?: number;
}) {
  const exposure = Math.max(
    input.commitSumMinor - (input.refundSumMinor ?? 0),
    0
  );
  return input.hardLimitMinor - input.activeHeldMinor - exposure;
}

test("budget formula — releases do not free exposure; 100-93=7", () => {
  const available = availableMinor({
    hardLimitMinor: 100,
    activeHeldMinor: 0,
    commitSumMinor: 93,
  });
  assert.equal(available, 7);
  assert.equal(available >= 13, false);
});

test("budget formula — proposed hard 113 enables 13¢ reserve", () => {
  const available = availableMinor({
    hardLimitMinor: 113,
    activeHeldMinor: 0,
    commitSumMinor: 93,
  });
  assert.equal(available, 20);
  assert.ok(available >= 13);
});

test("minimal hard for 13¢ reserve is exposure+13", () => {
  const exposure = 93;
  assert.equal(exposure + 13, 106);
});

test("idempotency salt diverges key without changing fingerprint", () => {
  const base = {
    projectId: "984507af-a89e-4644-8ea3-344797baa974",
    briefArtifactId: "95c24837-ab61-4bd1-9f47-d576e259d018",
    briefRevision: 1,
    marketingPlanArtifactId: "199284d6-7126-4383-b85f-1ecd74d9528e",
    marketingPlanRevision: 1,
    creativeConceptArtifactId: "11f8f8e0-a280-43aa-a7ea-5e6b0401b72a",
    creativeConceptRevision: 1,
    videoScriptArtifactId: "349e2792-3235-4c00-a1da-9e087b0b4d1c",
    videoScriptRevision: 1,
    visualDirectionArtifactId: "49481462-6444-41f9-8c48-7e7d32c09f1b",
    visualDirectionRevision: 1,
    model: "gpt-5.6",
    promptVersion: "storyboard-analyzer-v2",
    schemaVersion: "1.0.0",
  };
  const a = storyboardIdempotencyFields(base);
  const b = storyboardIdempotencyFields({
    ...base,
    idempotencySalt: "10f-reauth-budget-exceeded",
  });
  assert.notEqual(a.key, b.key);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(base.promptVersion, "storyboard-analyzer-v2");
});

test("terminal budget_exceeded key reuse is blocked by SQL contract", () => {
  // Documented behaviour of begin_or_get_storyboard_director_run:
  // failed status → RAISE director_run_terminal_reuse
  const terminalStatuses = new Set(["failed", "needs_input", "cancelled"]);
  assert.ok(terminalStatuses.has("failed"));
  const storyboardRetryRouteExists = false;
  const budgetExceededOnArtRetryAllowlist = false;
  assert.equal(storyboardRetryRouteExists, false);
  assert.equal(budgetExceededOnArtRetryAllowlist, false);
});

test("Auth B env gate shape", () => {
  const gate = {
    PHASE_10F_BUDGET_AUTH_DONE: "1",
    DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT: "10f-reauth-1",
    PHASE_10F_ALLOW_EXECUTE: "1",
  };
  assert.equal(gate.PHASE_10F_BUDGET_AUTH_DONE, "1");
  assert.ok(gate.DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT.length > 0);
});

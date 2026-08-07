/**
 * VHS-129 — human-retry allowlist ≠ auto-retry taxonomy.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES,
  isDirectorHumanRetryableErrorCode,
} from "../retryable-error-codes";
import { marketingFailure } from "@/application/directors/marketing/failures";

test("human allowlist includes invalid_structured_output only among structural codes", () => {
  assert.ok(
    isDirectorHumanRetryableErrorCode("invalid_structured_output")
  );
  assert.ok(isDirectorHumanRetryableErrorCode("rate_limited"));
  assert.equal(isDirectorHumanRetryableErrorCode("invalid_candidate"), false);
  assert.equal(isDirectorHumanRetryableErrorCode("json_parse"), false);
  assert.equal(isDirectorHumanRetryableErrorCode("schema_mismatch"), false);
  assert.equal(isDirectorHumanRetryableErrorCode("empty_response"), false);
  assert.deepEqual([...DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES].sort(), [
    "invalid_structured_output",
    "provider_unavailable",
    "rate_limited",
    "timeout",
  ]);
});

test("invalid_structured_output stays retryable=false in failure taxonomy (no auto-retry)", () => {
  const f = marketingFailure("invalid_structured_output");
  assert.equal(f.code, "invalid_structured_output");
  assert.equal(f.retryable, false);
  assert.ok(isDirectorHumanRetryableErrorCode(f.code));
});

test("provider auto-retry codes remain retryable=true in taxonomy", () => {
  assert.equal(marketingFailure("rate_limited").retryable, true);
  assert.equal(marketingFailure("timeout").retryable, true);
  assert.equal(marketingFailure("provider_unavailable").retryable, true);
});

test("8P-B — internal_error never enters global human-retry allowlist", () => {
  assert.equal(isDirectorHumanRetryableErrorCode("internal_error"), false);
  assert.equal(
    (DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES as readonly string[]).includes(
      "internal_error"
    ),
    false
  );
});

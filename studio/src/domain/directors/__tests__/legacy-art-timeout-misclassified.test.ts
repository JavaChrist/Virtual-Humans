/**
 * Porte 8P-B — narrow legacy Art timeout misclassification gate.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES,
  isDirectorHumanRetryableErrorCode,
} from "../retryable-error-codes";
import {
  isArtHumanRetryEligible,
  isLegacyArtTimeoutMisclassified,
  LEGACY_ART_TIMEOUT_DURATION_MS_MAX,
  LEGACY_ART_TIMEOUT_DURATION_MS_MIN,
  LEGACY_ART_TIMEOUT_RETRY_REASON,
  type LegacyArtTimeoutMisclassifiedRun,
} from "../legacy-art-timeout-misclassified";

const CREATED = "2026-08-07T18:54:56.000Z";
const COMPLETED_60S = "2026-08-07T18:55:56.000Z";

function baseArtLegacy(
  overrides: Partial<LegacyArtTimeoutMisclassifiedRun> = {}
): LegacyArtTimeoutMisclassifiedRun {
  return {
    directorType: "art",
    status: "failed",
    errorCode: "internal_error",
    usage: null,
    actualCostMinor: null,
    costStatus: "released",
    outputArtifactId: null,
    createdAt: CREATED,
    completedAt: COMPLETED_60S,
    ...overrides,
  };
}

test("8P-B — pattern legacy Art ~60s → retry humain autorisé", () => {
  assert.equal(isLegacyArtTimeoutMisclassified(baseArtLegacy()), true);
  assert.equal(
    isArtHumanRetryEligible({
      errorCode: "internal_error",
      legacyTimeoutMisclassified: true,
    }),
    true
  );
  assert.equal(LEGACY_ART_TIMEOUT_RETRY_REASON, "misclassified_timeout");
  assert.ok(
    Date.parse(COMPLETED_60S) - Date.parse(CREATED) >= LEGACY_ART_TIMEOUT_DURATION_MS_MIN
  );
  assert.ok(
    Date.parse(COMPLETED_60S) - Date.parse(CREATED) <= LEGACY_ART_TIMEOUT_DURATION_MS_MAX
  );
});

test("8P-B — Art internal_error rapide → retry refusé", () => {
  assert.equal(
    isLegacyArtTimeoutMisclassified(
      baseArtLegacy({ completedAt: "2026-08-07T18:55:01.000Z" })
    ),
    false
  );
});

test("8P-B — Art internal_error avec usage présent → refusé", () => {
  assert.equal(
    isLegacyArtTimeoutMisclassified(
      baseArtLegacy({ usage: { inputTokens: 10 } })
    ),
    false
  );
});

test("8P-B — Art internal_error avec coût committé → refusé", () => {
  assert.equal(
    isLegacyArtTimeoutMisclassified(
      baseArtLegacy({ actualCostMinor: 13, costStatus: "committed" })
    ),
    false
  );
  assert.equal(
    isLegacyArtTimeoutMisclassified(
      baseArtLegacy({ costStatus: "committed", actualCostMinor: null })
    ),
    false
  );
});

test("8P-B — Art with output artifact → refusé", () => {
  assert.equal(
    isLegacyArtTimeoutMisclassified(
      baseArtLegacy({ outputArtifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
    ),
    false
  );
});

test("8P-B — internal_error Marketing/Creative/Script → refusé (legacy Art only)", () => {
  for (const directorType of ["marketing", "creative", "script", "storyboard"]) {
    assert.equal(
      isLegacyArtTimeoutMisclassified(baseArtLegacy({ directorType })),
      false,
      directorType
    );
  }
});

test("8P-B — internal_error reste hors allowlist globale", () => {
  assert.equal(isDirectorHumanRetryableErrorCode("internal_error"), false);
  assert.equal(
    (DIRECTOR_HUMAN_RETRYABLE_ERROR_CODES as readonly string[]).includes(
      "internal_error"
    ),
    false
  );
  assert.equal(
    isArtHumanRetryEligible({ errorCode: "internal_error" }),
    false
  );
});

test("8P-B — vrai timeout nouveau → retry normal (allowlist)", () => {
  assert.equal(isDirectorHumanRetryableErrorCode("timeout"), true);
  assert.equal(isArtHumanRetryEligible({ errorCode: "timeout" }), true);
  // A correctly classified timeout is NOT the legacy misclassification pattern.
  assert.equal(
    isLegacyArtTimeoutMisclassified(baseArtLegacy({ errorCode: "timeout" })),
    false
  );
});

test("8P-B — durée hors fenêtre haute → refusé", () => {
  assert.equal(
    isLegacyArtTimeoutMisclassified(
      baseArtLegacy({ completedAt: "2026-08-07T18:57:00.000Z" })
    ),
    false
  );
});

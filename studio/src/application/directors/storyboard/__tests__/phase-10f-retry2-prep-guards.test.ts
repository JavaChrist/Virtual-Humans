/**
 * Phase 10F-RETRY2-PREP — local guards (no provider / no ledger / no remote).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { storyboardIdempotencyFields } from "../analyze-for-project";
import { inspectStoryboardStructuredSchemaProjection } from "@/infrastructure/ai/openai/storyboard/schema-projection";

const PROJECT_ID = "984507af-a89e-4644-8ea3-344797baa974";
const BASE = {
  projectId: PROJECT_ID,
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
} as const;

const BURNED_SALT = "10f-auth-b-20260810";
const PROPOSED_SALT = "10f-auth-b-retry2-20260810";
const FP_NONE = "abaa9c2886ef3d59";
const FP_AUTH_B = "3f39f808e266649c";

function keyFp(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

test("RETRY2 proposed salt yields third distinct key fingerprint", () => {
  const none = storyboardIdempotencyFields(BASE);
  const authB = storyboardIdempotencyFields({
    ...BASE,
    idempotencySalt: BURNED_SALT,
  });
  const retry2 = storyboardIdempotencyFields({
    ...BASE,
    idempotencySalt: PROPOSED_SALT,
  });
  const fpNone = keyFp(none.key);
  const fpAuthB = keyFp(authB.key);
  const fpRetry2 = keyFp(retry2.key);
  assert.equal(fpNone, FP_NONE);
  assert.equal(fpAuthB, FP_AUTH_B);
  assert.notEqual(fpRetry2, fpNone);
  assert.notEqual(fpRetry2, fpAuthB);
  assert.notEqual(PROPOSED_SALT, BURNED_SALT);
  assert.equal(none.fingerprint, retry2.fingerprint);
  assert.equal(BASE.promptVersion, "storyboard-analyzer-v2");
  assert.equal(BASE.schemaVersion, "1.0.0");
});

test("future run contract: attempt 1 / retry_of null / no prompt bump", () => {
  const future = {
    attempt_number: 1,
    retry_of_run_id: null as string | null,
    prompt: "storyboard-analyzer-v2",
    schemas: "1.0.0 / 1.0.0",
    maximumFutureCalls: 1,
    retryBlocked: true,
    fallbackBlocked: true,
    upstreamReplayBlocked: true,
    mediaBlocked: true,
    workerBlocked: true,
  };
  assert.equal(future.attempt_number, 1);
  assert.equal(future.retry_of_run_id, null);
  assert.equal(future.prompt, "storyboard-analyzer-v2");
  assert.equal(future.maximumFutureCalls, 1);
});

test("schema projection gate ready for dry-run live", () => {
  const report = inspectStoryboardStructuredSchemaProjection();
  assert.equal(report.structuredSchemaOneOfCount, 0);
  assert.equal(report.structuredSchemaProjection, "anyOf-compatible");
});

test("budget envelope for future execute (documented, no write)", () => {
  const envelope = {
    hardLimitMinor: 113,
    committedMinor: 93,
    reservedMinor: 0,
    availableMinor: 20,
    estimateMinor: 13,
    reservationEqualsEstimate: true,
    maximumFutureCalls: 1,
  };
  assert.ok(envelope.availableMinor >= envelope.estimateMinor);
  assert.equal(envelope.reservationEqualsEstimate, true);
  assert.equal(envelope.maximumFutureCalls, 1);
});

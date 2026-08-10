import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAIAiError } from "../../errors";
import {
  assertStoryboardProviderFailureEvidenceSafe,
  buildStoryboardProviderFailureEvidence,
  inferStoryboardFailureStage,
} from "../provider-failure-evidence";

test("buildStoryboardProviderFailureEvidence captures redacted HTTP/code/request-id/stage", () => {
  const err = new OpenAIAiError("structured_output_unsupported", {
    httpStatus: 400,
    internalCode: "invalid_json_schema",
    providerObs: {
      providerErrorCode: "invalid_json_schema",
      providerErrorType: "invalid_request_error",
      providerRequestId: "req_abc-123",
    },
  });
  const evidence = buildStoryboardProviderFailureEvidence({
    stage: inferStoryboardFailureStage(err, 1),
    vhsFailureCode: "request_failed",
    openaiErr: err,
    durationMs: 1310,
    networkAttempts: 1,
    usagePresent: false,
  });
  assert.equal(evidence.stage, "provider_response");
  assert.equal(evidence.httpStatus, 400);
  assert.equal(evidence.providerErrorCode, "invalid_json_schema");
  assert.equal(evidence.providerErrorType, "invalid_request_error");
  assert.equal(evidence.providerRequestId, "req_abc-123");
  assert.equal(evidence.networkAttempts, 1);
  assert.equal(evidence.usagePresent, false);
  assert.equal(evidence.durationMs, 1310);
});

test("redaction strips secret-like blobs from evidence", () => {
  const dirty = assertStoryboardProviderFailureEvidenceSafe({
    stage: "provider_response",
    vhsFailureCode: "request_failed",
    providerErrorCode: "sk-abcdefghijklmnopqrstuvwxyz0123456789",
    durationMs: 10,
    networkAttempts: 1,
    usagePresent: false,
  });
  assert.equal(dirty.providerErrorCode, undefined);
  assert.equal(dirty.internalCode, "redacted");
  const blob = JSON.stringify(dirty);
  assert.equal(/sk-[A-Za-z0-9]{10,}/.test(blob), false);
});

test("request_build when flags block before network", () => {
  const err = new OpenAIAiError("storyboard_ai_disabled");
  assert.equal(inferStoryboardFailureStage(err, 0), "request_build");
});

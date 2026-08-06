import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getE2eRequestContext,
  parseE2eFakeFailHeader,
  runWithE2eRequestContext,
} from "../e2e-request-context";

test("parseE2eFakeFailHeader — creative modes", () => {
  assert.deepEqual(parseE2eFakeFailHeader("creative:incomplete"), {
    creativeFail: "incomplete",
  });
  assert.deepEqual(parseE2eFakeFailHeader("creative:refused"), {
    creativeFail: "refused",
  });
  assert.deepEqual(parseE2eFakeFailHeader("creative:invalid_candidate"), {
    creativeFail: "invalid_candidate",
  });
  assert.deepEqual(parseE2eFakeFailHeader("creative"), {
    creativeFail: "provider_failed",
  });
  assert.deepEqual(parseE2eFakeFailHeader("marketing"), {});
  assert.deepEqual(parseE2eFakeFailHeader(""), {});
});

test("runWithE2eRequestContext isolates AsyncLocalStorage", async () => {
  assert.deepEqual(getE2eRequestContext(), {});
  await runWithE2eRequestContext({ creativeFail: "incomplete" }, async () => {
    assert.equal(getE2eRequestContext().creativeFail, "incomplete");
  });
  assert.deepEqual(getE2eRequestContext(), {});
});

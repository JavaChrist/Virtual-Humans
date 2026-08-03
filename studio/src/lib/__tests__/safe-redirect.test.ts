import assert from "node:assert/strict";
import { test } from "node:test";
import { safeInternalPath } from "../safe-redirect";

test("accepts internal relative paths", () => {
  assert.equal(safeInternalPath("/director"), "/director");
  assert.equal(safeInternalPath("/director?x=1"), "/director?x=1");
});

test("rejects open redirects", () => {
  assert.equal(safeInternalPath("//evil.com"), "/");
  assert.equal(safeInternalPath("https://evil.com"), "/");
  assert.equal(safeInternalPath("/\\evil"), "/");
  assert.equal(safeInternalPath("/http://evil.com"), "/");
  assert.equal(safeInternalPath(null), "/");
});

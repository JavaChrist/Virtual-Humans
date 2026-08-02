import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDirectorV2Enabled } from "../feature-flags";

test("flag absent / empty / 0 / false → disabled", () => {
  assert.equal(parseDirectorV2Enabled(undefined), false);
  assert.equal(parseDirectorV2Enabled(null), false);
  assert.equal(parseDirectorV2Enabled(""), false);
  assert.equal(parseDirectorV2Enabled("  "), false);
  assert.equal(parseDirectorV2Enabled("0"), false);
  assert.equal(parseDirectorV2Enabled("false"), false);
  assert.equal(parseDirectorV2Enabled("FALSE"), false);
  assert.equal(parseDirectorV2Enabled("no"), false);
  assert.equal(parseDirectorV2Enabled("yes"), false);
});

test("flag 1 / true (case + spaces) → enabled", () => {
  assert.equal(parseDirectorV2Enabled("1"), true);
  assert.equal(parseDirectorV2Enabled(" true "), true);
  assert.equal(parseDirectorV2Enabled("TRUE"), true);
  assert.equal(parseDirectorV2Enabled("True"), true);
});

test("flag never enabled accidentally by truthy junk", () => {
  assert.equal(parseDirectorV2Enabled("enabled"), false);
  assert.equal(parseDirectorV2Enabled("on"), false);
  assert.equal(parseDirectorV2Enabled("2"), false);
});

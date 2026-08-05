import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDirectorDateTime } from "../format-director-datetime";

test("formatDirectorDateTime is deterministic for a fixed ISO instant", () => {
  const a = formatDirectorDateTime("2026-08-05T09:16:41.672Z");
  const b = formatDirectorDateTime("2026-08-05T09:16:41.672Z");
  assert.equal(a, b);
  assert.match(a, /2026/);
  assert.match(a, /09/);
  assert.match(a, / UTC$/);
});

test("formatDirectorDateTime returns raw string for invalid date", () => {
  assert.equal(formatDirectorDateTime("not-a-date"), "not-a-date");
});

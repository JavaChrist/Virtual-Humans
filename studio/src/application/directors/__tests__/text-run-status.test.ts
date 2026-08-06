/**
 * 8I-B — text Director run status helpers (no provider, no DB).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isTextDirectorRunActive,
  isTextDirectorRunTerminal,
  publicMessageForTextDirectorRun,
  TEXT_DIRECTOR_TYPES,
} from "../text-run-status";

test("active vs terminal statuses", () => {
  for (const s of ["pending", "reserved", "running"] as const) {
    assert.equal(isTextDirectorRunActive(s), true);
    assert.equal(isTextDirectorRunTerminal(s), false);
  }
  for (const s of ["completed", "failed", "cancelled", "needs_input"] as const) {
    assert.equal(isTextDirectorRunActive(s), false);
    assert.equal(isTextDirectorRunTerminal(s), true);
  }
});

test("failure messages are Director-isolated — Marketing ≠ Creative", () => {
  const marketing = publicMessageForTextDirectorRun("marketing", "invalid_candidate");
  const creative = publicMessageForTextDirectorRun("creative", "invalid_candidate");
  assert.notEqual(marketing, creative);
  assert.match(creative, /créatif/i);
  assert.equal(/%/.test(marketing), false);
  assert.equal(/%/.test(creative), false);

  const script = publicMessageForTextDirectorRun("script", null);
  const art = publicMessageForTextDirectorRun("art", null);
  const storyboard = publicMessageForTextDirectorRun("storyboard", null);
  assert.match(script, /script/i);
  assert.match(art, /art/i);
  assert.match(storyboard, /storyboard/i);
  assert.equal(script.includes("marketing"), false);
  assert.equal(creative.includes("marketing"), false);
});

test("all five text Directors are listed", () => {
  assert.deepEqual([...TEXT_DIRECTOR_TYPES], [
    "marketing",
    "creative",
    "script",
    "art",
    "storyboard",
  ]);
});

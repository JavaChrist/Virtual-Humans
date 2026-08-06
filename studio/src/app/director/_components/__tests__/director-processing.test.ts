/**
 * 8I-B — shared Director processing UX contract (pure helpers).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTOR_RUNNING_MESSAGES,
  directorProcessingMessage,
  isDirectorUiBusy,
  isDirectorUiProcessing,
  uiPhaseFromPersistentStatus,
  type TextDirectorKind,
} from "../director-processing";

const DIRECTORS: TextDirectorKind[] = [
  "marketing",
  "creative",
  "script",
  "art",
  "storyboard",
];

test("five Directors have distinct running messages", () => {
  const msgs = DIRECTORS.map((d) => DIRECTOR_RUNNING_MESSAGES[d]);
  assert.equal(new Set(msgs).size, 5);
  assert.match(DIRECTOR_RUNNING_MESSAGES.marketing, /stratégie marketing/i);
  assert.match(DIRECTOR_RUNNING_MESSAGES.creative, /concept créatif/i);
  assert.match(DIRECTOR_RUNNING_MESSAGES.script, /script/i);
  assert.match(DIRECTOR_RUNNING_MESSAGES.art, /direction artistique/i);
  assert.match(DIRECTOR_RUNNING_MESSAGES.storyboard, /storyboard/i);
});

test("busy vs processing distinction — confirming is busy but not processing UI", () => {
  assert.equal(isDirectorUiBusy("confirming"), true);
  assert.equal(isDirectorUiProcessing("confirming"), false);
  assert.equal(isDirectorUiBusy("running"), true);
  assert.equal(isDirectorUiProcessing("running"), true);
  assert.equal(isDirectorUiBusy("idle"), false);
  assert.equal(isDirectorUiProcessing("completed"), false);
});

test("local phase messages are honest — no percentage", () => {
  for (const d of DIRECTORS) {
    const submitting = directorProcessingMessage(d, "submitting");
    const running = directorProcessingMessage(d, "running");
    const validating = directorProcessingMessage(d, "validating");
    const persisting = directorProcessingMessage(d, "persisting");
    for (const m of [submitting, running, validating, persisting]) {
      assert.ok(m);
      assert.equal(/%/.test(m!), false);
      assert.equal(/reste\s*\d+/i.test(m!), false);
    }
    assert.equal(submitting, "Envoi de la demande…");
    assert.equal(running, DIRECTOR_RUNNING_MESSAGES[d]);
  }
});

test("uiPhaseFromPersistentStatus — durable mapping without inventing steps", () => {
  assert.equal(uiPhaseFromPersistentStatus("idle"), "idle");
  assert.equal(uiPhaseFromPersistentStatus("running"), "running");
  assert.equal(uiPhaseFromPersistentStatus("queued"), "running");
  assert.equal(uiPhaseFromPersistentStatus("waiting_provider"), "running");
  assert.equal(uiPhaseFromPersistentStatus("completed"), "completed");
  assert.equal(uiPhaseFromPersistentStatus("failed"), "failed");
  assert.equal(uiPhaseFromPersistentStatus("cancelled"), "failed");
});

test("override message wins; idle/confirming/completed return null", () => {
  assert.equal(
    directorProcessingMessage("creative", "running", {
      override: "Analyse déjà en cours.",
    }),
    "Analyse déjà en cours.",
  );
  assert.equal(directorProcessingMessage("creative", "idle"), null);
  assert.equal(directorProcessingMessage("creative", "confirming"), null);
  assert.equal(directorProcessingMessage("creative", "completed"), null);
});

test("validating and persisting are local-only observable steps — no fake %", () => {
  assert.equal(
    directorProcessingMessage("marketing", "validating"),
    "Validation du résultat…",
  );
  assert.equal(
    directorProcessingMessage("marketing", "persisting"),
    "Enregistrement du résultat…",
  );
  assert.equal(isDirectorUiBusy("validating"), true);
  assert.equal(isDirectorUiBusy("persisting"), true);
  // Failed/completed are terminal UI — not busy for a new submit after unlock.
  assert.equal(isDirectorUiBusy("failed"), false);
  assert.equal(isDirectorUiBusy("completed"), false);
});

test("Marketing running copy never appears for Creative", () => {
  assert.notEqual(
    DIRECTOR_RUNNING_MESSAGES.marketing,
    DIRECTOR_RUNNING_MESSAGES.creative,
  );
  assert.equal(
    DIRECTOR_RUNNING_MESSAGES.creative.includes("stratégie marketing"),
    false,
  );
});

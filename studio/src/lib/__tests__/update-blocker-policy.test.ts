import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldBlockAutosave,
  shouldBlockDirectorUiProcessing,
  shouldBlockNonDryBusy,
  shouldBlockProductionRun,
  shouldBlockStoryboard,
  shouldBlockStudioJob,
} from "../update-blocker-policy";

test("policy — Director processing after confirm, not during confirming", () => {
  assert.equal(shouldBlockDirectorUiProcessing("idle"), false);
  assert.equal(shouldBlockDirectorUiProcessing("confirming"), false);
  assert.equal(shouldBlockDirectorUiProcessing("completed"), false);
  assert.equal(shouldBlockDirectorUiProcessing("failed"), false);
  assert.equal(shouldBlockDirectorUiProcessing("submitting"), true);
  assert.equal(shouldBlockDirectorUiProcessing("running"), true);
  assert.equal(shouldBlockDirectorUiProcessing("validating"), true);
  assert.equal(shouldBlockDirectorUiProcessing("persisting"), true);
});

test("policy — dry-run busy is not a blocker; execute is", () => {
  assert.equal(shouldBlockNonDryBusy(null), false);
  assert.equal(shouldBlockNonDryBusy("dry"), false);
  assert.equal(shouldBlockNonDryBusy("dry-run", ["dry-run"]), false);
  assert.equal(shouldBlockNonDryBusy("qc-dry", ["qc-dry"]), false);
  assert.equal(shouldBlockNonDryBusy("execute", ["dry"]), true);
  assert.equal(shouldBlockNonDryBusy("approve", ["dry"]), true);
  assert.equal(shouldBlockNonDryBusy("qc-exec", ["qc-dry"]), true);
});

test("policy — production run blocks until terminal; dry does not", () => {
  assert.equal(shouldBlockProductionRun("dry", null), false);
  assert.equal(shouldBlockProductionRun(null, null), false);
  assert.equal(shouldBlockProductionRun("execute", null), true);
  assert.equal(shouldBlockProductionRun("cancel", "running"), true);
  assert.equal(shouldBlockProductionRun(null, "running"), true);
  assert.equal(shouldBlockProductionRun(null, "queued"), true);
  assert.equal(shouldBlockProductionRun(null, "completed"), false);
  assert.equal(shouldBlockProductionRun(null, "failed"), false);
  assert.equal(shouldBlockProductionRun(null, "cancelled"), false);
});

test("policy — autosave dirty/saving only", () => {
  assert.equal(shouldBlockAutosave("idle"), false);
  assert.equal(shouldBlockAutosave("saved"), false);
  assert.equal(shouldBlockAutosave("error"), false);
  assert.equal(shouldBlockAutosave("dirty"), true);
  assert.equal(shouldBlockAutosave("saving"), true);
});

test("policy — studio job ignores idle, terminal, and errors", () => {
  assert.equal(shouldBlockStudioJob({}), false);
  assert.equal(shouldBlockStudioJob({ status: null }), false);
  assert.equal(shouldBlockStudioJob({ status: "Envoi…" }), true);
  assert.equal(shouldBlockStudioJob({ status: "Envoi…", resultUrl: "https://example.invalid/v" }), false);
  assert.equal(shouldBlockStudioJob({ status: "Envoi…", error: "échec" }), false);
  assert.equal(shouldBlockStudioJob({ status: "Terminé" }), false);
  assert.equal(shouldBlockStudioJob({ status: "Terminé (pas d'URL)" }), false);
});

test("policy — storyboard composite: concurrent shots stay blocked until last finishes", () => {
  const idle = {
    masterBusy: false,
    duoBusy: false,
    mergeStatus: null as string | null,
    mergedUrl: null as string | null,
    mergeError: null as string | null,
    shots: [{ status: null, videoUrl: null, error: null, voiceBusy: false }],
    partners: [{ busy: false }],
  };
  assert.equal(shouldBlockStoryboard(idle), false);
  assert.equal(shouldBlockStoryboard({ ...idle, masterBusy: true }), true);
  assert.equal(shouldBlockStoryboard({ ...idle, duoBusy: true }), true);
  assert.equal(shouldBlockStoryboard({ ...idle, partners: [{ busy: true }] }), true);
  assert.equal(
    shouldBlockStoryboard({
      ...idle,
      shots: [
        { status: "COMPLETED", videoUrl: "https://example.invalid/a", voiceBusy: false },
        { status: "IN_QUEUE", videoUrl: null, voiceBusy: false },
      ],
    }),
    true,
  );
  assert.equal(
    shouldBlockStoryboard({
      ...idle,
      shots: [{ status: "Terminé", videoUrl: null, error: null, voiceBusy: false }],
    }),
    false,
  );
  assert.equal(
    shouldBlockStoryboard({
      ...idle,
      shots: [{ syncStatus: "Envoi…", syncedUrl: null, syncError: null, voiceBusy: false }],
    }),
    true,
  );
});

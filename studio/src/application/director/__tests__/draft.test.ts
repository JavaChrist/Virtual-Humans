import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTOR_BRIEF_DRAFT_KEY,
  DIRECTOR_DRAFT_QUARANTINE_KEY,
  clearBriefDraft,
  loadBriefDraft,
  newBriefDraft,
  parseDraftJson,
  saveBriefDraft,
  updateDraftFields,
  type DraftStorage,
} from "../draft";
import { createDebouncer } from "../progress";

function memoryStorage(initial: Record<string, string> = {}): DraftStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(k) {
      return data[k] ?? null;
    },
    setItem(k, v) {
      data[k] = v;
    },
    removeItem(k) {
      delete data[k];
    },
  };
}

test("serialize and restore a draft", () => {
  const storage = memoryStorage();
  let draft = newBriefDraft(1);
  draft = updateDraftFields(draft, { projectName: "Test", platform: "tiktok" }, 1);
  assert.equal(saveBriefDraft(draft, storage).ok, true);
  const loaded = loadBriefDraft(storage);
  assert.equal(loaded.ok, true);
  if (loaded.ok) {
    assert.equal(loaded.draft.fields.projectName, "Test");
    assert.equal(loaded.draft.currentStep, 1);
  }
});

test("corrupt draft is quarantined", () => {
  const storage = memoryStorage({ [DIRECTOR_BRIEF_DRAFT_KEY]: "{not-json" });
  const loaded = loadBriefDraft(storage);
  assert.equal(loaded.ok, false);
  if (!loaded.ok) assert.equal(loaded.reason, "corrupt");
  assert.ok(storage.data[DIRECTOR_DRAFT_QUARANTINE_KEY]);
  assert.equal(storage.data[DIRECTOR_BRIEF_DRAFT_KEY], undefined);
});

test("unsupported draft version", () => {
  const raw = JSON.stringify({
    draftVersion: "99.0.0",
    updatedAt: "2026-08-02T12:00:00.000Z",
    currentStep: 0,
    fields: {},
  });
  const result = parseDraftJson(raw);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unsupported_version");
});

test("unavailable storage", () => {
  assert.equal(loadBriefDraft(null).ok, false);
  assert.equal(saveBriefDraft(newBriefDraft(), null).ok, false);
});

test("clear draft", () => {
  const storage = memoryStorage();
  saveBriefDraft(newBriefDraft(), storage);
  assert.equal(clearBriefDraft(storage).ok, true);
  assert.equal(loadBriefDraft(storage).ok, false);
});

test("debounce schedules once with fake timers", () => {
  const calls: number[] = [];
  let pending: Array<() => void> = [];
  const debouncer = createDebouncer(400, {
    setTimeout: ((fn: () => void) => {
      pending.push(fn);
      return pending.length as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout,
    clearTimeout: (() => {
      pending = [];
    }) as typeof clearTimeout,
  });
  debouncer.schedule(() => calls.push(1));
  debouncer.schedule(() => calls.push(2));
  assert.equal(calls.length, 0);
  assert.equal(pending.length, 1);
  pending[0]();
  assert.deepEqual(calls, [2]);
});

test("current step is preserved on field update", () => {
  const draft = updateDraftFields(newBriefDraft(3), { tone: "calm" }, 3);
  assert.equal(draft.currentStep, 3);
  assert.equal(draft.fields.tone, "calm");
});

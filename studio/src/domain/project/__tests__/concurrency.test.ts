import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOptimisticUpdate, assertExpectedRevision } from "../concurrency";
import { ProjectDomainError } from "../errors";

test("assertExpectedRevision accepts matching version", () => {
  assert.doesNotThrow(() => assertExpectedRevision(3, 3, "storyboard_project", "rev_3"));
});

test("assertExpectedRevision rejects stale version without leaking content", () => {
  try {
    assertExpectedRevision(2, 5, "generation_plan", "rev_5");
    assert.fail("expected throw");
  } catch (e) {
    assert.ok(e instanceof ProjectDomainError);
    assert.equal(e.code, "version_conflict");
    assert.deepEqual(e.details, {
      expectedRevision: 2,
      actualRevision: 5,
      resourceType: "generation_plan",
      resourceId: "rev_5",
    });
    assert.equal(JSON.stringify(e.details).includes("prompt"), false);
  }
});

test("applyOptimisticUpdate returns next token", () => {
  const result = applyOptimisticUpdate({
    resourceType: "video_script",
    resourceId: "art_1",
    currentRevision: 1,
    currentUpdatedAt: "2026-08-02T12:00:00.000Z",
    write: { expectedRevision: 1, value: { text: "hello" } },
    updatedAt: "2026-08-02T12:05:00.000Z",
  });
  assert.deepEqual(result.value, { text: "hello" });
  assert.equal(result.token.revision, 2);
  assert.equal(result.token.updatedAt, "2026-08-02T12:05:00.000Z");
});

test("simulated concurrent update: second writer loses", () => {
  const first = applyOptimisticUpdate({
    resourceType: "marketing_plan",
    resourceId: "mp_1",
    currentRevision: 4,
    currentUpdatedAt: "2026-08-02T10:00:00.000Z",
    write: { expectedRevision: 4, value: { a: 1 } },
    updatedAt: "2026-08-02T10:01:00.000Z",
  });
  assert.throws(
    () =>
      applyOptimisticUpdate({
        resourceType: "marketing_plan",
        resourceId: "mp_1",
        currentRevision: first.token.revision,
        currentUpdatedAt: first.token.updatedAt,
        write: { expectedRevision: 4, value: { a: 2 } },
        updatedAt: "2026-08-02T10:02:00.000Z",
      }),
    ProjectDomainError,
  );
});

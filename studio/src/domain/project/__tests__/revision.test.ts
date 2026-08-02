import assert from "node:assert/strict";
import { test } from "node:test";
import { ProjectDomainError } from "../errors";
import {
  activateRevision,
  createInitialRevision,
  createNextRevision,
  validateRevisionChain,
} from "../revision";

const ids = {
  projectId: "proj_1",
  createdBy: "user_1",
  correlationId: "corr-rev-00000001",
};

test("createInitialRevision starts at 1 and freezes value", () => {
  const value = { title: "Brief", nested: { a: 1 } };
  const rev = createInitialRevision({
    id: "rev_1",
    ...ids,
    artifactType: "video_project_brief",
    value,
    createdAt: "2026-08-02T12:00:00.000Z",
  });
  assert.equal(rev.revision, 1);
  assert.equal(rev.reason, "initial");
  // Input object is cloned — mutating the original must not affect the revision.
  (value as { title: string }).title = "mutated";
  assert.equal(rev.value.title, "Brief");
  assert.throws(() => {
    (rev.value as { title: string }).title = "x";
  });
});

test("createNextRevision links parent and increments", () => {
  const r1 = createInitialRevision({
    id: "rev_1",
    ...ids,
    artifactType: "storyboard_project",
    value: { scenes: 1 },
    createdAt: "2026-08-02T12:00:00.000Z",
  });
  const r2 = createNextRevision({
    id: "rev_2",
    parent: r1,
    value: { scenes: 2 },
    createdBy: "user_1",
    correlationId: "corr-rev-00000002",
    createdAt: "2026-08-02T12:01:00.000Z",
  });
  assert.equal(r2.revision, 2);
  assert.equal(r2.parentRevisionId, "rev_1");
  assert.equal(r2.projectId, r1.projectId);
  assert.equal(r2.artifactType, r1.artifactType);
  validateRevisionChain([r1, r2]);
});

test("validateRevisionChain rejects bad parent, non-increasing, mismatch", () => {
  const r1 = createInitialRevision({
    id: "rev_1",
    ...ids,
    artifactType: "marketing_plan",
    value: { ok: true },
    createdAt: "2026-08-02T12:00:00.000Z",
  });
  const r2 = createNextRevision({
    id: "rev_2",
    parent: r1,
    value: { ok: false },
    createdBy: "user_1",
    correlationId: "corr-rev-00000002",
    createdAt: "2026-08-02T12:01:00.000Z",
  });
  const brokenParent = { ...r2, parentRevisionId: "missing" };
  assert.throws(() => validateRevisionChain([r1, brokenParent]), ProjectDomainError);

  const wrongType = {
    ...r2,
    artifactType: "video_script" as const,
    parentRevisionId: "rev_1",
  };
  assert.throws(() => validateRevisionChain([r1, wrongType]), ProjectDomainError);

  const nonIncreasing = { ...r2, revision: 1, parentRevisionId: "rev_1" };
  assert.throws(() => validateRevisionChain([r1, nonIncreasing]), ProjectDomainError);
});

test("rejects invalid date and non-serializable value", () => {
  assert.throws(
    () =>
      createInitialRevision({
        id: "rev_x",
        ...ids,
        artifactType: "creative_concept",
        value: { ok: 1 },
        createdAt: "not-a-date",
      }),
    ProjectDomainError,
  );
  assert.throws(
    () =>
      createInitialRevision({
        id: "rev_y",
        ...ids,
        artifactType: "creative_concept",
        value: { fn: () => 1 } as unknown as object,
        createdAt: "2026-08-02T12:00:00.000Z",
      }),
    ProjectDomainError,
  );
  assert.throws(
    () =>
      createInitialRevision({
        id: "rev_z",
        ...ids,
        artifactType: "creative_concept",
        value: { d: new Date() } as unknown as object,
        createdAt: "2026-08-02T12:00:00.000Z",
      }),
    ProjectDomainError,
  );
});

test("activateRevision with optimistic check", () => {
  const r1 = createInitialRevision({
    id: "rev_1",
    ...ids,
    artifactType: "generation_plan",
    value: { steps: 1 },
    createdAt: "2026-08-02T12:00:00.000Z",
  });
  const active = activateRevision(null, r1, 0);
  assert.equal(active.revision, 1);
  const r2 = createNextRevision({
    id: "rev_2",
    parent: r1,
    value: { steps: 2 },
    createdBy: "user_1",
    correlationId: "corr-rev-00000002",
    createdAt: "2026-08-02T12:02:00.000Z",
  });
  assert.throws(() => activateRevision(active, r2, 99), (e: unknown) => {
    return (
      e instanceof ProjectDomainError &&
      e.code === "version_conflict" &&
      e.details?.expectedRevision === 99 &&
      e.details?.actualRevision === 1 &&
      !JSON.stringify(e.details).includes("steps")
    );
  });
  const next = activateRevision(active, r2, 1);
  assert.equal(next.revisionId, "rev_2");
});

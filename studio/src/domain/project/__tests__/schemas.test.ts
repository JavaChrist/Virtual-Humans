import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_APPROVAL_COMMENT_LENGTH } from "../approval";
import {
  ActiveRevisionSchema,
  ApprovalSchema,
  ArtifactTypeSchema,
  ProjectStateSchema,
  RevisionSchemaZ,
  SceneStateSchema,
} from "../schemas";

test("project and scene state schemas round-trip", () => {
  const p = ProjectStateSchema.parse({ status: "draft" });
  assert.equal(p.status, "draft");
  const s = SceneStateSchema.parse({ status: "queued", jobId: "job_1" });
  assert.equal(s.jobId, "job_1");
});

test("revision schema accepts serializable payload", () => {
  const parsed = RevisionSchemaZ.parse({
    id: "rev_1",
    projectId: "proj_1",
    artifactType: "video_script",
    revision: 1,
    schemaVersion: "1.0.0",
    value: { lines: ["a"] },
    createdAt: "2026-08-02T12:00:00.000Z",
    createdBy: "user_1",
    correlationId: "corr-1",
  });
  assert.deepEqual(parsed.value, { lines: ["a"] });
});

test("rejects empty ids, bad timestamps, unknown artifact, long comment", () => {
  assert.equal(ArtifactTypeSchema.safeParse("unknown_thing").success, false);
  assert.equal(
    RevisionSchemaZ.safeParse({
      id: "",
      projectId: "p",
      artifactType: "marketing_plan",
      revision: 1,
      schemaVersion: "1.0.0",
      value: {},
      createdAt: "2026-08-02T12:00:00.000Z",
      createdBy: "u",
      correlationId: "c",
    }).success,
    false,
  );
  assert.equal(
    ActiveRevisionSchema.safeParse({
      projectId: "p",
      artifactType: "marketing_plan",
      revisionId: "r",
      revision: 1,
      updatedAt: "yesterday",
      updatedBy: "u",
    }).success,
    false,
  );
  assert.equal(
    ApprovalSchema.safeParse({
      id: "a",
      projectId: "p",
      artifactType: "marketing_plan",
      revisionId: "r",
      revision: 1,
      status: "approved",
      decidedAt: "2026-08-02T12:00:00.000Z",
      decidedBy: "u",
      comment: "z".repeat(MAX_APPROVAL_COMMENT_LENGTH + 1),
    }).success,
    false,
  );
});

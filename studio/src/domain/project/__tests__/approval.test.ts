import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_APPROVAL_COMMENT_LENGTH,
  checkProductionReadiness,
  createApproval,
  isApprovalCurrent,
} from "../approval";
import type { ArtifactType } from "../artifact-types";
import { ProjectDomainError } from "../errors";
import { activateRevision, createInitialRevision, createNextRevision } from "../revision";

const ids = {
  projectId: "proj_1",
  createdBy: "user_1",
  correlationId: "corr-apr-00000001",
};

function makeRev(type: ArtifactType, id: string) {
  return createInitialRevision({
    id,
    ...ids,
    artifactType: type,
    value: { ok: true },
    createdAt: "2026-08-02T12:00:00.000Z",
  });
}

test("createApproval approved and rejected", () => {
  const rev = makeRev("storyboard_project", "sb_1");
  const ok = createApproval({
    id: "ap_1",
    target: rev,
    status: "approved",
    decidedBy: "user_1",
    decidedAt: "2026-08-02T13:00:00.000Z",
    comment: "Looks good",
  });
  assert.equal(ok.status, "approved");
  assert.equal(ok.revisionId, "sb_1");

  const no = createApproval({
    id: "ap_2",
    target: rev,
    status: "rejected",
    decidedBy: "user_1",
    decidedAt: "2026-08-02T13:05:00.000Z",
  });
  assert.equal(no.status, "rejected");
});

test("approval of old revision is stale after new revision activated", () => {
  const r1 = makeRev("generation_plan", "gp_1");
  const active1 = activateRevision(null, r1, 0);
  const approval = createApproval({
    id: "ap_1",
    target: r1,
    status: "approved",
    decidedBy: "user_1",
    decidedAt: "2026-08-02T13:00:00.000Z",
  });
  assert.equal(isApprovalCurrent(approval, active1), true);

  const r2 = createNextRevision({
    id: "gp_2",
    parent: r1,
    value: { ok: false },
    createdBy: "user_1",
    correlationId: "corr-apr-00000002",
    createdAt: "2026-08-02T14:00:00.000Z",
  });
  const active2 = activateRevision(active1, r2, 1);
  assert.equal(isApprovalCurrent(approval, active2), false);
});

test("production readiness requires approved active artifacts", () => {
  const brief = makeRev("video_project_brief", "b1");
  const board = makeRev("storyboard_project", "s1");
  const plan = makeRev("generation_plan", "g1");

  const activeByType = {
    video_project_brief: activateRevision(null, brief, 0),
    storyboard_project: activateRevision(null, board, 0),
    generation_plan: activateRevision(null, plan, 0),
  };
  const approvalsByType = {
    video_project_brief: createApproval({
      id: "a1",
      target: brief,
      status: "approved",
      decidedBy: "u",
      decidedAt: "2026-08-02T13:00:00.000Z",
    }),
    storyboard_project: createApproval({
      id: "a2",
      target: board,
      status: "approved",
      decidedBy: "u",
      decidedAt: "2026-08-02T13:00:00.000Z",
    }),
    generation_plan: createApproval({
      id: "a3",
      target: plan,
      status: "approved",
      decidedBy: "u",
      decidedAt: "2026-08-02T13:00:00.000Z",
    }),
  };

  assert.equal(
    checkProductionReadiness({ projectId: "proj_1", activeByType, approvalsByType }).ready,
    true,
  );

  const missing = checkProductionReadiness({
    projectId: "proj_1",
    activeByType: { video_project_brief: activeByType.video_project_brief },
    approvalsByType,
  });
  assert.equal(missing.ready, false);
  assert.ok(missing.missing.includes("storyboard_project"));

  const rejected = checkProductionReadiness({
    projectId: "proj_1",
    activeByType,
    approvalsByType: {
      ...approvalsByType,
      generation_plan: createApproval({
        id: "a4",
        target: plan,
        status: "rejected",
        decidedBy: "u",
        decidedAt: "2026-08-02T13:00:00.000Z",
      }),
    },
  });
  assert.equal(rejected.ready, false);
  assert.ok(rejected.unapproved.includes("generation_plan"));
});

test("comment length bound", () => {
  const rev = makeRev("creative_concept", "cc_1");
  assert.throws(
    () =>
      createApproval({
        id: "ap_long",
        target: rev,
        status: "approved",
        decidedBy: "u",
        decidedAt: "2026-08-02T13:00:00.000Z",
        comment: "x".repeat(MAX_APPROVAL_COMMENT_LENGTH + 1),
      }),
    ProjectDomainError,
  );
});

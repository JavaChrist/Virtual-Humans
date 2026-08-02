import assert from "node:assert/strict";
import { test } from "node:test";
import { ProjectDomainError } from "../errors";
import { transitionScene, type SceneState } from "../scene-state";

test("full happy cycle with preconditions", () => {
  let s: SceneState = { status: "pending" };
  s = transitionScene(s, "ready", { hasValidSceneData: true });
  s = transitionScene(s, "queued", { hasApprovedPlan: true });
  s = transitionScene(s, "generating", { jobId: "job_1" });
  assert.equal(s.jobId, "job_1");
  s = transitionScene(s, "validating");
  s = transitionScene(s, "completed", { hasValidResult: true });
  assert.equal(s.status, "completed");
});

test("missing preconditions", () => {
  assert.throws(
    () => transitionScene({ status: "pending" }, "ready", {}),
    (e: unknown) => e instanceof ProjectDomainError && e.code === "missing_precondition",
  );
  assert.throws(
    () => transitionScene({ status: "ready" }, "queued", {}),
    ProjectDomainError,
  );
  assert.throws(
    () => transitionScene({ status: "queued" }, "generating", {}),
    ProjectDomainError,
  );
  assert.throws(
    () => transitionScene({ status: "validating" }, "completed", {}),
    ProjectDomainError,
  );
});

test("retryable_failed requires explicit retry authorization", () => {
  const failed = { status: "retryable_failed" as const, jobId: "j1" };
  assert.throws(() => transitionScene(failed, "queued", {}), ProjectDomainError);
  const retried = transitionScene(failed, "queued", { retryAuthorized: true });
  assert.equal(retried.status, "queued");
});

test("definitive failed is not auto-retried to queued", () => {
  assert.throws(() => transitionScene({ status: "failed" }, "queued"), ProjectDomainError);
});

test("cancel and skip terminate generation paths", () => {
  assert.equal(transitionScene({ status: "ready" }, "cancelled").status, "cancelled");
  assert.equal(transitionScene({ status: "pending" }, "skipped").status, "skipped");
  assert.throws(() => transitionScene({ status: "cancelled" }, "ready"), ProjectDomainError);
  assert.throws(() => transitionScene({ status: "skipped" }, "queued"), ProjectDomainError);
});

test("completed cannot be silently regenerated via status mutation", () => {
  assert.throws(() => transitionScene({ status: "completed" }, "queued"), ProjectDomainError);
  assert.throws(() => transitionScene({ status: "completed" }, "generating"), ProjectDomainError);
});

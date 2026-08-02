import assert from "node:assert/strict";
import { test } from "node:test";
import { ProjectDomainError } from "../errors";
import {
  ProjectStatusValues,
  canTransitionProject,
  transitionProject,
  type ProjectStatus,
} from "../project-state";

const HAPPY: Array<[ProjectStatus, ProjectStatus]> = [
  ["draft", "planning"],
  ["planning", "awaiting_approval"],
  ["awaiting_approval", "approved"],
  ["approved", "producing"],
  ["producing", "completed"],
];

test("happy-path transitions are allowed", () => {
  for (const [from, to] of HAPPY) {
    assert.equal(canTransitionProject(from, to), true, `${from}→${to}`);
    assert.equal(transitionProject({ status: from }, to).status, to);
  }
});

test("forbidden transitions throw", () => {
  assert.throws(() => transitionProject({ status: "draft" }, "producing"), ProjectDomainError);
  assert.throws(() => transitionProject({ status: "completed" }, "producing"), ProjectDomainError);
  assert.throws(() => transitionProject({ status: "archived" }, "draft"), ProjectDomainError);
});

test("same-status transition is idempotent", () => {
  const state = { status: "planning" as const };
  const next = transitionProject(state, "planning");
  assert.equal(next.status, "planning");
  assert.equal(canTransitionProject("planning", "planning"), true);
});

test("archiving preserves previous status", () => {
  const archived = transitionProject({ status: "approved" }, "archived");
  assert.equal(archived.status, "archived");
  assert.equal(archived.previousStatus, "approved");
});

test("failed/cancelled reopen requires explicitReopen", () => {
  assert.equal(canTransitionProject("failed", "draft"), false);
  assert.equal(canTransitionProject("failed", "draft", { explicitReopen: true }), true);
  assert.throws(() => transitionProject({ status: "cancelled" }, "planning"), ProjectDomainError);
  assert.equal(
    transitionProject({ status: "cancelled" }, "planning", { explicitReopen: true }).status,
    "planning",
  );
});

test("completed cannot silently become producing; reopen goes to draft", () => {
  assert.equal(canTransitionProject("completed", "producing"), false);
  assert.equal(canTransitionProject("completed", "draft"), false);
  assert.equal(canTransitionProject("completed", "draft", { explicitReopen: true }), true);
});

test("all status values are covered in the union", () => {
  assert.equal(ProjectStatusValues.length, 9);
});

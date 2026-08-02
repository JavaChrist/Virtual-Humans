import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLogContext,
  generateCorrelationId,
  isValidCorrelationId,
  resolveCorrelationId,
} from "../correlation";

test("isValidCorrelationId accepts UUID", () => {
  assert.equal(isValidCorrelationId("a1b2c3d4-e5f6-4789-abcd-ef1234567890"), true);
});

test("isValidCorrelationId accepts readable ids", () => {
  assert.equal(isValidCorrelationId("req_prod_abc12345"), true);
});

test("isValidCorrelationId rejects short values", () => {
  assert.equal(isValidCorrelationId("short"), false);
});

test("isValidCorrelationId rejects spaces and unsafe chars", () => {
  assert.equal(isValidCorrelationId("bad id with spaces!!"), false);
  assert.equal(isValidCorrelationId("has/slash/inside"), false);
});

test("isValidCorrelationId rejects empty / non-string", () => {
  assert.equal(isValidCorrelationId(""), false);
  assert.equal(isValidCorrelationId(null), false);
  assert.equal(isValidCorrelationId(undefined), false);
});

test("resolveCorrelationId conserves a valid incoming id", () => {
  const id = "client-corr-00123456";
  assert.equal(resolveCorrelationId(id), id);
});

test("resolveCorrelationId replaces an invalid id", () => {
  const resolved = resolveCorrelationId("!!!");
  assert.equal(isValidCorrelationId(resolved), true);
  assert.notEqual(resolved, "!!!");
});

test("resolveCorrelationId generates when absent", () => {
  const a = resolveCorrelationId(undefined);
  const b = resolveCorrelationId(null);
  assert.equal(isValidCorrelationId(a), true);
  assert.equal(isValidCorrelationId(b), true);
});

test("generateCorrelationId produces unique valid ids", () => {
  const a = generateCorrelationId();
  const b = generateCorrelationId();
  assert.equal(isValidCorrelationId(a), true);
  assert.equal(isValidCorrelationId(b), true);
  assert.notEqual(a, b);
});

test("createLogContext keeps optional fields and repairs bad correlation id", () => {
  const ctx = createLogContext("bad", {
    projectId: "proj_1",
    sceneId: "scene_1",
    route: "/api/estimate",
  });
  assert.equal(isValidCorrelationId(ctx.correlationId), true);
  assert.equal(ctx.projectId, "proj_1");
  assert.equal(ctx.sceneId, "scene_1");
  assert.equal(ctx.route, "/api/estimate");
  assert.equal(ctx.stepId, undefined);
});

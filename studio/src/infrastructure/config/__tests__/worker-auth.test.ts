import assert from "node:assert/strict";
import { test } from "node:test";
import { assertDirectorWorkerSecret } from "../worker-auth";

test("worker secret — absent config fail-closed", () => {
  const r = assertDirectorWorkerSecret("anything", { DIRECTOR_V2_WORKER_SECRET: "" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "secret_not_configured");
});

test("worker secret — header missing", () => {
  const r = assertDirectorWorkerSecret(null, {
    DIRECTOR_V2_WORKER_SECRET: "worker-secret-value-ok",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "header_missing");
});

test("worker secret — mismatch", () => {
  const r = assertDirectorWorkerSecret("wrong", {
    DIRECTOR_V2_WORKER_SECRET: "worker-secret-value-ok",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "secret_mismatch");
});

test("worker secret — match", () => {
  const r = assertDirectorWorkerSecret("worker-secret-value-ok", {
    DIRECTOR_V2_WORKER_SECRET: "worker-secret-value-ok",
  });
  assert.equal(r.ok, true);
});

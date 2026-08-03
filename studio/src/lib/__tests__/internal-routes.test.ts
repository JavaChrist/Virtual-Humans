import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIRECTOR_WORKER_RUN_ONCE_PATH,
  isDirectorWorkerRunOncePost,
  isInternalApiPath,
} from "../internal-routes";
import { assertDirectorWorkerSecret } from "@/infrastructure/config/worker-auth";

const SYNTHETIC_SECRET = "worker-secret-value-ok";

test("seule POST /api/internal/director-worker/run-once est exemptée cookie", () => {
  assert.equal(
    isDirectorWorkerRunOncePost(DIRECTOR_WORKER_RUN_ONCE_PATH, "POST"),
    true,
  );
  assert.equal(
    isDirectorWorkerRunOncePost(DIRECTOR_WORKER_RUN_ONCE_PATH, "post"),
    true,
  );
});

test("GET worker refusé (pas d'exemption cookie)", () => {
  assert.equal(
    isDirectorWorkerRunOncePost(DIRECTOR_WORKER_RUN_ONCE_PATH, "GET"),
    false,
  );
});

test("absence d'exemption wildcard /api/internal/**", () => {
  assert.equal(isDirectorWorkerRunOncePost("/api/internal", "POST"), false);
  assert.equal(isDirectorWorkerRunOncePost("/api/internal/", "POST"), false);
  assert.equal(
    isDirectorWorkerRunOncePost("/api/internal/other", "POST"),
    false,
  );
  assert.equal(
    isDirectorWorkerRunOncePost("/api/internal/director-worker", "POST"),
    false,
  );
  assert.equal(
    isDirectorWorkerRunOncePost(
      "/api/internal/director-worker/run-once/extra",
      "POST",
    ),
    false,
  );
  assert.ok(isInternalApiPath("/api/internal/unknown"));
  assert.equal(
    isDirectorWorkerRunOncePost("/api/internal/unknown", "POST"),
    false,
  );
});

test("worker avec secret synthétique valide", () => {
  const r = assertDirectorWorkerSecret(SYNTHETIC_SECRET, {
    DIRECTOR_V2_WORKER_SECRET: SYNTHETIC_SECRET,
  });
  assert.equal(r.ok, true);
});

test("worker sans secret", () => {
  const r = assertDirectorWorkerSecret(null, {
    DIRECTOR_V2_WORKER_SECRET: SYNTHETIC_SECRET,
  });
  assert.equal(r.ok, false);
});

test("worker avec mauvais secret", () => {
  const r = assertDirectorWorkerSecret("wrong-secret", {
    DIRECTOR_V2_WORKER_SECRET: SYNTHETIC_SECRET,
  });
  assert.equal(r.ok, false);
});

test("cookie utilisateur seul insuffisant — secret toujours requis", () => {
  // Presence of a session cookie is irrelevant to worker auth helper
  const r = assertDirectorWorkerSecret("", {
    DIRECTOR_V2_WORKER_SECRET: SYNTHETIC_SECRET,
  });
  assert.equal(r.ok, false);
  const noHeader = assertDirectorWorkerSecret(undefined, {
    DIRECTOR_V2_WORKER_SECRET: SYNTHETIC_SECRET,
  });
  assert.equal(noHeader.ok, false);
});

test("chemin exact exporté stable", () => {
  assert.equal(
    DIRECTOR_WORKER_RUN_ONCE_PATH,
    "/api/internal/director-worker/run-once",
  );
});

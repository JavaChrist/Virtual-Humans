import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getActiveUpdateBlockers,
  registerUpdateBlocker,
  resetUpdateBlockersForTests,
  sanitizeUpdateBlockerReason,
  subscribeToUpdateBlockers,
} from "../update-blockers";

test("update-blockers — register, doublon, plusieurs, cleanup", () => {
  resetUpdateBlockersForTests();
  const releaseA = registerUpdateBlocker("generate", "Génération en cours");
  const releaseA2 = registerUpdateBlocker("generate", "Toujours en cours");
  const releaseB = registerUpdateBlocker("director", "Réalisateur occupé");
  const active = getActiveUpdateBlockers();
  assert.equal(active.length, 2);
  assert.equal(active.find((b) => b.id === "generate")?.reason, "Toujours en cours");
  releaseA();
  assert.equal(getActiveUpdateBlockers().length, 2);
  releaseA2();
  assert.equal(getActiveUpdateBlockers().length, 1);
  releaseB();
  assert.deepEqual(getActiveUpdateBlockers(), []);
});

test("update-blockers — subscription et SSR-safe", () => {
  resetUpdateBlockersForTests();
  let ticks = 0;
  const unsub = subscribeToUpdateBlockers(() => {
    ticks += 1;
  });
  const release = registerUpdateBlocker("login", "Connexion");
  assert.equal(ticks, 1);
  release();
  assert.equal(ticks, 2);
  unsub();
  registerUpdateBlocker("x", "y")();
  assert.equal(ticks, 2);
  assert.equal(typeof window, "undefined");
});

test("update-blockers — sanitize HTML hors de la raison", () => {
  assert.equal(sanitizeUpdateBlockerReason("<script>x</script>"), "scriptx/script");
  resetUpdateBlockersForTests();
  registerUpdateBlocker("html", "<b>danger</b>")();
});

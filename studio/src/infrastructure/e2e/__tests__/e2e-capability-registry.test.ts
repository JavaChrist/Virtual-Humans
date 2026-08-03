import assert from "node:assert/strict";
import { test } from "node:test";
import { buildE2eSyntheticCapabilityRegistry } from "../e2e-capability-registry";

test("E2E capability registry builds a valid routable snapshot", () => {
  const snap = buildE2eSyntheticCapabilityRegistry({
    createdAt: "2026-08-03T12:00:00.000Z",
    registryVersion: "e2e-test",
  });
  assert.equal(snap.registryVersion, "e2e-test");
  assert.ok(snap.models.length >= 5);
  assert.ok(snap.models.some((m) => m.supportedProfiles.includes("video.dialogue")));
  assert.ok(snap.models.some((m) => m.supportedProfiles.includes("video.image_to_video")));
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_UPDATE_SKIP_WAITING,
  createAppUpdateSession,
  createMemoryStorage,
} from "../app-update-client";
import { resolveAppVersion } from "../app-version";
import { UPDATE_BLOCKER_IDS, UPDATE_BLOCKER_REASONS } from "../update-blocker-reasons";
import {
  getActiveUpdateBlockers,
  registerUpdateBlocker,
  resetUpdateBlockersForTests,
} from "../update-blockers";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function payload() {
  return resolveAppVersion({ sdkVersion: "1.0.0", gitSha: SHA_A });
}

function simulateHook(active: boolean, id: string, reason: string): (() => void) | undefined {
  if (!active || !id) return undefined;
  return registerUpdateBlocker(id, reason);
}

test("integration — register at real start, reason, apply refused, zero skip/reload", async () => {
  resetUpdateBlockersForTests();
  let reloads = 0;
  let skips = 0;
  const worker = {
    postMessage: (data: string) => {
      assert.equal(data, APP_UPDATE_SKIP_WAITING);
      skips += 1;
    },
  };
  const session = createAppUpdateSession({
    fetchVersion: async () => payload(),
    isOnline: () => true,
    getBlockers: getActiveUpdateBlockers,
    reload: () => {
      reloads += 1;
    },
    storage: createMemoryStorage(),
    skipWaiting: (w) => w.postMessage(APP_UPDATE_SKIP_WAITING),
  });
  await session.poll();
  session.setWaiting(worker);

  assert.equal(simulateHook(false, UPDATE_BLOCKER_IDS.generateImage, UPDATE_BLOCKER_REASONS.generating), undefined);
  assert.deepEqual(getActiveUpdateBlockers(), []);
  assert.equal(await session.apply(), true);
  assert.equal(skips, 1);
  assert.equal(reloads, 0);
  session.onControllerChange();
  assert.equal(reloads, 1);

  resetUpdateBlockersForTests();
  reloads = 0;
  skips = 0;
  const blocked = createAppUpdateSession({
    fetchVersion: async () => payload(),
    isOnline: () => true,
    getBlockers: getActiveUpdateBlockers,
    reload: () => {
      reloads += 1;
    },
    storage: createMemoryStorage(),
    skipWaiting: (w) => w.postMessage(APP_UPDATE_SKIP_WAITING),
  });
  await blocked.poll();
  blocked.setWaiting(worker);
  const release = simulateHook(true, UPDATE_BLOCKER_IDS.generateImage, UPDATE_BLOCKER_REASONS.generating);
  const active = getActiveUpdateBlockers();
  assert.equal(active.length, 1);
  assert.equal(active[0]?.id, UPDATE_BLOCKER_IDS.generateImage);
  assert.equal(active[0]?.reason, UPDATE_BLOCKER_REASONS.generating);
  assert.equal(await blocked.apply(), false);
  assert.equal(blocked.getState().ux, "blocked");
  assert.equal(skips, 0);
  assert.equal(reloads, 0);
  release?.();
  assert.deepEqual(getActiveUpdateBlockers(), []);
  assert.equal(skips, 0);
  assert.equal(reloads, 0);
  assert.equal(await blocked.apply(), true);
  assert.equal(skips, 1);
});

test("integration — cleanup success/error/cancel/unmount + idempotence, no zombie", () => {
  resetUpdateBlockersForTests();
  const success = simulateHook(true, "op-success", UPDATE_BLOCKER_REASONS.saving);
  const errorOp = simulateHook(true, "op-error", UPDATE_BLOCKER_REASONS.saving);
  const cancel = simulateHook(true, "op-cancel", UPDATE_BLOCKER_REASONS.generating);
  const unmount = simulateHook(true, "op-unmount", UPDATE_BLOCKER_REASONS.login);
  assert.equal(getActiveUpdateBlockers().length, 4);
  success?.();
  errorOp?.();
  cancel?.();
  unmount?.();
  unmount?.();
  assert.deepEqual(getActiveUpdateBlockers(), []);
});

test("integration — concurrent refcount: one finished does not release the other", () => {
  resetUpdateBlockersForTests();
  const a = registerUpdateBlocker(UPDATE_BLOCKER_IDS.generateStoryboard, UPDATE_BLOCKER_REASONS.generating);
  const b = registerUpdateBlocker(UPDATE_BLOCKER_IDS.generateStoryboard, UPDATE_BLOCKER_REASONS.generating);
  assert.equal(getActiveUpdateBlockers().length, 1);
  a();
  assert.equal(getActiveUpdateBlockers().length, 1);
  assert.equal(getActiveUpdateBlockers()[0]?.reason, UPDATE_BLOCKER_REASONS.generating);
  b();
  assert.deepEqual(getActiveUpdateBlockers(), []);
});

test("integration — read-only fetch equivalent does not register", () => {
  resetUpdateBlockersForTests();
  const release = simulateHook(false, UPDATE_BLOCKER_IDS.directorDelivery, UPDATE_BLOCKER_REASONS.saving);
  assert.equal(release, undefined);
  assert.deepEqual(getActiveUpdateBlockers(), []);
});

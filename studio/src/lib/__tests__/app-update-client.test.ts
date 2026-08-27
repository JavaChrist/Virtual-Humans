import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_UPDATE_SKIP_WAITING,
  APP_VERSION_UNAVAILABLE,
  createAppUpdateSession,
  createMemoryStorage,
  fetchAppVersionInit,
  isNewerAppVersion,
  parseAppVersionPayload,
} from "../app-update-client";
import { resolveAppVersion } from "../app-version";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function payload(over: Parameters<typeof resolveAppVersion>[0] = {}) {
  return resolveAppVersion({ sdkVersion: "1.0.0", gitSha: SHA_A, ...over });
}

test("app-update-client — fetch init no-store omit credentials", () => {
  const init = fetchAppVersionInit();
  assert.equal(init.cache, "no-store");
  assert.equal(init.credentials, "omit");
});

test("app-update-client — baseline sans notification, build identique", async () => {
  const current = payload();
  const session = createAppUpdateSession({
    fetchVersion: async () => current,
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {
      throw new Error("reload");
    },
    storage: createMemoryStorage(),
  });
  await session.poll();
  assert.equal(session.getState().ux, "idle");
  assert.equal(session.getState().baseline?.gitSha, SHA_A);
  await session.poll();
  assert.equal(session.getState().ux, "idle");
});

test("app-update-client — nouveau SHA affiche available si waiting", async () => {
  let n = 0;
  const session = createAppUpdateSession({
    fetchVersion: async () => payload({ gitSha: n++ === 0 ? SHA_A : SHA_B }),
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
    storage: createMemoryStorage(),
  });
  await session.poll();
  session.setWaiting({ postMessage: () => {} });
  await session.poll();
  assert.equal(session.getState().ux, "available");
  assert.equal(isNewerAppVersion(payload(), payload({ gitSha: SHA_B })), true);
});

test("app-update-client — fallback buildId et version seule ignorée", async () => {
  const session = createAppUpdateSession({
    fetchVersion: async () => {
      if (!session.getState().baseline) {
        return resolveAppVersion({ deploymentId: "dpl_old" });
      }
      return resolveAppVersion({ deploymentId: "dpl_new" });
    },
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
    storage: createMemoryStorage(),
  });
  await session.poll();
  await session.poll();
  assert.equal(session.getState().ux, "preparing");

  const vOnly = createAppUpdateSession({
    fetchVersion: async () => {
      if (!vOnly.getState().baseline) {
        return resolveAppVersion({ sdkVersion: "1.0.0" });
      }
      return resolveAppVersion({ sdkVersion: "9.9.9" });
    },
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
    storage: createMemoryStorage(),
  });
  await vOnly.poll();
  await vOnly.poll();
  assert.equal(vOnly.getState().ux, "idle");
});

test("app-update-client — dédup in-flight, hors ligne, erreur réseau", async () => {
  let started = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const session = createAppUpdateSession({
    fetchVersion: async () => {
      started += 1;
      await gate;
      return payload();
    },
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
    storage: createMemoryStorage(),
  });
  const a = session.poll();
  const b = session.poll();
  assert.equal(started, 1);
  release();
  await Promise.all([a, b]);
  assert.equal(started, 1);

  const offline = createAppUpdateSession({
    fetchVersion: async () => payload(),
    isOnline: () => false,
    getBlockers: () => [],
    reload: () => {},
  });
  await offline.poll();
  assert.equal(offline.getState().ux, "offline");

  const failing = createAppUpdateSession({
    fetchVersion: async () => {
      throw new Error("network");
    },
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
  });
  await failing.poll();
  assert.equal(failing.getState().ux, "check-error");
});

test("app-update-client — Plus tard mémorisé, nouveau build notifie", async () => {
  let sha = SHA_A;
  const storage = createMemoryStorage();
  const session = createAppUpdateSession({
    fetchVersion: async () => payload({ gitSha: sha }),
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
    storage,
  });
  await session.poll();
  session.setWaiting({ postMessage: () => {} });
  sha = SHA_B;
  await session.poll();
  assert.equal(session.getState().ux, "available");
  session.defer();
  assert.equal(session.getState().ux, "deferred");
  session.setWaiting({ postMessage: () => {} });
  await session.poll();
  assert.equal(session.getState().ux, "deferred");
  sha = "cccccccccccccccccccccccccccccccccccccccc";
  session.setWaiting({ postMessage: () => {} });
  await session.poll();
  assert.equal(session.getState().ux, "available");
});

test("app-update-client — blocker empêche apply, SKIP_WAITING une fois, reload une fois", async () => {
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
    getBlockers: () => [{ id: "gen", reason: "Génération en cours" }],
    reload: () => {
      reloads += 1;
    },
    storage: createMemoryStorage(),
    skipWaiting: (w) => w.postMessage(APP_UPDATE_SKIP_WAITING),
  });
  await session.poll();
  session.setWaiting(worker);
  assert.equal(await session.apply(), false);
  assert.equal(session.getState().ux, "blocked");
  assert.equal(skips, 0);
  assert.equal(reloads, 0);

  const ok = createAppUpdateSession({
    fetchVersion: async () => payload(),
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {
      reloads += 1;
    },
    skipWaiting: (w) => w.postMessage(APP_UPDATE_SKIP_WAITING),
  });
  await ok.poll();
  ok.setWaiting(worker);
  assert.equal(await ok.apply(), true);
  assert.equal(await ok.apply(), false);
  assert.equal(skips, 1);
  ok.onControllerChange();
  ok.onControllerChange();
  assert.equal(reloads, 1);
});

test("app-update-client — apply sans waiting recharge une fois, pas de skip", async () => {
  let reloads = 0;
  const session = createAppUpdateSession({
    fetchVersion: async () => payload({ gitSha: SHA_B }),
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {
      reloads += 1;
    },
  });
  await session.poll();
  assert.equal(await session.apply(), true);
  assert.equal(await session.apply(), false);
  assert.equal(reloads, 1);
  assert.equal(session.getState().skipWaitingSent, false);
});

test("app-update-client — updateRegistration une fois par identité + channel later", async () => {
  let updates = 0;
  let sha = SHA_A;
  const session = createAppUpdateSession({
    fetchVersion: async () => payload({ gitSha: sha }),
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
    storage: createMemoryStorage(),
    updateRegistration: async () => {
      updates += 1;
    },
  });
  await session.poll();
  sha = SHA_B;
  await session.poll();
  await session.poll();
  assert.equal(updates, 1);
  session.handleChannel({ type: "later", identity: SHA_B });
  assert.equal(session.getState().ux, "deferred");
});

test("app-update-client — SW absent: version-only path, parse invalide", async () => {
  const session = createAppUpdateSession({
    fetchVersion: async () => payload({ gitSha: SHA_B }),
    isOnline: () => true,
    getBlockers: () => [],
    reload: () => {},
    storage: createMemoryStorage(),
  });
  await session.poll();
  assert.equal(session.getState().waiting, false);
  assert.equal(parseAppVersionPayload({ secret: "nope" }), null);
  assert.equal(APP_VERSION_UNAVAILABLE, "unavailable");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canUseDurableAssetContent,
  resolveAssetContentBackend,
  wantsE2eProcessMemory,
} from "../asset-content-backend";
import { createMemoryAssetContentPort } from "@/application/postproduction/asset-content-port";

const LOCAL = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-real",
  DIRECTOR_V2_ENABLED: "1",
  DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
};

test("Production + mémoire demandée → refus (pas de memory)", () => {
  const env = {
    ...LOCAL,
    NODE_ENV: "production",
    VERCEL: "1",
    DIRECTOR_V2_E2E_FAKE_MODE: "1",
    DIRECTOR_V2_E2E_HARNESS: "1",
  };
  assert.equal(wantsE2eProcessMemory(env), false);
  const backend = resolveAssetContentBackend({
    env,
    // no client → durable requested but fail-closed unconfigured without client
  });
  assert.equal(backend.configured, false);
});

test("local E2E fake sans ASSET_STORAGE → mémoire", () => {
  const env = {
    ...LOCAL,
    NODE_ENV: "development",
    DIRECTOR_V2_E2E_FAKE_MODE: "1",
    DIRECTOR_V2_E2E_HARNESS: "1",
  };
  assert.equal(wantsE2eProcessMemory(env), true);
  const mem = createMemoryAssetContentPort();
  const backend = resolveAssetContentBackend({ env, memoryPort: mem });
  assert.equal(backend.configured, true);
  assert.equal(backend, mem);
});

test("persistence + credentials → pas de durable (persistence seule insuffisante)", () => {
  assert.equal(canUseDurableAssetContent(LOCAL), false);
  const backend = resolveAssetContentBackend({ env: LOCAL });
  // Local fake memory may be selected; durable Storage is not.
  assert.equal(canUseDurableAssetContent(LOCAL), false);
  assert.ok(backend);
});

test("configuration absente → fail-closed", () => {
  const backend = resolveAssetContentBackend({
    env: { NODE_ENV: "production", VERCEL: "1" },
  });
  assert.equal(backend.configured, false);
});

test("E2E ASSET_STORAGE=1 sur localhost → durable demandé", () => {
  const env = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-real",
    NODE_ENV: "development",
    DIRECTOR_V2_E2E_FAKE_MODE: "1",
    DIRECTOR_V2_E2E_HARNESS: "1",
    DIRECTOR_V2_E2E_ASSET_STORAGE: "1",
  };
  assert.equal(wantsE2eProcessMemory(env), false);
  assert.equal(canUseDurableAssetContent(env), true);
});

test("hostile: Vercel production + E2E fake + ASSET_STORAGE=0 → mémoire refusée", () => {
  const env = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-real",
    VERCEL: "1",
    VERCEL_ENV: "production",
    DIRECTOR_V2_E2E_FAKE_MODE: "1",
    DIRECTOR_V2_E2E_ASSET_STORAGE: "0",
    NODE_ENV: "production",
  };
  assert.equal(wantsE2eProcessMemory(env), false);
  const backend = resolveAssetContentBackend({
    env,
    memoryPort: createMemoryAssetContentPort(),
  });
  // Durable not selected without persistence flag; memory blocked by Vercel gate.
  assert.equal(backend.configured, false);
});

test("ASSET_STORAGE=yes (non strict) n'active pas le durable E2E", () => {
  const env = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key-not-real",
    NODE_ENV: "development",
    DIRECTOR_V2_E2E_FAKE_MODE: "1",
    DIRECTOR_V2_E2E_HARNESS: "1",
    DIRECTOR_V2_E2E_ASSET_STORAGE: "yes",
  };
  assert.equal(canUseDurableAssetContent(env), false);
  assert.equal(wantsE2eProcessMemory(env), true);
});

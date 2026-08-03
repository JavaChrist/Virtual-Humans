import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertLocalFakeDeliveryAllowed,
  canUseProcessLocalFakeAssetContent,
} from "../local-fake-delivery";

test("local fake delivery — allowed for localhost Supabase in development", () => {
  const env = {
    NODE_ENV: "development",
    SUPABASE_URL: "http://127.0.0.1:54321",
  };
  assert.equal(canUseProcessLocalFakeAssetContent(env), true);
  assert.equal(assertLocalFakeDeliveryAllowed(env).ok, true);
});

test("local fake delivery — refused on Vercel", () => {
  const check = assertLocalFakeDeliveryAllowed({
    NODE_ENV: "production",
    VERCEL: "1",
    SUPABASE_URL: "http://127.0.0.1:54321",
    DIRECTOR_V2_E2E_HARNESS: "1",
  });
  assert.equal(check.ok, false);
  if (!check.ok) assert.equal(check.reason, "vercel");
});

test("local fake delivery — refused for remote Supabase", () => {
  const check = assertLocalFakeDeliveryAllowed({
    NODE_ENV: "development",
    SUPABASE_URL: "https://abcdefgh.supabase.co",
  });
  assert.equal(check.ok, false);
  if (!check.ok) assert.equal(check.reason, "non_local_supabase");
});

test("local fake delivery — refused in production without E2E harness", () => {
  const check = assertLocalFakeDeliveryAllowed({
    NODE_ENV: "production",
    SUPABASE_URL: "http://127.0.0.1:54321",
  });
  assert.equal(check.ok, false);
  if (!check.ok) assert.equal(check.reason, "production");
});

test("local fake delivery — allowed in production with E2E harness + local Supabase", () => {
  assert.equal(
    canUseProcessLocalFakeAssetContent({
      NODE_ENV: "production",
      DIRECTOR_V2_E2E_HARNESS: "1",
      SUPABASE_URL: "http://127.0.0.1:54321",
    }),
    true,
  );
});

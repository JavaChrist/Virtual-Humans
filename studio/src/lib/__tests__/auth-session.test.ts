import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSessionToken,
  resolveAuthConfig,
  verifyLoginPassword,
  verifySessionToken,
} from "../auth";

const env = {
  APP_PASSWORD: "local-dev-password-ok",
  APP_SESSION_SECRET: "local-dev-session-secret-32chars-min!!",
};

test("create + verify session — happy path", async () => {
  const config = resolveAuthConfig(env);
  assert.equal(config.ok, true);
  const created = await createSessionToken(config, { nowMs: 1_700_000_000_000 });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.match(created.token, /^vh1\./);
  const verified = await verifySessionToken(created.token, config, {
    nowMs: 1_700_000_000_000,
  });
  assert.equal(verified.ok, true);
});

test("session expired refused", async () => {
  const config = resolveAuthConfig(env);
  const created = await createSessionToken(config, {
    nowMs: 1_700_000_000_000,
    ttlSeconds: 60,
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const verified = await verifySessionToken(created.token, config, {
    nowMs: 1_700_000_000_000 + 120_000,
  });
  assert.equal(verified.ok, false);
  if (!verified.ok) assert.equal(verified.reason, "expired");
});

test("tampered signature refused", async () => {
  const config = resolveAuthConfig(env);
  const created = await createSessionToken(config);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const parts = created.token.split(".");
  parts[2] = "a".repeat(64);
  const verified = await verifySessionToken(parts.join("."), config);
  assert.equal(verified.ok, false);
  if (!verified.ok) assert.equal(verified.reason, "bad_signature");
});

test("password rotation invalidates session", async () => {
  const config = resolveAuthConfig(env);
  const created = await createSessionToken(config);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const rotated = resolveAuthConfig({
    APP_PASSWORD: "local-dev-password-rotated",
    APP_SESSION_SECRET: env.APP_SESSION_SECRET,
  });
  assert.equal(rotated.ok, true);
  const verified = await verifySessionToken(created.token, rotated);
  assert.equal(verified.ok, false);
});

test("session secret rotation invalidates session", async () => {
  const config = resolveAuthConfig(env);
  const created = await createSessionToken(config);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const rotated = resolveAuthConfig({
    APP_PASSWORD: env.APP_PASSWORD,
    APP_SESSION_SECRET: "another-dev-session-secret-32chars-min!",
  });
  assert.equal(rotated.ok, true);
  const verified = await verifySessionToken(created.token, rotated);
  assert.equal(verified.ok, false);
});

test("verifyLoginPassword — match / mismatch / config invalid", async () => {
  const config = resolveAuthConfig(env);
  assert.equal(await verifyLoginPassword("local-dev-password-ok", config), true);
  assert.equal(await verifyLoginPassword("wrong-password-xx", config), false);
  assert.equal(
    await verifyLoginPassword("anything", { ok: false, reason: "missing_password" }),
    false,
  );
});

test("token never contains raw password", async () => {
  const config = resolveAuthConfig(env);
  const created = await createSessionToken(config);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.token.includes(env.APP_PASSWORD), false);
  assert.equal(created.token.includes(env.APP_SESSION_SECRET), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveAuthConfig,
  validateAppPassword,
  validateSessionSecret,
} from "../auth-config";

test("APP_PASSWORD absent / empty / short / placeholder refused", () => {
  assert.equal(validateAppPassword(undefined).ok, false);
  assert.equal(validateAppPassword("").ok, false);
  assert.equal(validateAppPassword("short").ok, false);
  assert.equal(validateAppPassword("password").ok, false);
  assert.equal(validateAppPassword("changeme").ok, false);
  assert.equal(validateAppPassword("un-mot-de-passe-solide").ok, false);
  assert.equal(validateAppPassword("local-dev-password-ok").ok, true);
});

test("APP_SESSION_SECRET absent / short / placeholder refused", () => {
  assert.equal(validateSessionSecret(undefined).ok, false);
  assert.equal(validateSessionSecret("too-short").ok, false);
  assert.equal(validateSessionSecret("a".repeat(32)).ok, false);
  assert.equal(
    validateSessionSecret("local-dev-session-secret-32chars-min!!").ok,
    true,
  );
});

test("resolveAuthConfig fail-closed without either secret", () => {
  assert.equal(resolveAuthConfig({}).ok, false);
  assert.equal(
    resolveAuthConfig({ APP_PASSWORD: "local-dev-password-ok" }).ok,
    false,
  );
  assert.equal(
    resolveAuthConfig({
      APP_SESSION_SECRET: "local-dev-session-secret-32chars-min!!",
    }).ok,
    false,
  );
  const ok = resolveAuthConfig({
    APP_PASSWORD: "local-dev-password-ok",
    APP_SESSION_SECRET: "local-dev-session-secret-32chars-min!!",
  });
  assert.equal(ok.ok, true);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkRateLimit,
  createMemoryRateLimitStore,
  rateLimitClientKey,
} from "../rate-limit";

test("allows under limit then blocks with Retry-After", () => {
  const store = createMemoryRateLimitStore();
  const policy = { limit: 3, windowMs: 60_000 };
  const now = 1_000_000;
  assert.equal(checkRateLimit("k", policy, { store, now }).ok, true);
  assert.equal(checkRateLimit("k", policy, { store, now: now + 1 }).ok, true);
  assert.equal(checkRateLimit("k", policy, { store, now: now + 2 }).ok, true);
  const blocked = checkRateLimit("k", policy, { store, now: now + 3 });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.ok(blocked.retryAfterSeconds >= 1);
  }
});

test("window expiry resets counter", () => {
  const store = createMemoryRateLimitStore();
  const policy = { limit: 1, windowMs: 1000 };
  const now = 5_000;
  assert.equal(checkRateLimit("w", policy, { store, now }).ok, true);
  assert.equal(checkRateLimit("w", policy, { store, now: now + 10 }).ok, false);
  assert.equal(checkRateLimit("w", policy, { store, now: now + 1001 }).ok, true);
});

test("rateLimitClientKey strips junk and bounds length", () => {
  assert.equal(rateLimitClientKey("1.2.3.4, 9.9.9.9"), "1.2.3.4");
  assert.equal(rateLimitClientKey("evil<script>"), "evilscript");
  assert.ok(rateLimitClientKey("x".repeat(200)).length <= 64);
});

test("keys must not look like secrets (no raw password echo)", () => {
  const key = rateLimitClientKey("127.0.0.1");
  assert.equal(key.includes("APP_PASSWORD"), false);
  assert.equal(key.includes("secret"), false);
});

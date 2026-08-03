import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCsrf, isMutatingMethod } from "../csrf";

test("isMutatingMethod", () => {
  assert.equal(isMutatingMethod("POST"), true);
  assert.equal(isMutatingMethod("GET"), false);
});

test("Origin matching Host accepted", () => {
  const r = assertCsrf(
    {
      origin: "https://studio.example.com",
      host: "studio.example.com",
    },
    { requireOrigin: true },
  );
  assert.equal(r.ok, true);
});

test("foreign Origin refused", () => {
  const r = assertCsrf(
    {
      origin: "https://evil.example",
      host: "studio.example.com",
    },
    { requireOrigin: true },
  );
  assert.equal(r.ok, false);
});

test("missing Origin required → refused", () => {
  const r = assertCsrf({ host: "studio.example.com" }, { requireOrigin: true });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "origin_required");
});

test("missing Origin optional → accepted", () => {
  const r = assertCsrf({ host: "studio.example.com" }, { requireOrigin: false });
  assert.equal(r.ok, true);
});

test("Referer fallback when Origin absent", () => {
  const r = assertCsrf(
    {
      referer: "https://studio.example.com/director",
      host: "studio.example.com",
    },
    { requireOrigin: true },
  );
  assert.equal(r.ok, true);
});

test("Origin null refused", () => {
  const r = assertCsrf(
    { origin: "null", host: "studio.example.com" },
    { requireOrigin: true },
  );
  assert.equal(r.ok, false);
});

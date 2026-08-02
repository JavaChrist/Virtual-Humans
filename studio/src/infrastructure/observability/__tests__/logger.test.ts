import assert from "node:assert/strict";
import { test } from "node:test";
import { createLogContext } from "../correlation";
import { createLogger, formatLogEntry, formatLogLine } from "../logger";
import { REDACTED } from "../redact";

const SECRET = "sk-supersecretkeyvalue999";

test("formatLogEntry produces structured fields", () => {
  const ctx = createLogContext("corr-test-00123456", {
    route: "/api/estimate",
    operation: "estimate.post",
  });
  const entry = formatLogEntry("info", "route.success", ctx, { status: 200 });
  assert.equal(entry.level, "info");
  assert.equal(entry.event, "route.success");
  assert.equal(entry.correlationId, "corr-test-00123456");
  assert.equal(entry.route, "/api/estimate");
  assert.equal(entry.operation, "estimate.post");
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(entry.data, { status: 200 });
});

test("incomplete context still serializes with correlationId", () => {
  const ctx = createLogContext("corr-only-99999999");
  const entry = formatLogEntry("warn", "route.client_error", ctx);
  assert.equal(entry.correlationId, "corr-only-99999999");
  assert.equal(entry.route, undefined);
  assert.equal(entry.projectId, undefined);
});

test("logger redacts secrets in data and never leaks a known secret in the line", () => {
  const lines: string[] = [];
  const log = createLogger((line) => lines.push(line));
  const ctx = createLogContext("corr-sec-abcdef12", { route: "/api/settings" });
  log.info("probe", ctx, {
    openaiApiKey: SECRET,
    nested: { authorization: `Bearer ${SECRET}` },
    prompt: "should not appear in full",
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes(SECRET), false);
  const parsed = JSON.parse(lines[0]) as { data: Record<string, unknown> };
  assert.equal(parsed.data.openaiApiKey, REDACTED);
  assert.equal((parsed.data.nested as Record<string, unknown>).authorization, REDACTED);
  assert.equal(parsed.data.prompt, REDACTED);
});

test("logger.error distinguishes publicMessage and diagnostic", () => {
  const ctx = createLogContext("corr-err-abcdef12", { operation: "generate.image" });
  const entry = formatLogEntry("error", "route.failure", ctx, { size: "1024x1024" }, new Error("fail"));
  assert.equal(entry.publicMessage, "fail");
  assert.ok(entry.diagnostic);
  assert.deepEqual(entry.data, { size: "1024x1024" });
});

test("error messages containing secrets are not exposed publicly", () => {
  const ctx = createLogContext("corr-err-secret001");
  const entry = formatLogEntry(
    "error",
    "route.failure",
    ctx,
    undefined,
    new Error(`Invalid api_key ${SECRET}`),
  );
  assert.equal(entry.publicMessage, "An internal error occurred");
  const line = formatLogLine("error", "route.failure", ctx, undefined, new Error(`token=${SECRET}`));
  assert.equal(line.includes(SECRET), false);
});

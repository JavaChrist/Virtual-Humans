import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { CORRELATION_HEADER, idsFromBody, startObservedRoute } from "../index";

function req(path: string, headers?: Record<string, string>, init?: RequestInit): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body,
  });
}

test("startObservedRoute conserves valid x-correlation-id on response", () => {
  const id = "client-corr-xyz98765";
  const obs = startObservedRoute(req("/api/settings", { [CORRELATION_HEADER]: id }), {
    route: "/api/settings",
    operation: "settings.get",
    logStart: false,
  });
  assert.equal(obs.context.correlationId, id);
  const res = obs.json({ ok: true });
  assert.equal(res.headers.get(CORRELATION_HEADER), id);
});

test("startObservedRoute generates id when header absent", () => {
  const obs = startObservedRoute(req("/api/estimate"), {
    route: "/api/estimate",
    logStart: false,
  });
  assert.match(obs.context.correlationId, /^[0-9a-f-]{36}$/i);
  const res = obs.json({ ok: true }, { status: 200 });
  assert.equal(res.headers.get(CORRELATION_HEADER), obs.context.correlationId);
});

test("startObservedRoute replaces invalid header", () => {
  const obs = startObservedRoute(req("/api/settings", { [CORRELATION_HEADER]: "bad" }), {
    route: "/api/settings",
    logStart: false,
  });
  assert.notEqual(obs.context.correlationId, "bad");
  assert.ok(obs.context.correlationId.length >= 8);
});

test("idsFromBody extracts optional ids without requiring them", () => {
  assert.deepEqual(idsFromBody({ projectId: " p1 ", sceneId: "s1" }), {
    projectId: "p1",
    sceneId: "s1",
  });
  assert.deepEqual(idsFromBody({ type: "image" }), {});
  assert.deepEqual(idsFromBody(null), {});
});

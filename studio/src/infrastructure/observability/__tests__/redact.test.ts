import assert from "node:assert/strict";
import { test } from "node:test";
import { REDACTED, redact } from "../redact";

test("redacts inline data URLs by value and by key", () => {
  const dataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const out = redact({
    note: "safe",
    dataUrl,
    nested: { inlineDataUrl: dataUrl },
    bare: dataUrl,
  }) as {
    note: string;
    dataUrl: string;
    nested: { inlineDataUrl: string };
    bare: string;
  };
  assert.equal(out.note, "safe");
  assert.equal(out.dataUrl, REDACTED);
  assert.equal(out.nested.inlineDataUrl, REDACTED);
  assert.equal(out.bare, REDACTED);
  assert.equal(JSON.stringify(out).includes("base64"), false);
});

test("redacts sensitive keys at multiple levels", () => {
  const input = {
    ok: true,
    nested: {
      apiKey: "sk-secret-value-123456",
      falKey: "fal_abc1234567890",
      openaiApiKey: "sk-openai-xxxx",
      elevenlabsApiKey: "el-xxxx",
      serviceRoleKey: "service-role-secret",
      supabaseServiceRoleKey: "sb-secret",
      authorization: "Bearer abc",
      cookie: "vh_auth=xxx",
      password: "hunter2",
      appPassword: "app-secret",
      token: "tok",
      accessToken: "at",
      refreshToken: "rt",
      secret: "s",
    },
  };
  const out = redact(input) as typeof input;
  assert.equal(out.ok, true);
  for (const key of Object.keys(input.nested)) {
    assert.equal((out.nested as Record<string, unknown>)[key], REDACTED, key);
  }
});

test("redacts sensitive keys regardless of case / separators", () => {
  const out = redact({
    API_KEY: "x",
    "Set-Cookie": "a=b",
    Access_Token: "t",
  }) as Record<string, unknown>;
  assert.equal(out.API_KEY, REDACTED);
  assert.equal(out["Set-Cookie"], REDACTED);
  assert.equal(out.Access_Token, REDACTED);
});

test("redacts arrays without mutating the original", () => {
  const input = [{ token: "secret-token-value", n: 1 }, { n: 2 }];
  const copy = structuredClone(input);
  const out = redact(input) as Array<Record<string, unknown>>;
  assert.equal(out[0].token, REDACTED);
  assert.equal(out[0].n, 1);
  assert.deepEqual(input, copy);
});

test("handles circular references", () => {
  const a: Record<string, unknown> = { name: "a" };
  a.self = a;
  const out = redact(a) as Record<string, unknown>;
  assert.equal(out.name, "a");
  assert.equal(out.self, "[Circular]");
});

test("serializes Error objects safely", () => {
  const err = new Error("boom with sk-abcdefghijklmnopqrstuv");
  const out = redact(err) as { name: string; message: string };
  assert.equal(out.name, "Error");
  assert.equal(out.message, REDACTED);
});

test("redacts signed URLs and secret-like strings", () => {
  const signed =
    "https://storage.example.com/file.png?X-Amz-Signature=abcdef0123456789&X-Amz-Credential=AKIA";
  const out = redact({
    url: signed,
    rawKey: "sk-abcdefghijklmnopqrstuvwxyz012345",
    bearer: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
  }) as Record<string, unknown>;
  assert.equal(out.url, REDACTED);
  assert.equal(out.rawKey, REDACTED);
  assert.equal(out.bearer, REDACTED);
});

test("never logs full prompts / scripts / dialogues", () => {
  const out = redact({
    prompt: "Photorealistic portrait of a person saying secret stuff",
    script: "Long voice-over script",
    dialogue: "Hello world",
    line: "CTA line",
    meta: { size: "1024x1024" },
  }) as Record<string, unknown>;
  assert.equal(out.prompt, REDACTED);
  assert.equal(out.script, REDACTED);
  assert.equal(out.dialogue, REDACTED);
  assert.equal(out.line, REDACTED);
  assert.deepEqual(out.meta, { size: "1024x1024" });
});

test("never logs full brief CTA / audience / brand fields", () => {
  const out = redact({
    callToAction: "Achetez maintenant",
    audienceDescription: "Parents urbains 25-40",
    brandConstraints: "Pas de rouge",
    subjectDescription: "Produit secret",
    projectId: "11111111-1111-4111-8111-111111111111",
  }) as Record<string, unknown>;
  assert.equal(out.callToAction, REDACTED);
  assert.equal(out.audienceDescription, REDACTED);
  assert.equal(out.brandConstraints, REDACTED);
  assert.equal(out.subjectDescription, REDACTED);
  assert.equal(out.projectId, "11111111-1111-4111-8111-111111111111");
});

test("does not mutate nested objects", () => {
  const input = { outer: { password: "secret", keep: 1 } };
  const before = JSON.stringify(input);
  redact(input);
  assert.equal(JSON.stringify(input), before);
});

test("bounds depth and keeps incomplete context usable", () => {
  const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: "end" } } } } } } } } };
  const out = redact(deep, { maxDepth: 3 }) as Record<string, unknown>;
  const a = out.a as Record<string, unknown>;
  const b = a.b as Record<string, unknown>;
  assert.equal(b.c, "[MaxDepth]");
});

test("incomplete context object is preserved (optional fields)", () => {
  const out = redact({ correlationId: "a1b2c3d4-e5f6-4789-abcd-ef1234567890", route: "/api/x" }) as {
    correlationId: string;
    route: string;
  };
  assert.equal(out.correlationId, "a1b2c3d4-e5f6-4789-abcd-ef1234567890");
  assert.equal(out.route, "/api/x");
});

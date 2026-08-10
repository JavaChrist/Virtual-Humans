import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertDevSupabaseTargetAllowed,
  classifySupabaseTarget,
  requireDevSupabaseTargetAllowed,
  DevSupabaseTargetError,
} from "../supabase-target-guard";

test("classify — missing", () => {
  assert.deepEqual(classifySupabaseTarget({}), { kind: "missing", host: null });
});

test("classify — local hosts", () => {
  assert.equal(
    classifySupabaseTarget({ SUPABASE_URL: "http://127.0.0.1:54921" }).kind,
    "local",
  );
  assert.equal(
    classifySupabaseTarget({ SUPABASE_URL: "http://localhost:54921" }).kind,
    "local",
  );
});

test("classify — remote supabase.co", () => {
  const c = classifySupabaseTarget({
    SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
  });
  assert.equal(c.kind, "remote_supabase");
  assert.equal(c.host, "ejdbksxaswhdtsudnmvi.supabase.co");
});

test("guard — allows local without opt-in", () => {
  const r = assertDevSupabaseTargetAllowed({
    SUPABASE_URL: "http://127.0.0.1:54921",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.mode, "local");
});

test("guard — refuses remote outside Vercel without allow", () => {
  const r = assertDevSupabaseTargetAllowed({
    SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
    NODE_ENV: "development",
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "remote_without_allow");
    assert.match(r.publicMessage, /VH_ALLOW_REMOTE_SUPABASE/);
  }
});

test("guard — NODE_ENV=production alone does not authorize remote", () => {
  const r = assertDevSupabaseTargetAllowed({
    SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
    NODE_ENV: "production",
  });
  assert.equal(r.ok, false);
});

test("guard — Vercel may use remote without opt-in", () => {
  const r = assertDevSupabaseTargetAllowed({
    SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
    VERCEL: "1",
    VERCEL_ENV: "production",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.mode, "vercel");
});

test("guard — explicit VH_ALLOW_REMOTE_SUPABASE=1 allows remote locally", () => {
  const r = assertDevSupabaseTargetAllowed({
    SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
    VH_ALLOW_REMOTE_SUPABASE: "1",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.mode, "remote_explicit");
});

test("guard — VH_ALLOW_REMOTE_SUPABASE=0 does not allow", () => {
  const r = assertDevSupabaseTargetAllowed({
    SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
    VH_ALLOW_REMOTE_SUPABASE: "0",
  });
  assert.equal(r.ok, false);
});

test("require — throws typed error without leaking URL path/secrets", () => {
  assert.throws(
    () =>
      requireDevSupabaseTargetAllowed({
        SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co/secret-path",
      }),
    (err: unknown) => {
      assert.ok(err instanceof DevSupabaseTargetError);
      assert.equal(err.host, "ejdbksxaswhdtsudnmvi.supabase.co");
      assert.doesNotMatch(err.message, /secret-path/);
      return true;
    },
  );
});

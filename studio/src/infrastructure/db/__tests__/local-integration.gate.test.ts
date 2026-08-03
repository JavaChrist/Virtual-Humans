/**
 * Unit tests for the local-only Supabase gate (no Docker required).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLocalSupabaseGate } from "../local-integration.gate";

test("gate — refuse hôte non local", () => {
  const g = resolveLocalSupabaseGate({
    SUPABASE_LOCAL_INTEGRATION: "1",
    SUPABASE_LOCAL_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
    SUPABASE_LOCAL_SERVICE_ROLE_KEY: "fake",
  });
  assert.equal(g.ok, false);
  if (!g.ok) assert.match(g.reason, /n'est pas local/);
});

test("gate — accepte localhost explicite", () => {
  const g = resolveLocalSupabaseGate({
    SUPABASE_LOCAL_INTEGRATION: "1",
    SUPABASE_LOCAL_URL: "http://127.0.0.1:54321",
    SUPABASE_LOCAL_SERVICE_ROLE_KEY: "local-test-key",
  });
  assert.equal(g.ok, true);
});

test("gate — off par défaut", () => {
  const g = resolveLocalSupabaseGate({});
  assert.equal(g.ok, false);
});

test("gate — jamais de fallback vers SUPABASE_URL distant", () => {
  const g = resolveLocalSupabaseGate({
    SUPABASE_LOCAL_INTEGRATION: "1",
    SUPABASE_URL: "https://ejdbksxaswhdtsudnmvi.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "remote-fake",
  });
  assert.equal(g.ok, false);
  if (!g.ok) assert.match(g.reason, /SUPABASE_LOCAL_/);
});

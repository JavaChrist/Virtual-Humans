import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertDirectorE2eFakeMode,
  isDirectorE2eFakeMode,
} from "../e2e-fake-mode";

const base = {
  DIRECTOR_V2_E2E_FAKE_MODE: "1",
  NODE_ENV: "development",
  SUPABASE_URL: "http://127.0.0.1:54321",
  OPENAI_API_KEY: "",
  FAL_KEY: "",
  ELEVENLABS_API_KEY: "",
  AICCOS_IMPORT_TOKEN: "",
};

test("e2e fake mode — off par défaut", () => {
  assert.equal(isDirectorE2eFakeMode({}), false);
  const r = assertDirectorE2eFakeMode({});
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "disabled");
});

test("e2e fake mode — ok localhost sans clés", () => {
  const r = assertDirectorE2eFakeMode(base);
  assert.equal(r.ok, true);
});

test("e2e fake mode — refuse production sans harness", () => {
  const r = assertDirectorE2eFakeMode({ ...base, NODE_ENV: "production" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "production");
});

test("e2e fake mode — production + harness local OK ; Vercel refusé", () => {
  const ok = assertDirectorE2eFakeMode({
    ...base,
    NODE_ENV: "production",
    DIRECTOR_V2_E2E_HARNESS: "1",
  });
  assert.equal(ok.ok, true);
  const vercel = assertDirectorE2eFakeMode({
    ...base,
    NODE_ENV: "production",
    DIRECTOR_V2_E2E_HARNESS: "1",
    VERCEL: "1",
  });
  assert.equal(vercel.ok, false);
});

test("e2e fake mode — refuse Supabase non local", () => {
  const r = assertDirectorE2eFakeMode({
    ...base,
    SUPABASE_URL: "https://xyz.supabase.co",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "non_local_supabase");
});

test("e2e fake mode — refuse clé provider", () => {
  const r = assertDirectorE2eFakeMode({
    ...base,
    OPENAI_API_KEY: "sk-test-not-allowed",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "provider_key_present");
});

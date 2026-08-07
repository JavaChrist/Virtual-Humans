import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_OPENAI_ART_TIMEOUT_MS,
  OPENAI_ART_TIMEOUT_MS_MAX,
  parseOpenAIArtConfig,
} from "../config";

test("OPENAI_ART_TIMEOUT_MS=120000 respecté (borne max)", () => {
  const cfg = parseOpenAIArtConfig({
    OPENAI_API_KEY: "sk-test",
    OPENAI_ART_TIMEOUT_MS: "120000",
  });
  assert.equal(cfg.timeoutMs, 120_000);
  assert.equal(cfg.timeoutMs, OPENAI_ART_TIMEOUT_MS_MAX);
});

test("OPENAI_ART_TIMEOUT_MS au-delà du max est borné", () => {
  const cfg = parseOpenAIArtConfig({
    OPENAI_API_KEY: "sk-test",
    OPENAI_ART_TIMEOUT_MS: "999999",
  });
  assert.equal(cfg.timeoutMs, OPENAI_ART_TIMEOUT_MS_MAX);
});

test("OPENAI_ART_TIMEOUT_MS défaut 60000", () => {
  const cfg = parseOpenAIArtConfig({
    OPENAI_API_KEY: "sk-test",
  });
  assert.equal(cfg.timeoutMs, DEFAULT_OPENAI_ART_TIMEOUT_MS);
});

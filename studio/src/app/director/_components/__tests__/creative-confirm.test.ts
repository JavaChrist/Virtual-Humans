import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCreativeExecuteConfirmMessage } from "../creative-confirm";

test("modale Creative — message issu du dry-run courant", () => {
  const msg = buildCreativeExecuteConfirmMessage({
    model: "gpt-5.6",
    reasoningEffort: "medium",
    maxOutputTokens: 4096,
    estimatedCostMinor: 12,
    currency: "USD",
    confidence: "list",
    briefRevision: 1,
    marketingPlanRevision: 1,
    promptVersion: "creative-analyzer-v4",
    schemaVersion: "1.1.0",
    durationSeconds: 30,
    maxBeats: 5,
  });
  assert.match(msg, /payant/i);
  assert.match(msg, /gpt-5\.6/);
  assert.match(msg, /medium/);
  assert.match(msg, /4096/);
  assert.match(msg, /0\.12 USD/);
  assert.match(msg, /creative-analyzer-v4/);
  assert.match(msg, /Schema : 1\.1\.0/);
  assert.match(msg, /Durée : 30s · maxBeats : 5/);
  assert.match(msg, /Brief rev\. 1/);
  assert.match(msg, /Marketing Plan rev\. 1/);
  assert.match(msg, /Aucun retry automatique/);
  assert.equal(msg.includes("terra"), false);
});

test("modale Creative — estimation indisponible sans hard-code de coût", () => {
  const msg = buildCreativeExecuteConfirmMessage({
    model: "model-x",
    reasoningEffort: "low",
    maxOutputTokens: 1600,
    briefRevision: 2,
    marketingPlanRevision: 3,
    promptVersion: "creative-analyzer-v4",
  });
  assert.match(msg, /Estimation : indisponible/);
  assert.match(msg, /model-x/);
  assert.match(msg, /1600/);
});

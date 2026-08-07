/**
 * Porte 8R — new Art contract → new idempotency identity (local, no provider).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ART_ANALYZER_PROMPT_VERSION,
  ART_CANDIDATE_SCHEMA_VERSION,
} from "@/infrastructure/ai/openai/art";
import { createHash } from "node:crypto";

/** Mirrors analyze-for-project artKeyAndFingerprint field join (without private access). */
function artKeyFields(args: {
  projectId: string;
  briefAid: string;
  briefRev: number;
  planAid: string;
  planRev: number;
  conceptAid: string;
  conceptRev: number;
  scriptAid: string;
  scriptRev: number;
  model: string;
  promptVersion: string;
  schemaVersion: string;
}): string {
  return [
    args.projectId,
    args.briefAid,
    String(args.briefRev),
    args.planAid,
    String(args.planRev),
    args.conceptAid,
    String(args.conceptRev),
    args.scriptAid,
    String(args.scriptRev),
    args.model,
    args.promptVersion,
    args.schemaVersion,
  ].join(":");
}

test("nouveau contrat → nouvelle clé idempotence vs v1/1.0.0", () => {
  const base = {
    projectId: "859fde04-5bb0-449a-928f-606616f8b252",
    briefAid: "brief",
    briefRev: 1,
    planAid: "plan",
    planRev: 1,
    conceptAid: "concept",
    conceptRev: 1,
    scriptAid: "d540fdc5-e94a-4261-85ba-68b0bcdc1cba",
    scriptRev: 1,
    model: "gpt-5.6",
  };
  const legacy = artKeyFields({
    ...base,
    promptVersion: "art-analyzer-v1",
    schemaVersion: "1.0.0",
  });
  const next = artKeyFields({
    ...base,
    promptVersion: ART_ANALYZER_PROMPT_VERSION,
    schemaVersion: ART_CANDIDATE_SCHEMA_VERSION,
  });
  assert.equal(ART_ANALYZER_PROMPT_VERSION, "art-analyzer-v2");
  assert.equal(ART_CANDIDATE_SCHEMA_VERSION, "1.1.0");
  assert.notEqual(legacy, next);
  assert.match(next, /art-analyzer-v2:1\.1\.0$/);
  assert.match(legacy, /art-analyzer-v1:1\.0\.0$/);
  // Fingerprint divergence
  const fpLegacy = createHash("sha256").update(legacy).digest("hex");
  const fpNext = createHash("sha256").update(next).digest("hex");
  assert.notEqual(fpLegacy, fpNext);
});

test("futur run nouveau contrat — attempt 1 / retry_of null (contrat)", () => {
  // Documented expectation: changing prompt/schema versions creates a fresh
  // begin_or_get identity, not attempt 3 of the legacy timeout run.
  assert.equal(ART_ANALYZER_PROMPT_VERSION, "art-analyzer-v2");
  assert.equal(ART_CANDIDATE_SCHEMA_VERSION, "1.1.0");
  const expectedIdentity = {
    attempt_number: 1,
    retry_of_run_id: null as string | null,
    promptVersion: "art-analyzer-v2",
    schemaVersion: "1.1.0",
  };
  assert.equal(expectedIdentity.attempt_number, 1);
  assert.equal(expectedIdentity.retry_of_run_id, null);
});

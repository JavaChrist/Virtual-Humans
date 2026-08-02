import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARTIFACT_METADATA_SCHEMA_VERSION,
  createArtifactMetadata,
  parseArtifactMetadata,
  safeParseArtifactMetadata,
} from "../artifact";
import { centsToUsd, usdToCents } from "../units";

const valid = {
  id: "art_01",
  projectId: "proj_01",
  schemaVersion: "1.0.0",
  revision: 1,
  createdAt: "2026-08-02T12:00:00.000Z",
  createdBy: "user_01",
  correlationId: "corr_01",
};

test("parseArtifactMetadata accepts a valid payload", () => {
  const meta = parseArtifactMetadata(valid);
  assert.equal(meta.id, "art_01");
  assert.equal(meta.revision, 1);
  assert.equal(meta.schemaVersion, ARTIFACT_METADATA_SCHEMA_VERSION);
});

test("safeParseArtifactMetadata rejects missing correlationId", () => {
  const rest = {
    id: valid.id,
    projectId: valid.projectId,
    schemaVersion: valid.schemaVersion,
    revision: valid.revision,
    createdAt: valid.createdAt,
    createdBy: valid.createdBy,
  };
  const result = safeParseArtifactMetadata(rest);
  assert.equal(result.success, false);
});

test("safeParseArtifactMetadata rejects invalid schemaVersion", () => {
  const result = safeParseArtifactMetadata({ ...valid, schemaVersion: "v1" });
  assert.equal(result.success, false);
});

test("safeParseArtifactMetadata rejects revision 0", () => {
  const result = safeParseArtifactMetadata({ ...valid, revision: 0 });
  assert.equal(result.success, false);
});

test("createArtifactMetadata fills defaults", () => {
  const meta = createArtifactMetadata({
    id: "art_02",
    projectId: "proj_01",
    createdBy: "user_01",
    correlationId: "corr_02",
  });
  assert.equal(meta.revision, 1);
  assert.equal(meta.schemaVersion, "1.0.0");
  assert.match(meta.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("usdToCents and centsToUsd round-trip indicative estimates", () => {
  assert.equal(usdToCents(0.28), 28);
  assert.equal(usdToCents(1.5), 150);
  assert.equal(centsToUsd(28), 0.28);
  assert.throws(() => usdToCents(-1));
});

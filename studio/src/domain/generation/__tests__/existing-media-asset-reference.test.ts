/**
 * ExistingMediaAssetReference — generic contract (no Phase 11A UUID in the engine).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXISTING_MEDIA_ASSET_REFERENCE_VERSION,
  assertExistingMediaAssetMayStayInactive,
  assertExistingMediaAssetReferenceMatchesFacts,
  createExistingMediaAssetReference,
  fingerprintExistingMediaAssetReference,
  type ExistingMediaAssetFacts,
} from "../existing-media-asset-reference";

const WS = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const ASSET = "33333333-3333-4333-8333-333333333333";
const CHECKSUM = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function baseInput() {
  return {
    workspaceId: WS,
    projectId: PROJECT,
    assetId: ASSET,
    expectedChecksum: CHECKSUM,
    expectedMimeType: "image/png",
    expectedWidth: 1024,
    expectedHeight: 1024,
    sourceRole: "i2v_start_frame",
    sourceSceneId: "scene-2",
    expectedStoragePath: `${WS}/${PROJECT}/media/image/composed/${ASSET}.png`,
    humanReviewDecisionId: "44444444-4444-4444-8444-444444444444",
  };
}

function factsFrom(ref = createExistingMediaAssetReference(baseInput())): ExistingMediaAssetFacts {
  return {
    workspaceId: ref.workspaceId,
    projectId: ref.projectId,
    assetId: ref.assetId,
    checksum: ref.expectedChecksum,
    mimeType: ref.expectedMimeType,
    width: ref.expectedWidth,
    height: ref.expectedHeight,
    lifecycle: "approved",
    sourceKind: "internal",
    storagePath: ref.expectedStoragePath,
    bucketPrivate: true,
    active: false,
    humanReviewDecision: "approved",
  };
}

test("ExistingMediaAssetReference — versioned, frozen, deterministic fingerprint", () => {
  const a = createExistingMediaAssetReference(baseInput());
  const b = createExistingMediaAssetReference(baseInput());
  assert.equal(a.referenceVersion, EXISTING_MEDIA_ASSET_REFERENCE_VERSION);
  assert.equal(a.expectedLifecycle, "approved");
  assert.equal(a.requiredHumanApproval, true);
  assert.equal(a.sourceKind, "internal");
  assert.equal(a.activeAllowed, false);
  assert.equal(a.provenanceFingerprint, b.provenanceFingerprint);
  assert.equal(a.provenanceFingerprint, fingerprintExistingMediaAssetReference(a));
  assert.ok(Object.isFrozen(a));
  assert.throws(() => {
    (a as { assetId: string }).assetId = "00000000-0000-4000-8000-000000000000";
  });
});

test("ExistingMediaAssetReference — rejects URL / base64 / token", () => {
  assert.throws(
    () =>
      createExistingMediaAssetReference({
        ...baseInput(),
        expectedStoragePath: `${WS}/${PROJECT}/https://example.com/x.png`,
      }),
    /URL|internal/,
  );
  assert.throws(
    () =>
      createExistingMediaAssetReference({
        ...baseInput(),
        sourceRole: "https://evil.example/token=abc",
      }),
    /URL|token|media/,
  );
});

test("ExistingMediaAssetReference — workspace/project isolation", () => {
  const ref = createExistingMediaAssetReference(baseInput());
  assert.throws(
    () =>
      assertExistingMediaAssetReferenceMatchesFacts(ref, {
        ...factsFrom(ref),
        workspaceId: "55555555-5555-4555-8555-555555555555",
      }),
    /workspace/,
  );
  assert.throws(
    () =>
      assertExistingMediaAssetReferenceMatchesFacts(ref, {
        ...factsFrom(ref),
        projectId: "66666666-6666-4666-8666-666666666666",
      }),
    /project/,
  );
});

test("ExistingMediaAssetReference — lifecycle / HR / checksum / MIME / dims", () => {
  const ref = createExistingMediaAssetReference(baseInput());
  const ok = factsFrom(ref);
  assertExistingMediaAssetReferenceMatchesFacts(ref, ok);
  assertExistingMediaAssetMayStayInactive(false);

  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, checksum: "b".repeat(64) }),
    /checksum/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, mimeType: "video/mp4" }),
    /MIME/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, width: 512 }),
    /dimensions/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, lifecycle: "pending_review" }),
    /approved|pending/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, lifecycle: "rejected" }),
    /approved|rejected/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, stale: true }),
    /stale/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, quarantined: true }),
    /quarantined/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, humanReviewDecision: null }),
    /Human Review/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, bucketPrivate: false }),
    /private/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, sourceKind: "external" }),
    /internal/,
  );
  assert.throws(
    () => assertExistingMediaAssetReferenceMatchesFacts(ref, { ...ok, active: true }),
    /activation|active/,
  );
  assert.throws(() => assertExistingMediaAssetMayStayInactive(true), /active=false/);
});

test("ExistingMediaAssetReference — approved inactive source is explicitly allowed", () => {
  const ref = createExistingMediaAssetReference(baseInput());
  const facts = factsFrom(ref);
  assert.equal(facts.active, false);
  assert.equal(facts.lifecycle, "approved");
  assertExistingMediaAssetReferenceMatchesFacts(ref, facts);
});

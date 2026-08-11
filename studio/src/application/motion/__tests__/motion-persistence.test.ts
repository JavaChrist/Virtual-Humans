/**
 * MT-005 — Motion Transfer persistence / storage contracts (no remote I/O).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MOTION_HUMAN_REVIEW_INTENT,
  MOTION_PERSISTENCE_MATRIX,
  assertMotionAssetMimeAllowed,
  isFinalizableMotionReview,
  isRetryMotionReview,
} from "@/domain/motion/persistence";
import {
  MOTION_ASSETS_BUCKET,
  assertSafeMotionStoragePath,
  buildMotionAssetStoragePath,
  motionRoleFromStoragePath,
} from "../motion-asset-path";
import {
  assertMotionPlanNotFinalWithoutApprove,
  createMemoryMotionPersistencePort,
} from "../motion-persistence-port";

const WS = "11111111-1111-4111-8111-111111111111";
const PROJ = "22222222-2222-4222-8222-222222222222";
const ASSET = "33333333-3333-4333-8333-333333333333";
const ASSET2 = "44444444-4444-4444-8444-444444444444";

test("MT-005 matrix classifies human review as LOCAL_MIGRATION_REQUIRED", () => {
  const row = MOTION_PERSISTENCE_MATRIX.find(
    (r) => r.object === "HumanReviewDecision (motion)",
  );
  assert.equal(row?.classification, "LOCAL_MIGRATION_REQUIRED");
  assert.ok(
    MOTION_PERSISTENCE_MATRIX.some((r) => r.classification === "REUSE_AS_IS"),
  );
  assert.ok(
    !MOTION_PERSISTENCE_MATRIX.some((r) =>
      /^motion_[a-z_]+$/.test(r.representation),
    ),
  );
});

test("path builder — deterministic private path with role segment", () => {
  const path = buildMotionAssetStoragePath({
    workspaceId: WS,
    projectId: PROJ,
    role: "motion_source_video",
    assetId: ASSET,
    mimeType: "video/mp4",
  });
  assert.equal(
    path,
    `${WS}/${PROJ}/motion/source/${ASSET}.mp4`,
  );
  assert.equal(MOTION_ASSETS_BUCKET, "director-final-assets");
  assert.equal(motionRoleFromStoragePath(path), "motion_source_video");
});

test("path builder — distinguishes identity / outfit / output / qc / final", () => {
  const roles = [
    ["motion_identity_reference", "identity", "image/png", "png"],
    ["motion_outfit_reference", "outfit", "image/jpeg", "jpg"],
    ["motion_provider_output", "output", "video/webm", "webm"],
    ["motion_qc_evidence", "qc", "image/webp", "webp"],
    ["motion_approved_output", "final", "video/mp4", "mp4"],
  ] as const;
  for (const [role, seg, mime, ext] of roles) {
    const path = buildMotionAssetStoragePath({
      workspaceId: WS,
      projectId: PROJ,
      role,
      assetId: ASSET,
      mimeType: mime,
    });
    assert.ok(path.includes(`/motion/${seg}/`));
    assert.ok(path.endsWith(`.${ext}`));
  }
});

test("hostile path — rejects .., user filename, cross-workspace, wrong segment count", () => {
  assert.throws(() =>
    buildMotionAssetStoragePath({
      workspaceId: WS,
      projectId: PROJ,
      role: "motion_source_video",
      assetId: "../evil",
      mimeType: "video/mp4",
    }),
  );
  assert.throws(() =>
    buildMotionAssetStoragePath({
      workspaceId: WS,
      projectId: PROJ,
      role: "motion_source_video",
      assetId: "my video.mp4",
      mimeType: "video/mp4",
    }),
  );
  assert.throws(() =>
    assertSafeMotionStoragePath(`${WS}/${PROJ}/motion/source/${ASSET}.mp4`, {
      workspaceId: "99999999-9999-4999-8999-999999999999",
      projectId: PROJ,
    }),
  );
  assert.throws(() =>
    assertSafeMotionStoragePath(`${WS}/${PROJ}/source/${ASSET}.mp4`, {
      workspaceId: WS,
      projectId: PROJ,
    }),
  );
});

test("MIME guards — role allowlists", () => {
  assert.throws(() =>
    assertMotionAssetMimeAllowed("motion_source_video", "image/png"),
  );
  assert.throws(() =>
    assertMotionAssetMimeAllowed("motion_identity_reference", "video/mp4"),
  );
  assert.doesNotThrow(() =>
    assertMotionAssetMimeAllowed("motion_provider_output", "video/mp4"),
  );
});

test("memory port — register by fingerprint, no signed URL in provenance", async () => {
  const port = createMemoryMotionPersistencePort();
  const rec = await port.registerMedia(
    {
      workspaceId: WS,
      projectId: PROJ,
      assetId: ASSET,
      role: "motion_source_video",
      mimeType: "video/mp4",
      checksum: "sha256:abc",
      contentFingerprint: "fp-source-1",
      correlationId: "corr-mt005-path",
      consentTag: "talent_ok",
      licenseTag: "internal",
      biometricPotential: true,
    },
    "2026-08-11T12:00:00.000Z",
  );
  assert.equal(rec.storageBucket, "director-final-assets");
  assert.ok(!("signedUrl" in rec));
  assert.ok(!JSON.stringify(rec.provenance).includes("https://"));
  const byFp = await port.getMediaByFingerprint(WS, PROJ, "fp-source-1");
  assert.equal(byFp?.assetId, ASSET);
  await port.markSourceConsumed(WS, PROJ, ASSET);
  const meta = await port.getMediaMetadata(WS, PROJ, ASSET);
  assert.equal(meta?.sourceLifecycle, "consumed_by_run");
});

test("memory port — cross-project fingerprint isolation", async () => {
  const port = createMemoryMotionPersistencePort();
  await port.registerMedia(
    {
      workspaceId: WS,
      projectId: PROJ,
      assetId: ASSET,
      role: "motion_identity_reference",
      mimeType: "image/png",
      checksum: "sha256:id1",
      contentFingerprint: "fp-shared-looking",
      correlationId: "corr-a",
    },
    "2026-08-11T12:00:00.000Z",
  );
  const otherProj = "55555555-5555-4555-8555-555555555555";
  const miss = await port.getMediaByFingerprint(WS, otherProj, "fp-shared-looking");
  assert.equal(miss, null);
});

test("memory port — plan idempotence and signed URL rejection", async () => {
  const port = createMemoryMotionPersistencePort();
  const plan = {
    workspaceId: WS,
    projectId: PROJ,
    planFingerprint: "plan-fp-1",
    registryVersion: "1.0.0",
    idempotencyMaterial: "idem-1",
    planRedacted: { capability: "video.motion_transfer", steps: 1 },
    correlationId: "corr-plan",
    createdAt: "2026-08-11T12:00:00.000Z",
  };
  const a = await port.savePlan(plan);
  const b = await port.savePlan(plan);
  assert.equal(a.planFingerprint, b.planFingerprint);
  await assert.rejects(
    () =>
      port.savePlan({
        ...plan,
        planFingerprint: "plan-fp-2",
        planRedacted: {
          url: "https://evil.example/signed?X-Amz-Signature=abc",
        },
      }),
    /signed_or_inline/,
  );
});

test("memory port — human review intents + finalization gate", async () => {
  const port = createMemoryMotionPersistencePort();
  assert.equal(
    MOTION_HUMAN_REVIEW_INTENT.RETRY_WITH_SAME_REFERENCE,
    "retry_same_reference",
  );
  const review = await port.recordHumanReview({
    workspaceId: WS,
    projectId: PROJ,
    decisionId: ASSET,
    decision: "retry_same_reference",
    productionResultRevisionId: ASSET2,
    idempotencyKey: "rev-idem-1",
    correlationId: "corr-rev",
    createdAt: "2026-08-11T12:00:00.000Z",
  });
  assert.equal(isRetryMotionReview(review.decision), true);
  assert.equal(isFinalizableMotionReview(review.decision), false);
  assert.throws(() => assertMotionPlanNotFinalWithoutApprove(review));
  const approved = await port.recordHumanReview({
    workspaceId: WS,
    projectId: PROJ,
    decisionId: ASSET2,
    decision: "approved",
    productionResultRevisionId: ASSET2,
    idempotencyKey: "rev-idem-2",
    correlationId: "corr-rev-2",
    createdAt: "2026-08-11T12:01:00.000Z",
  });
  assert.doesNotThrow(() => assertMotionPlanNotFinalWithoutApprove(approved));
});

test("late provider output lifecycle — quarantine flag in provenance", async () => {
  const port = createMemoryMotionPersistencePort();
  await port.registerMedia(
    {
      workspaceId: WS,
      projectId: PROJ,
      assetId: ASSET,
      role: "motion_provider_output",
      mimeType: "video/mp4",
      checksum: "sha256:out",
      contentFingerprint: "fp-out-1",
      correlationId: "corr-out",
    },
    "2026-08-11T12:00:00.000Z",
  );
  await port.markProviderOutputLifecycle(WS, PROJ, ASSET, "late_quarantined");
  const meta = await port.getMediaMetadata(WS, PROJ, ASSET);
  assert.equal(meta?.provenance.providerOutputLifecycle, "late_quarantined");
  assert.equal(meta?.provenance.lateOutput, true);
});

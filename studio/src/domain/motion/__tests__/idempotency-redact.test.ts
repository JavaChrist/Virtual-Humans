import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertNoSignedUrlLeak,
  buildI2vCollisionProbeFingerprint,
  buildMotionTransferIdempotencyMaterial,
  buildMotionTransferInputFingerprint,
  MOTION_TRANSFER_CAPABILITY,
  parseMotionTransferInput,
  redactMotionTransferInput,
} from "../index";
import {
  makeIdentityRef,
  makeMinimalInput,
  makeOutfitRef,
  makeReferenceSpec,
  makeVideoRef,
} from "./fixtures";

test("idempotence stable for same logical input", () => {
  const a = parseMotionTransferInput(makeMinimalInput());
  const b = parseMotionTransferInput(makeMinimalInput());
  assert.equal(
    buildMotionTransferInputFingerprint(a),
    buildMotionTransferInputFingerprint(b),
  );
  assert.equal(
    buildMotionTransferIdempotencyMaterial(a),
    buildMotionTransferIdempotencyMaterial(b),
  );
  assert.match(
    buildMotionTransferIdempotencyMaterial(a),
    new RegExp(`^${MOTION_TRANSFER_CAPABILITY}:1\\.0\\.0:`),
  );
});

test("identity reference order does not change fingerprint", () => {
  const first = parseMotionTransferInput(
    makeMinimalInput({
      character: {
        characterId: "mei",
        identityLock: "required",
        identityReferences: [makeIdentityRef("id-a"), makeIdentityRef("id-b")],
      },
    }),
  );
  const second = parseMotionTransferInput(
    makeMinimalInput({
      character: {
        characterId: "mei",
        identityLock: "required",
        identityReferences: [makeIdentityRef("id-b"), makeIdentityRef("id-a")],
      },
    }),
  );
  assert.equal(
    buildMotionTransferInputFingerprint(first),
    buildMotionTransferInputFingerprint(second),
  );
});

test("critical field changes produce new key", () => {
  const base = parseMotionTransferInput(makeMinimalInput());
  const character = parseMotionTransferInput(
    makeMinimalInput({
      character: {
        characterId: "tom",
        identityLock: "required",
        identityReferences: [makeIdentityRef()],
      },
    }),
  );
  const movement = parseMotionTransferInput(
    makeMinimalInput({
      referenceSpec: makeReferenceSpec({ movementId: "MV-002", version: "1.0.0" }),
    }),
  );
  const outfit = parseMotionTransferInput(
    makeMinimalInput({
      character: {
        characterId: "mei",
        identityLock: "required",
        identityReferences: [makeIdentityRef()],
        outfitReference: makeOutfitRef("outfit-2"),
        outfitLock: "preferred",
      },
    }),
  );
  const source = parseMotionTransferInput(
    makeMinimalInput({ sourceVideo: makeVideoRef("other-video") }),
  );
  const fps = [
    buildMotionTransferInputFingerprint(base),
    buildMotionTransferInputFingerprint(character),
    buildMotionTransferInputFingerprint(movement),
    buildMotionTransferInputFingerprint(outfit),
    buildMotionTransferInputFingerprint(source),
  ];
  assert.equal(new Set(fps).size, 5);
});

test("motion fingerprint never collides with I2V probe namespace", () => {
  const motion = parseMotionTransferInput(makeMinimalInput());
  const motionFp = buildMotionTransferInputFingerprint(motion);
  const i2vFp = buildI2vCollisionProbeFingerprint({
    projectId: "p1",
    startFrameAssetId: motion.sourceVideo.asset.assetId,
    characterId: motion.character.characterId,
  });
  assert.notEqual(motionFp, i2vFp);
  assert.notEqual(
    buildMotionTransferIdempotencyMaterial(motion).startsWith("video.image_to_video"),
    true,
  );
});

test("redaction hides signed URLs and prompts", () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const input = parseMotionTransferInput(
    makeMinimalInput({
      sourceVideo: {
        role: "source_video",
        asset: {
          assetId: "signed-1",
          kind: "video",
          checksum: "sha256:x",
          access: {
            kind: "signed_url",
            url: "https://example.com/file.mp4?X-Amz-Signature=secret",
            expiresAt: future,
          },
        },
        durationSeconds: 5,
      },
      prompt: "secret prompt text",
    }),
  );
  const redacted = redactMotionTransferInput(input);
  assert.equal(redacted.sourceVideo.signedUrl, "[redacted]");
  assert.equal(redacted.prompt, "[redacted]");
  assertNoSignedUrlLeak(redacted);
  const json = JSON.stringify(redacted);
  assert.equal(json.includes("X-Amz-Signature"), false);
  assert.equal(json.includes("secret prompt"), false);
});

test("parsed input is deeply frozen (immutable)", () => {
  const input = parseMotionTransferInput(makeMinimalInput());
  assert.throws(() => {
    (input as { correlationId: string }).correlationId = "mutated";
  }, TypeError);
  assert.throws(() => {
    (input.character.identityReferences as unknown[]).push("x");
  }, TypeError);
});

test("signed URL expiry enforced", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.throws(() =>
    parseMotionTransferInput(
      makeMinimalInput({
        sourceVideo: {
          role: "source_video",
          asset: {
            assetId: "expired",
            kind: "video",
            access: {
              kind: "signed_url",
              url: "https://example.com/v.mp4",
              expiresAt: past,
            },
          },
        },
      }),
    ),
  );
});

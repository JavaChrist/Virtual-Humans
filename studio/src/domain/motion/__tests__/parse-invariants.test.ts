import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MotionTransferDomainError,
  MOTION_TRANSFER_CAPABILITY,
  isMotionTransferCapability,
  modelSupportsMotionFidelity,
  parseMotionQcResult,
  parseMotionReferenceSpec,
  parseMotionTransferInput,
  parseMotionTransferResult,
} from "../index";
import {
  makeCriticalInput,
  makeIdentityRef,
  makeMinimalInput,
  makeQcResult,
  makeReferenceSpec,
  makeVideoRef,
} from "./fixtures";

test("happy path minimal parse", () => {
  const input = parseMotionTransferInput(makeMinimalInput());
  assert.equal(input.capability, MOTION_TRANSFER_CAPABILITY);
  assert.equal(input.motion.preserveMotion, true);
  assert.equal(input.character.identityReferences.length, 1);
});

test("capability constant distinct from I2V/T2V", () => {
  assert.equal(isMotionTransferCapability("video.motion_transfer"), true);
  assert.equal(isMotionTransferCapability("video.image_to_video"), false);
  assert.equal(isMotionTransferCapability("video.text_to_video"), false);
});

test("fidelity critical with human validation", () => {
  const input = parseMotionTransferInput(makeCriticalInput());
  assert.equal(input.motion.fidelity, "critical");
});

test("fidelity critical without human validation fails", () => {
  assert.throws(
    () =>
      parseMotionTransferInput(
        makeMinimalInput({
          motion: {
            preserveMotion: true,
            preserveTiming: true,
            fidelity: "critical",
          },
          referenceSpec: makeReferenceSpec({ humanValidationRequired: false }),
          qcRequirements: [{ code: "x", severity: "warning" }],
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "human_validation_required",
  );
});

test("identity lock required needs references", () => {
  assert.throws(
    () =>
      parseMotionTransferInput(
        makeMinimalInput({
          character: {
            characterId: "mei",
            identityReferences: [],
            identityLock: "required",
          },
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "identity_reference_required",
  );
});

test("outfit lock required needs outfit reference", () => {
  assert.throws(
    () =>
      parseMotionTransferInput(
        makeMinimalInput({
          character: {
            characterId: "mei",
            identityReferences: [makeIdentityRef()],
            identityLock: "required",
            outfitLock: "required",
            outfitReference: undefined,
          },
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "outfit_reference_required",
  );
});

test("preserveMotion must be true", () => {
  assert.throws(
    () =>
      parseMotionTransferInput(
        makeMinimalInput({
          motion: {
            preserveMotion: false,
            preserveTiming: true,
            fidelity: "standard",
          },
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "contradictory_constraints",
  );
});

test("multi-phase spec with checkpoints and body relations", () => {
  const spec = parseMotionReferenceSpec(makeReferenceSpec());
  assert.equal(spec.phases.length, 2);
  assert.equal(spec.checkpoints.length, 2);
  assert.equal(spec.bodyRelations.length, 1);
  assert.equal(spec.forbiddenPatterns[0]?.description.length > 0, true);
});

test("checkpoint unknown phase fails", () => {
  assert.throws(
    () =>
      parseMotionReferenceSpec(
        makeReferenceSpec({
          checkpoints: [
            {
              checkpointId: "cp-x",
              phaseId: "missing-phase",
              description: "bad",
              mandatory: true,
            },
          ],
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "invalid_motion_checkpoint",
  );
});

test("duplicate phase ids fail", () => {
  assert.throws(
    () =>
      parseMotionReferenceSpec(
        makeReferenceSpec({
          phases: [
            { phaseId: "phase-a", order: 0 },
            { phaseId: "phase-a", order: 1 },
          ],
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError && e.code === "duplicate_id",
  );
});

test("unknown schema version rejected", () => {
  assert.throws(
    () =>
      parseMotionTransferInput({
        ...makeMinimalInput(),
        schemaVersion: "9.9.9",
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "unknown_schema_version",
  );
});

test("invalid duration / fps / aspect ratio", () => {
  assert.throws(
    () =>
      parseMotionTransferInput(
        makeMinimalInput({
          output: { aspectRatio: "9:16", durationSeconds: 0 },
        }),
      ),
    MotionTransferDomainError,
  );
  assert.throws(
    () =>
      parseMotionTransferInput(
        makeMinimalInput({
          output: { aspectRatio: "9:16", fps: 1000 },
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError && e.code === "invalid_fps",
  );
  assert.throws(
    () =>
      parseMotionTransferInput({
        ...makeMinimalInput(),
        output: { aspectRatio: "21:9" as "9:16" },
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "invalid_aspect_ratio",
  );
});

test("data URL forbidden by default", () => {
  const input = makeMinimalInput({
    sourceVideo: {
      role: "source_video",
      asset: {
        assetId: "d1",
        kind: "video",
        access: { kind: "data_url", dataUrl: "data:video/mp4;base64,AAAA" },
      },
    },
  });
  assert.throws(
    () => parseMotionTransferInput(input),
    (e: unknown) =>
      e instanceof MotionTransferDomainError && e.code === "data_url_forbidden",
  );
});

test("declared fidelity levels invariant for Router", () => {
  assert.equal(modelSupportsMotionFidelity("critical", ["standard", "high"]), false);
  assert.equal(
    modelSupportsMotionFidelity("critical", ["standard", "high", "critical"]),
    true,
  );
  assert.doesNotThrow(() =>
    parseMotionTransferInput(makeMinimalInput(), {
      declaredMotionFidelityLevels: ["standard", "high"],
    }),
  );
  assert.throws(
    () =>
      parseMotionTransferInput(makeCriticalInput(), {
        declaredMotionFidelityLevels: ["standard", "high"],
      }),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "unsupported_motion_fidelity",
  );
});

test("I2V fields rejected on motion input", () => {
  assert.throws(
    () =>
      parseMotionTransferInput({
        ...makeMinimalInput(),
        startFrame: makeVideoRef("frame"),
      } as unknown),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "invalid_motion_transfer_input",
  );
});

test("sourceVideo missing fails", () => {
  const raw = makeMinimalInput() as unknown as Record<string, unknown>;
  delete raw.sourceVideo;
  assert.throws(
    () => parseMotionTransferInput(raw),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "source_video_required",
  );
});

test("hostile oversized / empty forbidden pattern", () => {
  assert.throws(
    () =>
      parseMotionReferenceSpec(
        makeReferenceSpec({
          forbiddenPatterns: [
            { patternId: "fp", description: "   ", severity: "blocking" },
          ],
        }),
      ),
    MotionTransferDomainError,
  );
});

test("contradictory phase duration range", () => {
  assert.throws(
    () =>
      parseMotionReferenceSpec(
        makeReferenceSpec({
          phases: [
            {
              phaseId: "phase-a",
              order: 0,
              expectedDurationSeconds: { min: 5, max: 1 },
            },
          ],
          checkpoints: [],
        }),
      ),
    (e: unknown) =>
      e instanceof MotionTransferDomainError &&
      e.code === "contradictory_constraints",
  );
});

test("parse MotionQcResult and MotionTransferResult", () => {
  const qc = parseMotionQcResult(makeQcResult());
  assert.equal(qc.overallStatus, "human_review");
  const result = parseMotionTransferResult({
    schemaVersion: "1.0.0",
    status: "completed",
    qc,
  });
  assert.equal(result.status, "completed");
});

test("empty characterId fails", () => {
  assert.throws(
    () =>
      parseMotionTransferInput(
        makeMinimalInput({
          character: {
            characterId: " ",
            identityReferences: [makeIdentityRef()],
            identityLock: "preferred",
          },
        }),
      ),
    MotionTransferDomainError,
  );
});

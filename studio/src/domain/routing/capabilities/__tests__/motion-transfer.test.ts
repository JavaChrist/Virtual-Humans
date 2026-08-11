/**
 * MT-002 — Motion Transfer Capability Registry tests.
 * Fixtures are SYNTHETIC only — Production registry stays at 0 eligible MT models.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ModelCapabilitiesSchema,
  MotionTransferModelCapabilitiesSchema,
  MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
  supportsMotionTransfer,
  satisfiesMotionTransferHardConstraints,
  explainMotionTransferIneligibility,
  countEligibleMotionTransferModels,
  parseMotionTransferModelCapabilities,
  serializeMotionTransferModelCapabilities,
  supportLevelSatisfiesHard,
  listModelsForProfile,
  buildRegistrySnapshot,
} from "../index";
import { MOTION_TRANSFER_CAPABILITY } from "@/domain/motion/capability";
import {
  makeCompleteMotionTransferCaps,
  makeSyntheticMotionTransferModel,
  makeI2vNonMotionModel,
  makeT2vNonMotionModel,
  makeReferenceImagesToVideoNonMotionModel,
  baselineHardInput,
  makeProductionLikeSnapshotWithoutMotionTransfer,
  SYNTHETIC_MT_PROVIDER_ID,
} from "./motion-transfer-fixtures";
import { makeProvider, CREATED, EXPIRES } from "./fixtures";

describe("MT-002 motion-transfer capability registry", () => {
  it("schema accepts complete synthetic motion-transfer block", () => {
    const caps = makeCompleteMotionTransferCaps();
    const parsed = MotionTransferModelCapabilitiesSchema.safeParse(caps);
    assert.equal(parsed.success, true);
    assert.equal(caps.schemaVersion, MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION);
  });

  it("model schema accepts synthetic complete MT model", () => {
    const m = makeSyntheticMotionTransferModel();
    assert.equal(ModelCapabilitiesSchema.safeParse(m).success, true);
  });

  it("supportsMotionTransfer on complete synthetic model", () => {
    assert.equal(supportsMotionTransfer(makeSyntheticMotionTransferModel()), true);
  });

  it("image_to_video != video.motion_transfer", () => {
    const i2v = makeI2vNonMotionModel();
    assert.ok(i2v.supportedProfiles.includes("video.image_to_video"));
    assert.equal(supportsMotionTransfer(i2v), false);
    assert.equal(
      satisfiesMotionTransferHardConstraints(i2v, baselineHardInput()),
      false,
    );
    const reasons = explainMotionTransferIneligibility(i2v, baselineHardInput());
    assert.ok(reasons.some((r) => r.reason === "profile_missing"));
    assert.ok(reasons.some((r) => r.reason === "motion_transfer_not_supported"));
  });

  it("text_to_video != video.motion_transfer", () => {
    const t2v = makeT2vNonMotionModel();
    assert.equal(supportsMotionTransfer(t2v), false);
    assert.equal(
      satisfiesMotionTransferHardConstraints(t2v, baselineHardInput()),
      false,
    );
  });

  it("reference_images_to_video != video.motion_transfer", () => {
    const ref = makeReferenceImagesToVideoNonMotionModel();
    assert.ok(ref.mediaInputs.includes("reference_image"));
    assert.equal(supportsMotionTransfer(ref), false);
  });

  it("UNVERIFIED model is not paid-eligible", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        sourceVideo: "UNVERIFIED",
        motionFidelityLevels: {
          standard: "UNVERIFIED",
          high: "UNVERIFIED",
          critical: "UNVERIFIED",
        },
      }),
    });
    assert.equal(supportsMotionTransfer(m), true);
    assert.equal(
      satisfiesMotionTransferHardConstraints(m, baselineHardInput()),
      false,
    );
    const reasons = explainMotionTransferIneligibility(m, baselineHardInput());
    assert.ok(reasons.some((r) => r.reason === "source_video_not_supported"));
  });

  it("PARTIAL refused for critical fidelity", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        motionFidelityLevels: {
          standard: "SUPPORTED",
          high: "SUPPORTED",
          critical: "PARTIAL",
        },
      }),
    });
    const input = baselineHardInput({ fidelity: "critical" });
    assert.equal(satisfiesMotionTransferHardConstraints(m, input), false);
    const reasons = explainMotionTransferIneligibility(m, input);
    assert.ok(reasons.some((r) => r.reason === "critical_fidelity_unverified"));
  });

  it("source video NOT_SUPPORTED", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        sourceVideo: "NOT_SUPPORTED",
      }),
    });
    const reasons = explainMotionTransferIneligibility(m, baselineHardInput());
    assert.ok(reasons.some((r) => r.reason === "source_video_not_supported"));
  });

  it("identity required without identityControl SUPPORTED", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        identityControl: "PARTIAL",
        characterReference: "SUPPORTED",
      }),
    });
    const input = baselineHardInput({ identityLock: "required" });
    assert.equal(satisfiesMotionTransferHardConstraints(m, input), false);
    assert.ok(
      explainMotionTransferIneligibility(m, input).some(
        (r) => r.reason === "identity_control_not_supported",
      ),
    );
  });

  it("outfit required without outfitControl SUPPORTED", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        outfitControl: "NOT_SUPPORTED",
        outfitReference: "SUPPORTED",
      }),
    });
    const input = baselineHardInput({ outfitLock: "required" });
    assert.ok(
      explainMotionTransferIneligibility(m, input).some(
        (r) => r.reason === "outfit_control_not_supported",
      ),
    );
  });

  it("full-body required not supported", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        fullBodySupport: "UNVERIFIED",
      }),
    });
    const input = baselineHardInput({ fullBodyRequired: true });
    assert.ok(
      explainMotionTransferIneligibility(m, input).some(
        (r) => r.reason === "full_body_not_supported",
      ),
    );
  });

  it("pose control incompatible", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        poseControl: ["none"],
      }),
    });
    const input = baselineHardInput({ poseControl: "provider_native" });
    assert.ok(
      explainMotionTransferIneligibility(m, input).some(
        (r) => r.reason === "pose_control_unsupported",
      ),
    );
  });

  it("timing and camera preservation hard checks", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        timingPreservation: "PARTIAL",
        cameraPreservation: "NOT_SUPPORTED",
      }),
    });
    const input = baselineHardInput({
      preserveTiming: true,
      preserveCamera: true,
    });
    const reasons = explainMotionTransferIneligibility(m, input);
    assert.ok(reasons.some((r) => r.reason === "timing_preservation_not_supported"));
    assert.ok(reasons.some((r) => r.reason === "camera_preservation_not_supported"));
  });

  it("duration exceeded", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        maxDurationSeconds: 10,
      }),
    });
    const reasons = explainMotionTransferIneligibility(
      m,
      baselineHardInput({ durationSeconds: 20 }),
    );
    assert.ok(reasons.some((r) => r.reason === "duration_exceeded"));
  });

  it("aspect ratio / resolution / fps incompatible", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        aspectRatios: ["16:9"],
        resolutions: ["720p"],
        fps: [30],
      }),
    });
    const reasons = explainMotionTransferIneligibility(
      m,
      baselineHardInput({
        aspectRatio: "9:16",
        resolution: "1080p",
        fps: 24,
      }),
    );
    assert.ok(reasons.some((r) => r.reason === "aspect_ratio_unsupported"));
    assert.ok(reasons.some((r) => r.reason === "resolution_unsupported"));
    assert.ok(reasons.some((r) => r.reason === "fps_unsupported"));
  });

  it("invalid estimateStrategy rejected", () => {
    const raw = {
      ...makeCompleteMotionTransferCaps(),
      estimateStrategy: "magic_price",
    };
    assert.equal(MotionTransferModelCapabilitiesSchema.safeParse(raw).success, false);
  });

  it("unknown schema version rejected", () => {
    const raw = {
      ...makeCompleteMotionTransferCaps(),
      schemaVersion: "9.9.9",
    };
    assert.equal(MotionTransferModelCapabilitiesSchema.safeParse(raw).success, false);
    assert.throws(() => parseMotionTransferModelCapabilities(raw));
  });

  it("unknown critical fields rejected (strict)", () => {
    const raw = {
      ...makeCompleteMotionTransferCaps(),
      marketingScore: 99,
    };
    assert.equal(MotionTransferModelCapabilitiesSchema.safeParse(raw).success, false);
  });

  it("contradictory async without polling rejected", () => {
    const raw = makeCompleteMotionTransferCaps({
      syncOrAsync: "async",
      pollingRequired: false,
    });
    assert.equal(MotionTransferModelCapabilitiesSchema.safeParse(raw).success, false);
  });

  it("profile without motionTransfer block rejected on model schema", () => {
    const m = makeSyntheticMotionTransferModel({ motionTransfer: undefined });
    // Remove motionTransfer explicitly
    const { motionTransfer: _drop, ...rest } = m;
    void _drop;
    assert.equal(
      ModelCapabilitiesSchema.safeParse({
        ...rest,
        supportedProfiles: ["video.motion_transfer"],
      }).success,
      false,
    );
  });

  it("ineligibility reasons are deterministic and sorted", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        sourceVideo: "NOT_SUPPORTED",
        aspectRatios: ["1:1"],
        maxDurationSeconds: 2,
      }),
    });
    const input = baselineHardInput({
      durationSeconds: 20,
      aspectRatio: "9:16",
    });
    const a = explainMotionTransferIneligibility(m, input);
    const b = explainMotionTransferIneligibility(m, input);
    assert.deepEqual(a, b);
    const reasons = a.map((r) => r.reason);
    assert.deepEqual(reasons, [...reasons].sort((x, y) => x.localeCompare(y)));
  });

  it("input is not mutated", () => {
    const m = makeSyntheticMotionTransferModel();
    const input = baselineHardInput({ fidelity: "critical" });
    const snapshot = structuredClone(input);
    explainMotionTransferIneligibility(m, input);
    satisfiesMotionTransferHardConstraints(m, input);
    assert.deepEqual(input, snapshot);
  });

  it("serialization is stable", () => {
    const caps = makeCompleteMotionTransferCaps();
    const s1 = serializeMotionTransferModelCapabilities(caps);
    const s2 = serializeMotionTransferModelCapabilities(
      parseMotionTransferModelCapabilities(JSON.parse(s1)),
    );
    assert.equal(s1, s2);
  });

  it("Production-like registry has zero eligible motion-transfer models", () => {
    const snap = makeProductionLikeSnapshotWithoutMotionTransfer();
    const listed = listModelsForProfile(snap, MOTION_TRANSFER_CAPABILITY);
    assert.equal(listed.length, 0);
    assert.equal(
      countEligibleMotionTransferModels(snap.models, baselineHardInput()),
      0,
    );
    for (const m of snap.models) {
      assert.equal(supportsMotionTransfer(m), false);
    }
  });

  it("synthetic MT model eligible; not present in Production-like snapshot", () => {
    const synthetic = makeSyntheticMotionTransferModel();
    assert.equal(
      satisfiesMotionTransferHardConstraints(synthetic, baselineHardInput()),
      true,
    );
    const snap = makeProductionLikeSnapshotWithoutMotionTransfer();
    assert.ok(
      !snap.models.some(
        (m) =>
          m.providerId === SYNTHETIC_MT_PROVIDER_ID ||
          m.supportedProfiles.includes(MOTION_TRANSFER_CAPABILITY),
      ),
    );
  });

  it("supportLevelSatisfiesHard: only SUPPORTED", () => {
    assert.equal(supportLevelSatisfiesHard("SUPPORTED"), true);
    assert.equal(supportLevelSatisfiesHard("PARTIAL"), false);
    assert.equal(supportLevelSatisfiesHard("UNVERIFIED"), false);
    assert.equal(supportLevelSatisfiesHard("NOT_SUPPORTED"), false);
  });

  it("hands/feet critical evaluable", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        handFootQuality: "PARTIAL",
      }),
    });
    const reasons = explainMotionTransferIneligibility(
      m,
      baselineHardInput({ handsFeetCritical: true }),
    );
    assert.ok(reasons.some((r) => r.reason === "hand_foot_quality_not_supported"));
  });

  it("registry snapshot with only synthetic MT model validates", () => {
    const snap = buildRegistrySnapshot({
      providers: [makeProvider({ id: SYNTHETIC_MT_PROVIDER_ID })],
      models: [makeSyntheticMotionTransferModel()],
      createdAt: CREATED,
      registryVersion: "mt002-synthetic-only",
      expiresAt: EXPIRES,
    });
    assert.equal(snap.models.length, 1);
    assert.equal(listModelsForProfile(snap, MOTION_TRANSFER_CAPABILITY).length, 1);
  });

  it("empty poseControl / aspectRatios rejected", () => {
    assert.equal(
      MotionTransferModelCapabilitiesSchema.safeParse(
        makeCompleteMotionTransferCaps({ poseControl: [] }),
      ).success,
      false,
    );
    assert.equal(
      MotionTransferModelCapabilitiesSchema.safeParse(
        makeCompleteMotionTransferCaps({ aspectRatios: [] }),
      ).success,
      false,
    );
  });
});

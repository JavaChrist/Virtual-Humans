/**
 * MT-003 — Motion Transfer Router strategy tests.
 * SYNTHETIC fixtures only — Production registry has 0 MT models.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "@/domain/cost";
import {
  buildRegistrySnapshot,
  type ModelCapabilities,
} from "@/domain/routing/capabilities";
import {
  makeCompleteMotionTransferCaps,
  makeI2vNonMotionModel,
  makeSyntheticMotionTransferModel,
  makeT2vNonMotionModel,
  makeProductionLikeSnapshotWithoutMotionTransfer,
  SYNTHETIC_MT_PROVIDER_ID,
  SYNTHETIC_MT_MODEL_ID,
} from "../../capabilities/__tests__/motion-transfer-fixtures";
import { makeProvider, CREATED, EXPIRES, AT } from "../../capabilities/__tests__/fixtures";
import {
  MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP,
  MOTION_TRANSFER_STRATEGY_ID,
  redactMotionTransferRoutingDecision,
  routeMotionTransfer,
  routingConstraintsFromMotionTransferInput,
  type MotionTransferRoutingRequest,
} from "../motion-transfer-routing";
import { getStrategy, listStrategies, strategiesForIntent } from "../strategy-library";
import { GenerationStrategyIdValues } from "../strategies";

const CORR = "corr-mt003-test";

function withScores(model: ModelCapabilities, scores: {
  quality?: number;
  identity?: number;
  speed?: number;
  reliability?: number;
}): ModelCapabilities {
  const evidence = [
    ...model.evidence,
    ...(scores.quality != null
      ? [{ field: "quality.quality", source: "manual" as const, reference: "synth", confidence: "high" as const }]
      : []),
    ...(scores.identity != null
      ? [{ field: "quality.identity", source: "manual" as const, reference: "synth", confidence: "high" as const }]
      : []),
    ...(scores.speed != null
      ? [{ field: "quality.speed", source: "manual" as const, reference: "synth", confidence: "high" as const }]
      : []),
    ...(scores.reliability != null
      ? [
          {
            field: "quality.reliability",
            source: "manual" as const,
            reference: "synth",
            confidence: "high" as const,
          },
        ]
      : []),
  ];
  return {
    ...model,
    quality: { ...model.quality, ...scores },
    evidence,
  };
}

function makeMtRegistry(models: ModelCapabilities[]) {
  const providerIds = [...new Set(models.map((m) => m.providerId))];
  return buildRegistrySnapshot({
    providers: providerIds.map((id) => makeProvider({ id })),
    models,
    createdAt: CREATED,
    registryVersion: "mt003-synthetic",
    expiresAt: EXPIRES,
  });
}

function baseRequest(
  overrides: Partial<MotionTransferRoutingRequest> & {
    registry: MotionTransferRoutingRequest["registry"];
  },
): MotionTransferRoutingRequest {
  return {
    schemaVersion: "1.0.0",
    strategy: MOTION_TRANSFER_STRATEGY_ID,
    constraints: {
      fidelity: "standard",
      identityLock: "preferred",
      preserveTiming: true,
      durationSeconds: 8,
      aspectRatio: "9:16",
      resolution: "1080p",
      fps: 24,
    },
    at: AT,
    correlationId: CORR,
    budgetLimitMinor: 10_000,
    currency: "USD",
    ...overrides,
  };
}

describe("MT-003 motion_transfer router strategy", () => {
  it("registers strategy id and library entry with zero fallbacks intent", () => {
    assert.ok(GenerationStrategyIdValues.includes("motion_transfer"));
    const s = getStrategy("motion_transfer");
    assert.equal(s.id, "motion_transfer");
    assert.deepEqual(s.requiredProfiles, ["video.motion_transfer"]);
    assert.equal(s.steps.length, 1);
    assert.equal(s.supportedProductionIntents.length, 0);
    assert.ok(s.constraints.some((c) => c.code === "no_fallback"));
    // Never selected via existing production intents
    for (const intent of [
      "image_to_video",
      "b_roll",
      "talking_head",
      "product_demo",
    ] as const) {
      assert.ok(!strategiesForIntent(intent).some((x) => x.id === "motion_transfer"));
    }
    assert.ok(listStrategies().some((x) => x.id === MOTION_TRANSFER_STRATEGY_ID));
  });

  it("selects among two synthetic eligible candidates deterministically", () => {
    const a = withScores(
      makeSyntheticMotionTransferModel({
        modelId: "synth-mt-a",
        pricing: [
          {
            id: "price:a",
            unit: "second",
            unitCost: money(20, "USD"),
            conditions: [],
            pricingVersion: "t",
            source: "manual",
            confidence: "high",
          },
        ],
      }),
      { quality: 70, identity: 70, reliability: 70, speed: 50 },
    );
    const b = withScores(
      makeSyntheticMotionTransferModel({
        modelId: "synth-mt-b",
        pricing: [
          {
            id: "price:b",
            unit: "second",
            unitCost: money(10, "USD"),
            conditions: [],
            pricingVersion: "t",
            source: "manual",
            confidence: "high",
          },
        ],
      }),
      { quality: 90, identity: 90, reliability: 90, speed: 50 },
    );
    const registry = makeMtRegistry([a, b]);
    const req = baseRequest({
      registry,
      allowedProviders: [SYNTHETIC_MT_PROVIDER_ID],
      allowedModels: [
        `${SYNTHETIC_MT_PROVIDER_ID}::synth-mt-a`,
        `${SYNTHETIC_MT_PROVIDER_ID}::synth-mt-b`,
      ],
    });
    const d1 = routeMotionTransfer(req);
    const d2 = routeMotionTransfer({
      ...req,
      registry: makeMtRegistry([b, a]), // reversed order
    });
    assert.equal(d1.status, "selected");
    assert.equal(d2.status, "selected");
    if (d1.status === "selected" && d2.status === "selected") {
      assert.equal(d1.selected.modelId, d2.selected.modelId);
      assert.equal(d1.decisionFingerprint, d2.decisionFingerprint);
      assert.equal(d1.maximumFallbacksPerStep, 0);
      assert.deepEqual(d1.fallbacks, []);
      assert.equal(d1.eligibleCandidateCount, 2);
    }
  });

  it("Production-like registry → motion_capability_unavailable", () => {
    const registry = makeProductionLikeSnapshotWithoutMotionTransfer();
    const d = routeMotionTransfer(baseRequest({ registry }));
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      assert.equal(d.failure.code, "motion_capability_unavailable");
      assert.equal(d.failure.eligibleCandidateCount, 0);
    }
  });

  it("hostile: Production I2V model never selected", () => {
    const i2v = makeI2vNonMotionModel();
    const registry = makeMtRegistry([i2v]);
    const d = routeMotionTransfer(baseRequest({ registry }));
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      assert.equal(d.failure.code, "motion_capability_unavailable");
      assert.ok(
        d.failure.rejected.some(
          (r) =>
            r.modelId === i2v.modelId &&
            r.reasons.some(
              (x) =>
                x.code === "profile_missing" ||
                x.code === "motion_transfer_not_supported",
            ),
        ),
      );
    }
  });

  it("T2V refused", () => {
    const t2v = makeT2vNonMotionModel();
    const d = routeMotionTransfer(baseRequest({ registry: makeMtRegistry([t2v]) }));
    assert.equal(d.status, "failed");
  });

  it("UNVERIFIED candidate refused", () => {
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
    const d = routeMotionTransfer(baseRequest({ registry: makeMtRegistry([m]) }));
    assert.equal(d.status, "failed");
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
    const d = routeMotionTransfer(
      baseRequest({
        registry: makeMtRegistry([m]),
        constraints: {
          fidelity: "critical",
          identityLock: "preferred",
          preserveTiming: true,
          durationSeconds: 8,
          aspectRatio: "9:16",
          resolution: "1080p",
          fps: 24,
        },
      }),
    );
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      assert.ok(
        d.failure.rejected.some((r) =>
          r.reasons.some((x) => x.code === "critical_fidelity_unverified"),
        ),
      );
    }
  });

  it("sourceVideo / identity / outfit / full-body / hands-feet / pose / timing / camera", () => {
    const cases: Array<{
      name: string;
      caps: Parameters<typeof makeCompleteMotionTransferCaps>[0];
      constraints: Partial<MotionTransferRoutingRequest["constraints"]>;
      code: string;
    }> = [
      {
        name: "source",
        caps: { sourceVideo: "NOT_SUPPORTED" },
        constraints: {},
        code: "source_video_not_supported",
      },
      {
        name: "identity",
        caps: { identityControl: "PARTIAL" },
        constraints: { identityLock: "required" },
        code: "identity_control_not_supported",
      },
      {
        name: "outfit",
        caps: { outfitControl: "NOT_SUPPORTED" },
        constraints: { outfitLock: "required" },
        code: "outfit_control_not_supported",
      },
      {
        name: "fullbody",
        caps: { fullBodySupport: "UNVERIFIED" },
        constraints: { fullBodyRequired: true },
        code: "full_body_not_supported",
      },
      {
        name: "hands",
        caps: { handFootQuality: "PARTIAL" },
        constraints: { handsFeetCritical: true },
        code: "hand_foot_quality_not_supported",
      },
      {
        name: "pose",
        caps: { poseControl: ["none"] },
        constraints: { poseControl: "provider_native" },
        code: "pose_control_unsupported",
      },
      {
        name: "timing",
        caps: { timingPreservation: "PARTIAL" },
        constraints: { preserveTiming: true },
        code: "timing_preservation_not_supported",
      },
      {
        name: "camera",
        caps: { cameraPreservation: "NOT_SUPPORTED" },
        constraints: { preserveCamera: true },
        code: "camera_preservation_not_supported",
      },
    ];

    for (const c of cases) {
      const m = makeSyntheticMotionTransferModel({
        motionTransfer: makeCompleteMotionTransferCaps(c.caps),
      });
      const d = routeMotionTransfer(
        baseRequest({
          registry: makeMtRegistry([m]),
          constraints: {
            fidelity: "standard",
            identityLock: "preferred",
            preserveTiming: true,
            durationSeconds: 8,
            aspectRatio: "9:16",
            resolution: "1080p",
            fps: 24,
            ...c.constraints,
          },
        }),
      );
      assert.equal(d.status, "failed", c.name);
      if (d.status === "failed") {
        assert.ok(
          d.failure.rejected.some((r) => r.reasons.some((x) => x.code === c.code)),
          c.name,
        );
      }
    }
  });

  it("duration / aspect / resolution / fps incompatibles", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        maxDurationSeconds: 5,
        aspectRatios: ["16:9"],
        resolutions: ["720p"],
        fps: [30],
      }),
    });
    const d = routeMotionTransfer(
      baseRequest({
        registry: makeMtRegistry([m]),
        constraints: {
          fidelity: "standard",
          identityLock: "preferred",
          preserveTiming: true,
          durationSeconds: 20,
          aspectRatio: "9:16",
          resolution: "1080p",
          fps: 24,
        },
      }),
    );
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      const codes = d.failure.rejected.flatMap((r) => r.reasons.map((x) => x.code));
      assert.ok(codes.includes("duration_exceeded"));
      assert.ok(codes.includes("aspect_ratio_unsupported"));
      assert.ok(codes.includes("resolution_unsupported"));
      assert.ok(codes.includes("fps_unsupported"));
    }
  });

  it("pricing absent → pricing_unconfigured", () => {
    const m = makeSyntheticMotionTransferModel({ pricing: [] });
    const d = routeMotionTransfer(baseRequest({ registry: makeMtRegistry([m]) }));
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      assert.equal(d.failure.code, "pricing_unconfigured");
    }
  });

  it("budget insufficient → budget_limit_exceeded", () => {
    const m = makeSyntheticMotionTransferModel({
      pricing: [
        {
          id: "price:expensive",
          unit: "second",
          unitCost: money(100, "USD"),
          conditions: [],
          pricingVersion: "t",
          source: "manual",
          confidence: "high",
        },
      ],
    });
    const d = routeMotionTransfer(
      baseRequest({
        registry: makeMtRegistry([m]),
        budgetLimitMinor: 10, // 8s * 100 = 800 >> 10
      }),
    );
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      assert.equal(d.failure.code, "budget_limit_exceeded");
    }
  });

  it("provider/model hors allowlist", () => {
    const m = makeSyntheticMotionTransferModel();
    const d = routeMotionTransfer(
      baseRequest({
        registry: makeMtRegistry([m]),
        allowedProviders: ["other_provider"],
        allowedModels: ["other_provider::other_model"],
      }),
    );
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      assert.ok(
        d.failure.rejected.some((r) =>
          r.reasons.some((x) => x.code === "provider_not_allowlisted"),
        ),
      );
    }
  });

  it("empty allowlist ⇒ zero candidates", () => {
    const m = makeSyntheticMotionTransferModel();
    const d = routeMotionTransfer(
      baseRequest({
        registry: makeMtRegistry([m]),
        allowedProviders: [],
      }),
    );
    assert.equal(d.status, "failed");
  });

  it("no fidelity reduction / no fallbacks", () => {
    const m = makeSyntheticMotionTransferModel({
      motionTransfer: makeCompleteMotionTransferCaps({
        motionFidelityLevels: {
          standard: "SUPPORTED",
          high: "SUPPORTED",
          critical: "NOT_SUPPORTED",
        },
      }),
    });
    const d = routeMotionTransfer(
      baseRequest({
        registry: makeMtRegistry([m]),
        constraints: {
          fidelity: "critical",
          identityLock: "required",
          preserveTiming: true,
          durationSeconds: 8,
          aspectRatio: "9:16",
          resolution: "1080p",
          fps: 24,
        },
      }),
    );
    assert.equal(d.status, "failed");
    if (d.status === "failed") {
      assert.equal(d.maximumFallbacksPerStep, MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP);
      assert.deepEqual(d.fallbacks, []);
      // Must not silently pick standard/high
      assert.equal(d.failure.code, "motion_capability_unavailable");
    }
  });

  it("critical fidelity prioritizes quality over cheaper model", () => {
    const cheapLow = withScores(
      makeSyntheticMotionTransferModel({
        modelId: "cheap-low",
        pricing: [
          {
            id: "p1",
            unit: "second",
            unitCost: money(1, "USD"),
            conditions: [],
            pricingVersion: "t",
            source: "manual",
            confidence: "high",
          },
        ],
        motionTransfer: makeCompleteMotionTransferCaps({
          motionFidelityLevels: {
            standard: "SUPPORTED",
            high: "SUPPORTED",
            critical: "SUPPORTED",
          },
        }),
      }),
      { quality: 40, identity: 40, reliability: 40, speed: 80 },
    );
    const dearHigh = withScores(
      makeSyntheticMotionTransferModel({
        modelId: "dear-high",
        pricing: [
          {
            id: "p2",
            unit: "second",
            unitCost: money(50, "USD"),
            conditions: [],
            pricingVersion: "t",
            source: "manual",
            confidence: "high",
          },
        ],
        motionTransfer: makeCompleteMotionTransferCaps({
          motionFidelityLevels: {
            standard: "SUPPORTED",
            high: "SUPPORTED",
            critical: "SUPPORTED",
          },
        }),
      }),
      { quality: 95, identity: 95, reliability: 95, speed: 40 },
    );
    const d = routeMotionTransfer(
      baseRequest({
        registry: makeMtRegistry([cheapLow, dearHigh]),
        budgetLimitMinor: 100_000,
        constraints: {
          fidelity: "critical",
          identityLock: "required",
          preserveTiming: true,
          durationSeconds: 8,
          aspectRatio: "9:16",
          resolution: "1080p",
          fps: 24,
        },
      }),
    );
    assert.equal(d.status, "selected");
    if (d.status === "selected") {
      assert.equal(d.selected.modelId, "dear-high");
    }
  });

  it("tie-break stable + exclusion reasons stable", () => {
    const a = withScores(
      makeSyntheticMotionTransferModel({ modelId: "tie-a" }),
      { quality: 80, identity: 80, reliability: 80, speed: 80 },
    );
    const b = withScores(
      makeSyntheticMotionTransferModel({ modelId: "tie-b" }),
      { quality: 80, identity: 80, reliability: 80, speed: 80 },
    );
    // Same pricing so cost ties
    const pricing = a.pricing;
    const a2 = { ...a, pricing };
    const b2 = { ...b, pricing };
    const d1 = routeMotionTransfer(
      baseRequest({ registry: makeMtRegistry([a2, b2]) }),
    );
    const d2 = routeMotionTransfer(
      baseRequest({ registry: makeMtRegistry([b2, a2]) }),
    );
    assert.equal(d1.status, "selected");
    assert.equal(d2.status, "selected");
    if (d1.status === "selected" && d2.status === "selected") {
      assert.equal(d1.selected.modelId, d2.selected.modelId);
      assert.equal(d1.decisionFingerprint, d2.decisionFingerprint);
    }
  });

  it("inputs immutable + decision serializable + redaction", () => {
    const m = makeSyntheticMotionTransferModel();
    const registry = makeMtRegistry([m]);
    const req = baseRequest({ registry });
    const before = structuredClone({
      constraints: req.constraints,
      correlationId: req.correlationId,
    });
    const d = routeMotionTransfer(req);
    assert.deepEqual(
      { constraints: req.constraints, correlationId: req.correlationId },
      before,
    );
    assert.equal(d.status, "selected");
    const json = JSON.stringify(d);
    assert.ok(!/https?:\/\//i.test(json));
    assert.ok(!/data:/i.test(json));
    const red = redactMotionTransferRoutingDecision(d);
    assert.ok(JSON.parse(JSON.stringify(red)));
  });

  it("hostile redaction rejects URL-like rejection messages", () => {
    const m = makeI2vNonMotionModel();
    const d = routeMotionTransfer(baseRequest({ registry: makeMtRegistry([m]) }));
    const red = redactMotionTransferRoutingDecision(d);
    const blob = JSON.stringify(red);
    assert.ok(!/sk-/.test(blob));
    assert.ok(!/eyJ/.test(blob));
  });

  it("zero external effects constants", () => {
    assert.equal(MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP, 0);
    assert.equal(SYNTHETIC_MT_MODEL_ID.length > 0, true);
  });

  it("routingConstraintsFromMotionTransferInput strips media", () => {
    // Minimal structural stand-in — only fields needed for constraint projection
    const input = {
      schemaVersion: "1.0.0" as const,
      capability: "video.motion_transfer" as const,
      sourceVideo: {
        assetId: "a1",
        kind: "video" as const,
        access: { mode: "internal" as const },
      },
      character: {
        characterId: "c1",
        identityReferences: [
          {
            assetId: "img1",
            kind: "image" as const,
            access: { mode: "internal" as const },
          },
        ],
        identityLock: "required" as const,
        outfitLock: "required" as const,
        fullBodyRequired: true,
      },
      motion: {
        preserveMotion: true,
        preserveTiming: true,
        preserveCamera: true,
        fidelity: "high" as const,
        poseControl: "derived_pose" as const,
      },
      output: {
        durationSeconds: 12,
        aspectRatio: "9:16" as const,
        resolution: "1080p",
        fps: 30,
      },
      prompt: "SECRET PROMPT https://evil.example/x",
      qcRequirements: [
        { code: "hands_blocking", severity: "blocking" as const },
      ],
      correlationId: CORR,
    };
    const c = routingConstraintsFromMotionTransferInput(input as never);
    assert.equal(c.fidelity, "high");
    assert.equal(c.identityLock, "required");
    assert.equal(c.handsFeetCritical, true);
    const blob = JSON.stringify(c);
    assert.ok(!blob.includes("https://"));
    assert.ok(!blob.includes("SECRET"));
  });
});

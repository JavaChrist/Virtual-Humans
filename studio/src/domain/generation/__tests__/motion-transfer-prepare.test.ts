/**
 * MT-004 — Motion Transfer Generation Engine dry-run tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "@/domain/cost";
import {
  makeCriticalInput,
  makeIdentityRef,
  makeMinimalInput,
  makeOutfitRef,
  makeVideoRef,
} from "@/domain/motion/__tests__/fixtures";
import {
  buildRegistrySnapshot,
  type ModelCapabilities,
} from "@/domain/routing/capabilities";
import {
  makeCompleteMotionTransferCaps,
  makeI2vNonMotionModel,
  makeProductionLikeSnapshotWithoutMotionTransfer,
  makeSyntheticMotionTransferModel,
  makeT2vNonMotionModel,
  SYNTHETIC_MT_PROVIDER_ID,
} from "@/domain/routing/capabilities/__tests__/motion-transfer-fixtures";
import {
  makeProvider,
  AT,
  CREATED,
  EXPIRES,
} from "@/domain/routing/capabilities/__tests__/fixtures";
import {
  createFakeMotionTransferMediaResolver,
  MOTION_TRANSFER_ENGINE_ACTION,
  runMotionTransferGenerationDryRun,
  type MotionTransferGenerationInput,
} from "../index";

function withScores(model: ModelCapabilities): ModelCapabilities {
  return {
    ...model,
    quality: {
      quality: 80,
      identity: 80,
      speed: 50,
      reliability: 80,
    },
    evidence: [
      ...model.evidence,
      {
        field: "quality.quality",
        source: "manual",
        reference: "mt004-synth",
        confidence: "high",
      },
      {
        field: "quality.identity",
        source: "manual",
        reference: "mt004-synth",
        confidence: "high",
      },
      {
        field: "quality.speed",
        source: "manual",
        reference: "mt004-synth",
        confidence: "high",
      },
      {
        field: "quality.reliability",
        source: "manual",
        reference: "mt004-synth",
        confidence: "high",
      },
    ],
  };
}

function makeEligibleRegistry(models?: ModelCapabilities[]) {
  const m =
    models ??
    [
      withScores(
        makeSyntheticMotionTransferModel({
          pricing: [
            {
              id: "price:mt",
              unit: "second",
              unitCost: money(5, "USD"),
              conditions: [],
              pricingVersion: "t",
              source: "manual",
              confidence: "high",
            },
          ],
        }),
      ),
    ];
  const providerIds = [...new Set(m.map((x) => x.providerId))];
  return buildRegistrySnapshot({
    providers: providerIds.map((id) => makeProvider({ id })),
    models: m,
    createdAt: CREATED,
    registryVersion: "mt004-synthetic",
    expiresAt: EXPIRES,
  });
}

function registerAll(
  resolver: ReturnType<typeof createFakeMotionTransferMediaResolver>,
  input: ReturnType<typeof makeMinimalInput>,
) {
  resolver.register(input.sourceVideo);
  for (const r of input.character.identityReferences) resolver.register(r);
  if (input.character.outfitReference) resolver.register(input.character.outfitReference);
}

function baseRequest(
  motion = makeMinimalInput(),
  over: Partial<MotionTransferGenerationInput> = {},
): MotionTransferGenerationInput {
  return {
    schemaVersion: "1.0.0",
    action: MOTION_TRANSFER_ENGINE_ACTION,
    motion,
    workspaceId: "ws-mt004",
    projectId: "proj-mt004",
    planRevisionId: "plan-rev-1",
    budgetLimitMinor: 10_000,
    currency: "USD",
    correlationId: "corr-mt004",
    at: AT,
    ...over,
  };
}

describe("MT-004 motion_transfer generation dry-run", () => {
  it("valid input + synthetic registry → executable, providerCalled false", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const registry = makeEligibleRegistry();
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry,
      mediaResolver: resolver,
    });
    assert.equal(result.providerCalled, false);
    assert.equal(result.executable, true);
    assert.equal(result.inputValid, true);
    assert.equal(result.mediaResolvable, true);
    assert.equal(result.routeStatus, "selected");
    assert.ok(result.selected?.providerId === SYNTHETIC_MT_PROVIDER_ID);
    assert.ok(result.estimate);
    assert.equal(result.pricingConfigured, true);
    assert.equal(result.budgetFits, true);
    assert.equal(result.syncOrAsync, "async");
    assert.equal(result.pollingRequired, true);
    assert.ok(result.plan);
    assert.equal(result.plan?.routeStatus, "selected");
    assert.equal(result.action, "motion_transfer");
    assert.equal(result.capability, "video.motion_transfer");
    assert.ok(result.idempotencyFingerprint);
    assert.ok(Object.isFrozen(result));
  });

  it("invalid input stopped before resolver", async () => {
    const motion = makeMinimalInput({
      motion: {
        preserveMotion: false,
        preserveTiming: true,
        fidelity: "standard",
      },
    });
    const resolver = createFakeMotionTransferMediaResolver();
    let resolveCalls = 0;
    const wrapped = {
      async resolve(...args: Parameters<typeof resolver.resolve>) {
        resolveCalls += 1;
        return resolver.resolve(...args);
      },
    };
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeEligibleRegistry(),
      mediaResolver: wrapped,
    });
    assert.equal(result.inputValid, false);
    assert.equal(result.mediaResolvable, false);
    assert.equal(result.routeStatus, "skipped");
    assert.equal(resolveCalls, 0);
    assert.equal(result.executable, false);
    assert.equal(result.providerCalled, false);
  });

  it("source video MIME invalid", async () => {
    const motion = makeMinimalInput({
      sourceVideo: {
        ...makeVideoRef(),
        asset: {
          ...makeVideoRef().asset,
          mimeType: "image/png",
        },
      },
    });
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeEligibleRegistry(),
      mediaResolver: resolver,
    });
    // May fail at parse (expectedKinds video) or resolver MIME
    assert.equal(result.executable, false);
    assert.equal(result.providerCalled, false);
    assert.ok(result.blockingReasons.length >= 1);
  });

  it("identity/outfit MIME invalid at resolver", async () => {
    const badIdentity = makeIdentityRef("bad-id");
    badIdentity.asset.mimeType = "video/mp4";
    const motion = makeMinimalInput({
      character: {
        characterId: "mei",
        identityReferences: [badIdentity],
        identityLock: "required",
      },
    });
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeEligibleRegistry(),
      mediaResolver: resolver,
    });
    assert.equal(result.mediaResolvable, false);
    assert.equal(result.executable, false);
  });

  it("data URL rejected by default", async () => {
    const motion = makeMinimalInput({
      sourceVideo: {
        role: "source_video",
        asset: {
          assetId: "data-vid",
          kind: "video",
          mimeType: "video/mp4",
          checksum: "sha256:x",
          access: { kind: "data_url", dataUrl: "data:video/mp4;base64,AAAA" },
        },
        durationSeconds: 4,
      },
    });
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeEligibleRegistry(),
      mediaResolver: resolver,
    });
    assert.equal(result.executable, false);
    assert.ok(
      result.blockingReasons.some((r) =>
        /data.?url|invalid|forbidden/i.test(r.code + r.message),
      ),
    );
  });

  it("signed URL redacted from dry-run / fingerprint unaffected by URL body", async () => {
    const expiresAt = "2099-01-01T00:00:00.000Z";
    const makeSigned = (url: string) =>
      makeMinimalInput({
        sourceVideo: {
          role: "source_video",
          asset: {
            assetId: "signed-vid",
            kind: "video",
            mimeType: "video/mp4",
            checksum: "sha256:signed",
            access: { kind: "signed_url", url, expiresAt },
          },
          durationSeconds: 8,
        },
      });
    const a = makeSigned("https://cdn.example.com/a?X-Amz-Signature=secret1");
    const b = makeSigned("https://cdn.example.com/b?X-Amz-Signature=secret2");
    const registry = makeEligibleRegistry();

    const ra = createFakeMotionTransferMediaResolver();
    registerAll(ra, a);
    const da = await runMotionTransferGenerationDryRun(baseRequest(a), {
      registry,
      mediaResolver: ra,
      allowDataUrl: false,
    });

    const rb = createFakeMotionTransferMediaResolver();
    registerAll(rb, b);
    const db = await runMotionTransferGenerationDryRun(baseRequest(b), {
      registry,
      mediaResolver: rb,
    });

    // parse may allow signed_url; fingerprints should match (URL omitted from fp)
    assert.equal(da.resolved?.sourceVideoFingerprint, db.resolved?.sourceVideoFingerprint);
    const blob = JSON.stringify(da);
    assert.ok(!blob.includes("secret1"));
    assert.ok(!blob.includes("X-Amz-Signature=secret"));
  });

  it("resolver failure normalized", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    // intentionally not registered
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeEligibleRegistry(),
      mediaResolver: resolver,
    });
    assert.equal(result.mediaResolvable, false);
    assert.equal(result.routeStatus, "skipped");
    assert.ok(result.blockingReasons.some((r) => r.code === "asset_unavailable"));
  });

  it("Production registry empty → motion_capability_unavailable", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeProductionLikeSnapshotWithoutMotionTransfer(),
      mediaResolver: resolver,
    });
    assert.equal(result.providerCalled, false);
    assert.equal(result.executable, false);
    assert.equal(result.routeStatus, "failed");
    assert.ok(
      result.blockingReasons.some((r) => r.code === "motion_capability_unavailable"),
    );
  });

  it("I2V/T2V never used", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const registry = buildRegistrySnapshot({
      providers: [makeProvider({ id: "fal" })],
      models: [makeI2vNonMotionModel(), makeT2vNonMotionModel()],
      createdAt: CREATED,
      registryVersion: "hostile-i2v",
      expiresAt: EXPIRES,
    });
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry,
      mediaResolver: resolver,
    });
    assert.equal(result.executable, false);
    assert.equal(result.selected, undefined);
    assert.ok(
      result.blockingReasons.some((r) => r.code === "motion_capability_unavailable"),
    );
  });

  it("budget insuffisant", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const result = await runMotionTransferGenerationDryRun(
      baseRequest(motion, { budgetLimitMinor: 1 }),
      { registry: makeEligibleRegistry(), mediaResolver: resolver },
    );
    assert.equal(result.executable, false);
    assert.ok(
      result.blockingReasons.some((r) => r.code === "budget_limit_exceeded"),
    );
  });

  it("pricing absent → not executable", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const registry = makeEligibleRegistry([
      withScores(makeSyntheticMotionTransferModel({ pricing: [] })),
    ]);
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry,
      mediaResolver: resolver,
    });
    assert.equal(result.executable, false);
    assert.ok(
      result.blockingReasons.some((r) => r.code === "pricing_unconfigured"),
    );
  });

  it("critical human review + QC transported", async () => {
    const motion = makeCriticalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    // need critical fidelity SUPPORTED on synthetic model (default yes)
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeEligibleRegistry(),
      mediaResolver: resolver,
    });
    assert.equal(result.humanValidationRequired, true);
    assert.equal(result.qcRequired, true);
    assert.ok(result.plan?.qcRequirements.some((q) => q.humanValidationRequired));
    assert.equal(result.plan?.motionFidelity, "critical");
  });

  it("plan déterministe + fingerprints stables", async () => {
    const motion = makeMinimalInput();
    const registry = makeEligibleRegistry();
    const r1 = createFakeMotionTransferMediaResolver();
    registerAll(r1, motion);
    const r2 = createFakeMotionTransferMediaResolver();
    registerAll(r2, motion);
    const a = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry,
      mediaResolver: r1,
    });
    const b = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry,
      mediaResolver: r2,
    });
    assert.equal(a.planFingerprint, b.planFingerprint);
    assert.equal(a.idempotencyFingerprint, b.idempotencyFingerprint);
    assert.deepEqual(a.selected, b.selected);
  });

  it("critical changes modify fingerprint", async () => {
    const registry = makeEligibleRegistry();
    const m1 = makeMinimalInput();
    const m2 = makeMinimalInput({
      sourceVideo: makeVideoRef("other-source"),
    });
    const r1 = createFakeMotionTransferMediaResolver();
    registerAll(r1, m1);
    const r2 = createFakeMotionTransferMediaResolver();
    registerAll(r2, m2);
    const a = await runMotionTransferGenerationDryRun(baseRequest(m1), {
      registry,
      mediaResolver: r1,
    });
    const b = await runMotionTransferGenerationDryRun(baseRequest(m2), {
      registry,
      mediaResolver: r2,
    });
    assert.notEqual(a.planFingerprint, b.planFingerprint);
    assert.notEqual(
      a.resolved?.sourceVideoFingerprint,
      b.resolved?.sourceVideoFingerprint,
    );
  });

  it("inputs immutable", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const req = baseRequest(motion);
    const before = structuredClone(req);
    await runMotionTransferGenerationDryRun(req, {
      registry: makeEligibleRegistry(),
      mediaResolver: resolver,
    });
    assert.deepEqual(req, before);
  });

  it("hostile redaction — no prompts/secrets in public result", async () => {
    const motion = makeMinimalInput({
      prompt: "SECRET_PROMPT https://evil.example/x?token=abc",
      negativeConstraints: ["secret-neg"],
    });
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry: makeEligibleRegistry(),
      mediaResolver: resolver,
    });
    const blob = JSON.stringify(result);
    assert.ok(!blob.includes("SECRET_PROMPT"));
    assert.ok(!blob.includes("evil.example"));
    assert.ok(!blob.includes("sk-"));
    assert.equal(result.providerCalled, false);
  });

  it("action distinct from I2V/T2V", () => {
    assert.equal(MOTION_TRANSFER_ENGINE_ACTION, "motion_transfer");
    assert.notEqual(MOTION_TRANSFER_ENGINE_ACTION, "video");
  });

  it("sync plan flags from model capabilities", async () => {
    const motion = makeMinimalInput();
    const resolver = createFakeMotionTransferMediaResolver();
    registerAll(resolver, motion);
    const registry = makeEligibleRegistry([
      withScores(
        makeSyntheticMotionTransferModel({
          motionTransfer: makeCompleteMotionTransferCaps({
            syncOrAsync: "sync",
            pollingRequired: false,
          }),
          pricing: [
            {
              id: "p",
              unit: "second",
              unitCost: money(5, "USD"),
              conditions: [],
              pricingVersion: "t",
              source: "manual",
              confidence: "high",
            },
          ],
        }),
      ),
    ]);
    const result = await runMotionTransferGenerationDryRun(baseRequest(motion), {
      registry,
      mediaResolver: resolver,
    });
    assert.equal(result.executable, true);
    assert.equal(result.syncOrAsync, "sync");
    assert.equal(result.pollingRequired, false);
  });

  it("outfit change modifies fingerprint", async () => {
    const registry = makeEligibleRegistry();
    const m1 = makeMinimalInput({ outfitReference: makeOutfitRef("o1") } as never);
    // fix: character.outfitReference
    const aMotion = makeMinimalInput({
      character: {
        characterId: "mei",
        identityReferences: [makeIdentityRef()],
        identityLock: "required",
        outfitReference: makeOutfitRef("o1"),
      },
    });
    const bMotion = makeMinimalInput({
      character: {
        characterId: "mei",
        identityReferences: [makeIdentityRef()],
        identityLock: "required",
        outfitReference: makeOutfitRef("o2"),
      },
    });
    const r1 = createFakeMotionTransferMediaResolver();
    registerAll(r1, aMotion);
    const r2 = createFakeMotionTransferMediaResolver();
    registerAll(r2, bMotion);
    const a = await runMotionTransferGenerationDryRun(baseRequest(aMotion), {
      registry,
      mediaResolver: r1,
    });
    const b = await runMotionTransferGenerationDryRun(baseRequest(bMotion), {
      registry,
      mediaResolver: r2,
    });
    assert.notEqual(a.planFingerprint, b.planFingerprint);
    void m1;
  });
});

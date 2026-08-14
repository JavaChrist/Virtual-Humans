/**
 * Phase 11B — I2V Production wiring preflight (fakes only, 0 provider, 0 media).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FAL_KLING_I2V_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-i2v-registry-profile";
import { FAL_KLING_V3_PRO_REGISTRY_PROFILE } from "@/domain/routing/capabilities/fal-kling-motion-control-registry-profile";
import { createVhs11BAllowlistedFalI2vAdapter, resolveDirectorI2vProviderAdapters, runPhase11BI2vAdapterContractSuite } from "@/infrastructure/providers/vhs11b-fal-i2v-exception";
import type { FalClientPort } from "@/infrastructure/providers/contracts";
import { createUniversalFakeAdapter } from "@/infrastructure/providers/fake-universal-adapter";
import {
  PHASE_11B_ACTION,
  PHASE_11B_CAPABILITY,
  PHASE_11B_DURATION_SECONDS,
  PHASE_11B_I2V_CAPABILITY_FLAG_ENV,
  PHASE_11B_LIVE_BUDGET,
  PHASE_11B_MODEL,
  PHASE_11B_PARENT_PENDING_PREFIX,
  PHASE_11B_PROJECT_ID,
  PHASE_11B_PROVIDER,
  PHASE_11B_REJECTED_ASSET_PREFIXES,
  PHASE_11B_RUNWAY_CANDIDATE,
  PHASE_11B_SCENE_ID,
  PHASE_11B_SOURCE_ASSET_ID,
  PHASE_11B_SOURCE_CHECKSUM,
  PHASE_11B_WORKSPACE_ID,
  assertPhase11BDoesNotCallOpenAIImage,
  assertPhase11BDoesNotUseRejectedOrPendingSource,
  assertPhase11BI2vFlagsRemainOff,
  assertPhase11BNotLegacyImageEndpoint,
  assertVhs11BFalI2vAllowlistScope,
  assertVhs11BFalI2vExceptionActive,
  estimatePhase11BKlingI2vUsd,
  isVhs11BFalI2vExceptionEnabled,
  phase11BFutureBudgetCompare,
  phase11BI2vFlagsAuditView,
  phase11BI2vWiringDryRun,
} from "../phase-11b-i2v-allowlist";
import {
  assertPhase11BSourceReferenceReady,
  buildPhase11BApprovedSourceReference,
  phase11BSyntheticApprovedFacts,
  resolveExistingAssetInputsFromStep,
} from "../phase-11b-existing-asset";
import { buildPhase11BSingleStepGenerationPlan } from "../phase-11b-single-step-plan";
import {
  assertPhase11BMayCreateSignedUrl,
  assertPhase11BResolverHostAllowlist,
  phase11BResolverMustStayUnsigned,
  redactPhase11BResolverError,
  resolvePhase11BExistingAssetToInternalInput,
} from "../phase-11b-i2v-resolver";
import {
  assertPhase11BI2vNoAutomaticDownstream,
  cancelPhase11BI2vJob,
  createPhase11BI2vJobState,
  incrementPhase11BI2vQueueAttempt,
  markPhase11BI2vSubmissionUnknown,
  persistPhase11BI2vSubmitIntent,
  pollPhase11BI2vJob,
  recordPhase11BI2vSubmit,
  recoverPhase11BI2vFreshProcess,
  settlePhase11BI2vLedgerOnce,
} from "../phase-11b-i2v-worker";
import {
  assertPhase11BI2vFetchHostAllowlist,
  assertPhase11BI2vNoOverwrite,
  assertPhase11BI2vOutputMime,
  assertPhase11BI2vOutputSize,
  buildPhase11BI2vOutputStoragePath,
  createPhase11BI2vOutputProvenance,
} from "../phase-11b-i2v-ingest";
import { assertPhase11BI2vNoAutoApprove, evaluatePhase11BI2vTechnicalQuality } from "../phase-11b-i2v-quality";
import { assertPhase11BI2vReviewStaysLocal, createPhase11BI2vReviewHandoff } from "../phase-11b-i2v-human-review";
import {
  MV002_STATUS_DEFERRED,
  assertMotionRegistryStaysDisabled,
  assertMv002RemainsDeferred,
  assertPhase11ADoesNotInvokeMotionEndpoint,
  assertPhase11ADoesNotUseMotionProject,
} from "../phase-11a-motion-isolation";
import { createExistingMediaAssetReference } from "@/domain/generation/existing-media-asset-reference";

const PLAN_INPUT = {
  storyboardRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  scenePackageRevisionIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  createdAt: "2026-08-14T18:00:00.000Z",
  createdBy: "00000000-0000-4000-8000-000000000001",
  correlationId: "11b-i2v-wiring-preflight",
};

function silentFalClient(): FalClientPort {
  return {
    async submitJob() {
      throw new Error("Phase 11B tests must not submit to fal.");
    },
    async checkJob() {
      throw new Error("Phase 11B tests must not poll fal.");
    },
  };
}

test("11B — flags and exception remain OFF", () => {
  assert.equal(isVhs11BFalI2vExceptionEnabled({}), false);
  assert.throws(() => assertVhs11BFalI2vExceptionActive({ env: {} }), /disabled/i);
  assertPhase11BI2vFlagsRemainOff({});
  const flags = phase11BI2vFlagsAuditView({});
  assert.equal(flags.capability, false);
  assert.equal(flags.paid, false);
  assert.equal(flags.provider, false);
  assert.equal(flags.worker, false);
  assert.equal(flags.exception, false);
  assert.equal(flags.downstream, false);
  assert.equal(flags.mergeExport, false);
  assert.equal(flags.motion, false);
  assert.throws(
    () => assertPhase11BI2vFlagsRemainOff({ [PHASE_11B_I2V_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
});

test("11B — dry-run compare-only without provider", () => {
  const dry = phase11BI2vWiringDryRun();
  assert.equal(dry.providerCalled, false);
  assert.equal(dry.signedUrlCount, 0);
  assert.equal(dry.mediaReads, 0);
  assert.equal(dry.productionWrites, 0);
  assert.equal(dry.persistedPlan, false);
  assert.equal(dry.capability, PHASE_11B_CAPABILITY);
  assert.equal(dry.model, PHASE_11B_MODEL);
  assert.equal(dry.durationSeconds, PHASE_11B_DURATION_SECONDS);
});

test("11B — Existing Asset Reference binds approved inactive 11A still", () => {
  const source = buildPhase11BApprovedSourceReference();
  const facts = phase11BSyntheticApprovedFacts(source);
  assertPhase11BSourceReferenceReady(source, facts);
  assert.equal(source.assetId, PHASE_11B_SOURCE_ASSET_ID);
  assert.equal(source.expectedChecksum, PHASE_11B_SOURCE_CHECKSUM);
  assert.equal(source.workspaceId, PHASE_11B_WORKSPACE_ID);
  assert.equal(source.projectId, PHASE_11B_PROJECT_ID);
  assert.equal(source.sourceSceneId, PHASE_11B_SCENE_ID);
  assert.equal(facts.active, false);
  assert.equal(facts.lifecycle, "approved");
  const blob = JSON.stringify(source);
  assert.equal(/https?:\/\//i.test(blob), false);
});

test("11B — pending/rejected/parent sources forbidden", () => {
  for (const prefix of PHASE_11B_REJECTED_ASSET_PREFIXES) {
    assert.throws(
      () => assertPhase11BDoesNotUseRejectedOrPendingSource(`${prefix}-0000-4000-8000-000000000000`),
      /rejected/,
    );
  }
  assert.throws(
    () =>
      assertPhase11BDoesNotUseRejectedOrPendingSource(
        `${PHASE_11B_PARENT_PENDING_PREFIX}-0000-4000-8000-000000000000`,
      ),
    /pending/,
  );
});

test("11B — resolve existing_asset without signed URL", () => {
  const built = buildPhase11BSingleStepGenerationPlan(PLAN_INPUT);
  const resolved = resolveExistingAssetInputsFromStep(built.plan.scenePlans[0]!.steps[0]!);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]!.role, "i2v_start_frame");
  assert.equal(resolved[0]!.asset.access.kind, "internal");
  assert.equal(resolved[0]!.asset.assetId, PHASE_11B_SOURCE_ASSET_ID);
  assert.equal(JSON.stringify(resolved).includes("http"), false);
});

test("11B — GenerationPlan single-step I2V, not persisted", () => {
  const a = buildPhase11BSingleStepGenerationPlan(PLAN_INPUT);
  const b = buildPhase11BSingleStepGenerationPlan(PLAN_INPUT);
  assert.equal(a.fingerprint, b.fingerprint);
  assert.equal(a.stepCount, 1);
  assert.equal(a.fallbackCount, 0);
  assert.equal(a.retryCount, 0);
  assert.equal(a.downstreamCount, 0);
  assert.equal(a.humanReviewRequired, true);
  assert.equal(a.persistedToProduction, false);
  assert.equal(a.plan.scenePlans.length, 1);
  const step = a.plan.scenePlans[0]!.steps[0]!;
  assert.equal(step.action, PHASE_11B_ACTION);
  assert.equal(step.capabilityProfile, PHASE_11B_CAPABILITY);
  assert.equal(step.providerId, PHASE_11B_PROVIDER);
  assert.equal(step.modelId, PHASE_11B_MODEL);
  assert.equal(step.fallbacks.length, 0);
  assert.equal(step.expectedOutput.durationSeconds, 5);
  assert.equal(step.inputRefs[0]!.kind, "existing_asset");
  assert.equal(a.plan.budgetDecision.allowed, false);
  assert.equal(a.plan.budgetDecision.reason, "insufficient_funds");
  assert.ok(step.selection.rejectedAlternatives.some((r) => r.modelId === PHASE_11B_RUNWAY_CANDIDATE));
  assert.ok(
    step.selection.rejectedAlternatives.some((r) => r.modelId.includes("text-to-video")),
  );
});

test("11B — Router/Registry allowlist rejects Motion/T2V/legacy/OpenAI", () => {
  const ok = {
    workspaceId: PHASE_11B_WORKSPACE_ID,
    projectId: PHASE_11B_PROJECT_ID,
    sceneId: PHASE_11B_SCENE_ID,
    action: PHASE_11B_ACTION,
    capabilityProfile: PHASE_11B_CAPABILITY,
    providerId: PHASE_11B_PROVIDER,
    modelId: PHASE_11B_MODEL,
  };
  assertVhs11BFalI2vAllowlistScope(ok);
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, capabilityProfile: "video.text_to_video" }),
    /capability/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, modelId: PHASE_11B_RUNWAY_CANDIDATE }),
    /Kling/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, motionRequested: true }),
    /forbidden/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, t2vRequested: true }),
    /forbidden/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, legacyEndpoint: true }),
    /forbidden/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, openaiImageRequested: true }),
    /forbidden/,
  );
  assert.throws(
    () => assertVhs11BFalI2vAllowlistScope({ ...ok, downstreamRequested: true }),
    /forbidden/,
  );
});

test("11B — disabled I2V Registry profile is not globally eligible", () => {
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.enabled, false);
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.paidExecution, false);
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.globallyEligible, false);
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.insertedIntoProductionSnapshot, false);
  assert.equal(FAL_KLING_I2V_REGISTRY_PROFILE.capabilities.enabled, false);
  assert.deepEqual(FAL_KLING_I2V_REGISTRY_PROFILE.capabilities.supportedProfiles, [
    "video.image_to_video",
  ]);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.enabled, false);
  assert.equal(FAL_KLING_V3_PRO_REGISTRY_PROFILE.paidExecution, false);
});

test("11B — adapter contract suite (allowlisted wrapper, fake client unused)", () => {
  const adapter = createVhs11BAllowlistedFalI2vAdapter(silentFalClient());
  runPhase11BI2vAdapterContractSuite(adapter);
  assert.equal(adapter.supports(PHASE_11B_MODEL, "video"), true);
  assert.equal(adapter.supports("fal-ai/kling-video/v2/master/text-to-video", "video"), false);
  assert.equal(adapter.supports("fal-ai/kling-video/v3/pro/motion-control", "motion_transfer"), false);
  assert.equal(adapter.supports(PHASE_11B_RUNWAY_CANDIDATE, "video"), false);
  const universal = createUniversalFakeAdapter("fal");
  assert.throws(() => runPhase11BI2vAdapterContractSuite(universal), /T2V|Motion|must not/);
});

test("11B — default Director I2V adapters stay fake", () => {
  const resolved = resolveDirectorI2vProviderAdapters({ env: {} });
  assert.equal(resolved.realI2v, false);
  assert.ok(resolved.adapters.every((a) => a.providerId === "fal" || a.providerId === "openai" || a.providerId === "elevenlabs"));
});

test("11B — resolver stays unsigned and redacts hostile URLs", () => {
  const source = buildPhase11BApprovedSourceReference();
  const facts = phase11BSyntheticApprovedFacts(source);
  const resolved = resolvePhase11BExistingAssetToInternalInput(source, facts);
  assert.equal(resolved.asset.access.kind, "internal");
  assert.throws(
    () =>
      assertPhase11BMayCreateSignedUrl({
        reserved: false,
        immediatelyBeforeSubmit: true,
        authorized: true,
      }),
    /forbidden/,
  );
  const store = { signedUrlCount: 0, mediaReads: 0, persistedPayloads: [] as unknown[] };
  phase11BResolverMustStayUnsigned(store, { path: source.expectedStoragePath });
  assert.throws(
    () => phase11BResolverMustStayUnsigned(store, { url: "https://evil.example/token=abc" }),
    /persist/,
  );
  assert.throws(() => assertPhase11BResolverHostAllowlist("evil.example"), /allowlisted/);
  assert.match(
    redactPhase11BResolverError("failed https://storage.example/x?token=secret"),
    /\[redacted-url\]/,
  );
});

test("11B — worker submit/poll/fresh-process/no-resubmit/ledger once", () => {
  let state = createPhase11BI2vJobState();
  state = persistPhase11BI2vSubmitIntent(state);
  state = recordPhase11BI2vSubmit(state, "fake-job-1");
  assert.throws(() => recordPhase11BI2vSubmit(state, "fake-job-2"), /resubmit/);
  state = pollPhase11BI2vJob(state, "IN_PROGRESS");
  const recovered = recoverPhase11BI2vFreshProcess(state);
  assert.equal(recovered.status, "polling");
  assert.equal(recovered.submitCount, 1);
  state = pollPhase11BI2vJob(recovered, "COMPLETED");
  state = settlePhase11BI2vLedgerOnce(state);
  const again = settlePhase11BI2vLedgerOnce(state);
  assert.equal(again.ledgerSettled, true);
  assert.equal(again.submitCount, 1);
  assertPhase11BI2vNoAutomaticDownstream(again);

  let unknown = persistPhase11BI2vSubmitIntent(createPhase11BI2vJobState());
  unknown = markPhase11BI2vSubmissionUnknown(unknown);
  assert.throws(() => recordPhase11BI2vSubmit(unknown, "x"), /submission_unknown/);

  let late = persistPhase11BI2vSubmitIntent(createPhase11BI2vJobState());
  late = recordPhase11BI2vSubmit(late, "late-1");
  late = pollPhase11BI2vJob(late, "LATE");
  assert.equal(late.status, "quarantined");

  const cancelled = cancelPhase11BI2vJob(createPhase11BI2vJobState());
  assert.equal(cancelled.status, "cancelled");
  let queue = createPhase11BI2vJobState();
  queue = incrementPhase11BI2vQueueAttempt(queue);
  queue = incrementPhase11BI2vQueueAttempt(queue);
  queue = incrementPhase11BI2vQueueAttempt(queue);
  assert.throws(() => incrementPhase11BI2vQueueAttempt(queue), /max_attempts/);
});

test("11B — ingest path private, no overwrite, hostile URL rejected", () => {
  const outputId = "77777777-7777-4777-8777-777777777777";
  const path = buildPhase11BI2vOutputStoragePath(outputId);
  assert.ok(path.startsWith(`${PHASE_11B_WORKSPACE_ID}/${PHASE_11B_PROJECT_ID}/media/video/i2v/`));
  assertPhase11BI2vOutputMime("video/mp4");
  assert.throws(() => assertPhase11BI2vOutputMime("image/png"), /MIME/);
  assertPhase11BI2vOutputSize(1024);
  assert.throws(() => assertPhase11BI2vOutputSize(0), /size/);
  assert.throws(() => assertPhase11BI2vFetchHostAllowlist("http://127.0.0.1/x"), /hostile|https/);
  assert.throws(() => assertPhase11BI2vFetchHostAllowlist("https://169.254.169.254/latest"), /hostile/);
  assertPhase11BI2vNoOverwrite(false);
  assert.throws(() => assertPhase11BI2vNoOverwrite(true), /overwrite/);
  const provenance = createPhase11BI2vOutputProvenance({
    sourceAssetId: PHASE_11B_SOURCE_ASSET_ID,
    sourceChecksum: PHASE_11B_SOURCE_CHECKSUM,
    outputAssetId: outputId,
  });
  assert.equal(provenance.active, false);
  assert.equal(JSON.stringify(provenance).includes("http"), false);
});

test("11B — QC video technical + visual humanOnly, no auto-approve", () => {
  const result = evaluatePhase11BI2vTechnicalQuality({
    mime: "video/mp4",
    durationSeconds: 5,
    expectedDurationSeconds: 5,
    width: 1024,
    height: 1024,
    fps: 24,
    bytes: 1_000_000,
    checksum: "c".repeat(64),
    probeAvailable: false,
    provenanceOk: true,
  });
  assert.equal(result.visualStatus, "unavailable_humanOnly");
  assert.equal(result.humanReviewRequired, true);
  assert.equal(result.autoApprove, false);
  assert.equal(result.technicalStatus, "needs_review");
  assertPhase11BI2vNoAutoApprove(result);
  const bad = evaluatePhase11BI2vTechnicalQuality({
    mime: "application/octet-stream",
    durationSeconds: 5,
    expectedDurationSeconds: 5,
    width: 1024,
    height: 1024,
    bytes: 10,
    checksum: "d".repeat(64),
    probeAvailable: false,
    provenanceOk: true,
  });
  assert.equal(bad.technicalStatus, "rejected");
});

test("11B — Human Review handoff stays local", () => {
  const handoff = createPhase11BI2vReviewHandoff({
    outputAssetId: "88888888-8888-4888-8888-888888888888",
    qualityReportId: "99999999-9999-4999-8999-999999999999",
    reviewRequestId: "11b-hr-local",
  });
  assert.equal(handoff.persistedToProduction, false);
  assert.equal(handoff.activationAuthorized, false);
  assert.equal(handoff.mergeExportAuthorized, false);
  assert.equal(handoff.retryCreatesJob, false);
  assertPhase11BI2vReviewStaysLocal(false);
  assert.throws(() => assertPhase11BI2vReviewStaysLocal(true), /Production/);
});

test("11B — budget compare-only Kling vs Runway, no write", () => {
  const cmp = phase11BFutureBudgetCompare();
  assert.equal(cmp.availableMinor, PHASE_11B_LIVE_BUDGET.available);
  assert.equal(cmp.klingEstimateMinor, Math.round(estimatePhase11BKlingI2vUsd() * 100));
  assert.ok(cmp.klingReservationMinor >= cmp.klingEstimateMinor);
  assert.ok(cmp.klingShortfallMinor > 0);
  assert.ok(cmp.runwayEstimateMinor < cmp.klingEstimateMinor);
  assert.equal(cmp.selectedModel, PHASE_11B_MODEL);
  assert.equal(cmp.runwayStatus, "same_fal_transport_not_allowlisted");
  assert.equal(cmp.hardLimitMinimumKling, PHASE_11B_LIVE_BUDGET.committed + cmp.klingReservationMinor);
});

test("11B — isolation Motion / T2V / legacy / OpenAI / activation", () => {
  assertPhase11ADoesNotUseMotionProject(PHASE_11B_PROJECT_ID);
  assertPhase11ADoesNotInvokeMotionEndpoint(PHASE_11B_ACTION);
  assertPhase11ADoesNotInvokeMotionEndpoint(PHASE_11B_MODEL);
  assertMv002RemainsDeferred(MV002_STATUS_DEFERRED);
  assertMotionRegistryStaysDisabled({ enabled: false, paidExecution: false });
  assertPhase11BDoesNotCallOpenAIImage(0);
  assert.throws(() => assertPhase11BDoesNotCallOpenAIImage(1), /OpenAI Image/);
  assert.throws(() => assertPhase11BNotLegacyImageEndpoint("/api/generate/image"), /legacy/);
  assert.throws(() => assertPhase11BNotLegacyImageEndpoint("/api/generate/video"), /legacy/);
  assert.throws(
    () =>
      assertVhs11BFalI2vAllowlistScope({
        projectId: PHASE_11B_PROJECT_ID,
        sceneId: PHASE_11B_SCENE_ID,
        action: PHASE_11B_ACTION,
        capabilityProfile: PHASE_11B_CAPABILITY,
        providerId: PHASE_11B_PROVIDER,
        modelId: PHASE_11B_MODEL,
        activationRequested: true,
      }),
    /forbidden/,
  );
  const generic = createExistingMediaAssetReference({
    workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    assetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    expectedChecksum: "e".repeat(64),
    expectedMimeType: "image/png",
    expectedWidth: 64,
    expectedHeight: 64,
    sourceRole: "i2v_start_frame",
    sourceSceneId: "scene-9",
    expectedStoragePath:
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/media/image/composed/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png",
  });
  assert.notEqual(generic.assetId, PHASE_11B_SOURCE_ASSET_ID);
});

/**
 * Phase 11E — Director merge/export path. Fakes only. 0 engine. 0 Production media.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createExistingTimedMediaAssetReference } from "@/domain/generation/existing-timed-media-asset-reference";
import { readMergeExportAuthorized } from "../artifact-bundle-coherence";
import {
  PHASE_11E_ENGINE,
  PHASE_11E_EXPORT_ACTION,
  PHASE_11E_EXPORT_CAPABILITY,
  PHASE_11E_EXPORT_CAPABILITY_FLAG_ENV,
  PHASE_11E_LEGACY_MERGE_ROUTE,
  PHASE_11E_LIVE_BUDGET,
  PHASE_11E_MERGE_ACTION,
  PHASE_11E_MERGE_CAPABILITY,
  PHASE_11E_MERGE_CAPABILITY_FLAG_ENV,
  PHASE_11E_MERGE_EXPORT_WIRING_AUTH,
  PHASE_11E_MERGE_EXPORT_WIRING_VERDICT,
  PHASE_11E_MODEL,
  PHASE_11E_NEXT_AUTH,
  PHASE_11E_REUSED_MERGE_CAPABILITIES,
  assertPhase11EMergeExportAuthorizedFalse,
  assertPhase11EMergeExportFlagsRemainOff,
  assertPhase11ENotLegacyMergeEndpoint,
  assertPhase11ERegistryDisabled,
  assertVhs11EMergeExportAllowlistScope,
  phase11EMergeExportFlagsAuditView,
  redactPhase11EError,
} from "../phase-11e-merge-export-allowlist";
import {
  createOpaqueMergeExportFixtureBundle,
  createOpaqueMergeExportFixtureFacts,
  resolveExplicitMergeExportBundle,
  selectLastActiveArtifact,
} from "../phase-11e-merge-export-bundle";
import {
  PHASE_11E_FAKE_EXPORT_ADAPTER_ID,
  PHASE_11E_FAKE_MERGE_ADAPTER_ID,
  runPhase11EFakeExportAdapter,
  runPhase11EFakeMergeAdapter,
} from "../phase-11e-merge-export-fake-adapter";
import {
  cancelPhase11EInStore,
  createPhase11EMergeExportStore,
  executePhase11EExportFake,
  executePhase11EMergeFake,
  failPhase11EStructured,
  markPhase11EDryRunInStore,
  phase11EAllowlistSnapshot,
  refusePhase11ERealMergeExport,
  runPhase11EMergeExportWiringDryRun,
} from "../phase-11e-merge-export-orchestration";
import {
  buildPhase11EExportIdempotencyKey,
  buildPhase11EExportPlan,
  buildPhase11EMergeIdempotencyKey,
  buildPhase11EMergePlan,
} from "../phase-11e-merge-export-plan";
import {
  assertCompletedDoesNotAuthorizeMergeExport,
  assertPhase11EMergeExportNoAutoApprove,
  createPhase11EMergeExportReviewHandoff,
  evaluatePhase11EMergeExportTechnicalQuality,
} from "../phase-11e-merge-export-qc";
import {
  beginPhase11EFakeSubmit,
  cancelPhase11EJob,
  completePhase11EFake,
  createPhase11EJobState,
  failPhase11EJob,
} from "../phase-11e-merge-export-run-state";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function cloneBundle() {
  return createOpaqueMergeExportFixtureBundle("fake");
}

test("11E — auth, capabilities réutilisées, flags OFF, budget inchangé, moteur absent", () => {
  assert.equal(
    PHASE_11E_MERGE_EXPORT_WIRING_AUTH,
    "AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_IMPLEMENT_DISABLED_NO_PROVIDER_NO_DEPLOY_NO_FLAG_WRITE",
  );
  assert.equal(PHASE_11E_MERGE_EXPORT_WIRING_VERDICT, "VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRED_DISABLED_READY");
  assert.equal(
    PHASE_11E_NEXT_AUTH,
    "AUTH_VHS_DIRECTOR_MERGE_EXPORT_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE",
  );
  assert.equal(PHASE_11E_MERGE_CAPABILITY, "postproduction.merge");
  assert.equal(PHASE_11E_EXPORT_CAPABILITY, "postproduction.export");
  assert.equal(PHASE_11E_MERGE_ACTION, "merge");
  assert.equal(PHASE_11E_EXPORT_ACTION, "export");
  assert.equal(PHASE_11E_ENGINE, "unavailable");
  assert.equal(PHASE_11E_MODEL, "unavailable");
  assert.equal(PHASE_11E_REUSED_MERGE_CAPABILITIES.executionEnabled, false);
  assertPhase11EMergeExportFlagsRemainOff({});
  const flags = phase11EMergeExportFlagsAuditView({});
  assert.equal(flags.mergeCapability, false);
  assert.equal(flags.exportCapability, false);
  assert.equal(flags.paid, false);
  assert.equal(flags.provider, false);
  assert.equal(flags.worker, false);
  assert.equal(flags.exception, false);
  assert.equal(flags.publishDownstream, false);
  assert.equal(flags.mergeExportAuthorized, false);
  assert.equal(flags.engineSelected, false);
  assert.equal(PHASE_11E_LIVE_BUDGET.hard, 437);
  assert.equal(PHASE_11E_LIVE_BUDGET.committed, 391);
  assert.equal(PHASE_11E_LIVE_BUDGET.reserved, 0);
  assert.equal(PHASE_11E_LIVE_BUDGET.available, 46);
  const snapshot = phase11EAllowlistSnapshot();
  assert.equal(snapshot.engineSelected, false);
  assert.equal(snapshot.realMergeAdapterPresent, false);
  assert.equal(snapshot.realExportAdapterPresent, false);
  assert.equal(snapshot.mergeAuthorized, false);
  assert.equal(snapshot.exportAuthorized, false);
  assert.throws(
    () => assertPhase11EMergeExportFlagsRemainOff({ [PHASE_11E_MERGE_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
  assert.throws(
    () => assertPhase11EMergeExportFlagsRemainOff({ [PHASE_11E_EXPORT_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
});

test("11E — bundle cohérent et sélection explicite d’assets approuvés inactifs", () => {
  const bundle = cloneBundle();
  const facts = createOpaqueMergeExportFixtureFacts(bundle);
  const resolved = resolveExplicitMergeExportBundle(bundle, facts);
  assert.equal(resolved.video.kind, "video");
  assert.equal(resolved.audio.kind, "audio");
  assert.equal(resolved.lipsync.kind, "fake");
  assert.equal(resolved.video.expectedLifecycle, "approved");
  assert.equal(facts.video.active, false);
  assert.equal(facts.audio.active, false);
  assert.equal(facts.video.bucketPrivate, true);
  assert.equal(resolved.targetFormat, "video/mp4");
  assert.equal(resolved.expectedDurationMs, 26_000);
});

test("11E — vidéo absente", () => {
  const bundle = cloneBundle();
  assert.throws(() => resolveExplicitMergeExportBundle({ audio: bundle.audio, lipsync: bundle.lipsync }), /video reference is required/);
});

test("11E — audio absent", () => {
  const bundle = cloneBundle();
  assert.throws(() => resolveExplicitMergeExportBundle({ video: bundle.video, lipsync: bundle.lipsync }), /audio reference is required/);
});

test("11E — lipsync absent", () => {
  const bundle = cloneBundle();
  assert.throws(() => resolveExplicitMergeExportBundle({ video: bundle.video, audio: bundle.audio }), /lipsync output is required/);
});

test("11E — fake lipsync accepté uniquement en mode fake", () => {
  const bundle = cloneBundle();
  assert.doesNotThrow(() => resolveExplicitMergeExportBundle({ ...bundle, mode: "fake" }));
  assert.throws(() => resolveExplicitMergeExportBundle({ ...bundle, mode: "real" }), /fake lipsync is accepted only in fake mode/);
});

test("11E — output lipsync réel requis pour un futur mode réel", () => {
  const real = createOpaqueMergeExportFixtureBundle("real");
  assert.equal(real.lipsync.kind, "real");
  assert.doesNotThrow(() => resolveExplicitMergeExportBundle(real, createOpaqueMergeExportFixtureFacts(real)));
  assert.throws(() => refusePhase11ERealMergeExport({}), /refused|OFF/);
});

test("11E — workspace/projet incohérents et mélange naïf refusé", () => {
  const bundle = cloneBundle();
  const otherProject = createExistingTimedMediaAssetReference({
    ...bundle.audio,
    projectId: "99999999-9999-4999-8999-999999999999",
    expectedStoragePath: `${bundle.audio.workspaceId}/99999999-9999-4999-8999-999999999999/audio/fixture.mp3`,
  });
  assert.throws(
    () => resolveExplicitMergeExportBundle({ video: bundle.video, audio: otherProject, lipsync: bundle.lipsync }),
    /same workspace\/project/,
  );
  assert.throws(() => selectLastActiveArtifact(), /last-active/);
});

test("11E — lifecycle incompatible, format incompatible, 11A et plan I2V refusés", () => {
  const bundle = cloneBundle();
  const facts = createOpaqueMergeExportFixtureFacts(bundle);
  assert.throws(
    () =>
      resolveExplicitMergeExportBundle(bundle, {
        ...facts,
        video: { ...facts.video, lifecycle: "pending_review" },
      }),
    /pending/,
  );
  assert.throws(
    () =>
      resolveExplicitMergeExportBundle({
        ...bundle,
        video: createExistingTimedMediaAssetReference({
          kind: bundle.video.kind,
          workspaceId: bundle.video.workspaceId,
          projectId: bundle.video.projectId,
          assetId: bundle.video.assetId,
          expectedChecksum: bundle.video.expectedChecksum,
          expectedMimeType: bundle.video.expectedMimeType,
          sourceRole: "phase-11a-still",
          expectedStoragePath: bundle.video.expectedStoragePath,
        }),
      }),
    /11A/,
  );
  assert.throws(
    () =>
      resolveExplicitMergeExportBundle({
        ...bundle,
        video: createExistingTimedMediaAssetReference({
          kind: bundle.video.kind,
          workspaceId: bundle.video.workspaceId,
          projectId: bundle.video.projectId,
          assetId: bundle.video.assetId,
          expectedChecksum: bundle.video.expectedChecksum,
          expectedMimeType: bundle.video.expectedMimeType,
          sourceRole: "generation_plan_inactive",
          expectedStoragePath: bundle.video.expectedStoragePath,
        }),
      }),
    /GenerationPlan/,
  );
  assert.throws(
    () =>
      resolveExplicitMergeExportBundle({
        ...bundle,
        video: createExistingTimedMediaAssetReference({
          kind: bundle.video.kind,
          workspaceId: bundle.video.workspaceId,
          projectId: bundle.video.projectId,
          assetId: bundle.video.assetId,
          expectedChecksum: bundle.video.expectedChecksum,
          expectedMimeType: bundle.video.expectedMimeType,
          sourceRole: "voice_pointer",
          expectedStoragePath: bundle.video.expectedStoragePath,
        }),
      }),
    /Voice catalog/,
  );
});

test("11E — référence active refusée explicitement", () => {
  const bundle = cloneBundle();
  const facts = createOpaqueMergeExportFixtureFacts(bundle);
  assert.throws(
    () =>
      resolveExplicitMergeExportBundle(bundle, {
        ...facts,
        audio: { ...facts.audio, active: true },
      }),
    /activat/,
  );
});

test("11E — registry disabled, moteur unavailable, exécution réelle refusée", () => {
  assert.throws(() => assertPhase11ERegistryDisabled(true), /disabled/);
  assert.doesNotThrow(() => assertPhase11ERegistryDisabled(false));
  assert.throws(
    () =>
      assertVhs11EMergeExportAllowlistScope({
        action: PHASE_11E_MERGE_ACTION,
        capabilityProfile: PHASE_11E_MERGE_CAPABILITY,
        engineId: "ffmpeg",
      }),
    /no merge\/export engine/,
  );
  assert.throws(
    () =>
      assertVhs11EMergeExportAllowlistScope({
        action: PHASE_11E_MERGE_ACTION,
        capabilityProfile: PHASE_11E_MERGE_CAPABILITY,
        realMergeRequested: true,
      }),
    /real merge\/export/,
  );
  assert.throws(() => refusePhase11ERealMergeExport({}), /refused|OFF/);
});

test("11E — dry-run WIRED_DISABLED sans blocker, sans persist, merge/export fermé", () => {
  const dry = runPhase11EMergeExportWiringDryRun();
  assert.equal(dry.verdict, PHASE_11E_MERGE_EXPORT_WIRING_VERDICT);
  assert.equal(dry.pathStatus, "WIRED_DISABLED");
  assert.equal(dry.blockerRequired, false);
  assert.equal(dry.persistedToProduction, false);
  assert.equal(dry.mergeExportAuthorized, false);
  assert.equal(dry.engineSelected, false);
  assert.equal(dry.filesCreated, 0);
  assert.equal(dry.signedUrlsCreated, 0);
  assert.equal(readMergeExportAuthorized({ phase11e: { mergeExportAuthorized: dry.mergeExportAuthorized } }), false);
  assert.equal(
    readMergeExportAuthorized({ delivery: { mergeExportAuthorized: true }, phase11e: { mergeExportAuthorized: false } }),
    false,
  );
});

test("11E — plans déterministes, fake merge/export déterministes, manifeste synthétique", () => {
  const bundle = cloneBundle();
  const mergeKeyA = buildPhase11EMergeIdempotencyKey(bundle);
  const mergeKeyB = buildPhase11EMergeIdempotencyKey(bundle);
  assert.equal(mergeKeyA, mergeKeyB);
  const exportKeyA = buildPhase11EExportIdempotencyKey(bundle, mergeKeyA);
  const exportKeyB = buildPhase11EExportIdempotencyKey(bundle, mergeKeyA);
  assert.equal(exportKeyA, exportKeyB);
  const mergePlan = buildPhase11EMergePlan(bundle);
  const fakeMergeA = runPhase11EFakeMergeAdapter(mergePlan);
  const fakeMergeB = runPhase11EFakeMergeAdapter(mergePlan);
  assert.equal(fakeMergeA.checksum, fakeMergeB.checksum);
  assert.equal(fakeMergeA.adapterId, PHASE_11E_FAKE_MERGE_ADAPTER_ID);
  assert.equal(fakeMergeA.synthetic, true);
  assert.equal(fakeMergeA.filesCreated, 0);
  assert.equal(fakeMergeA.bytesProduced, 0);
  assert.equal(fakeMergeA.urlsCreated, 0);
  assert.equal(fakeMergeA.productionProof, false);
  const exportPlan = buildPhase11EExportPlan(bundle, mergePlan.idempotencyKey);
  const fakeExport = runPhase11EFakeExportAdapter(exportPlan, fakeMergeA.checksum);
  assert.equal(fakeExport.adapterId, PHASE_11E_FAKE_EXPORT_ADAPTER_ID);
  assert.equal(fakeExport.manifest.synthetic, true);
  assert.equal(fakeExport.manifest.downloadUrl, null);
  assert.equal(fakeExport.manifest.archiveCreated, false);
  assert.equal(fakeExport.manifest.published, false);
  assert.equal(fakeExport.manifest.active, false);
  assert.equal(fakeExport.manifest.deliveryStatus, "prepared_disabled");
  assert.equal(fakeExport.filesCreated, 0);
  assert.equal(fakeExport.urlsCreated, 0);
  assert.equal(fakeExport.downloadsTriggered, 0);
});

test("11E — replay sans second submit, aucun retry, aucun fallback, export non auto", () => {
  const bundle = cloneBundle();
  const store = createPhase11EMergeExportStore();
  const first = executePhase11EMergeFake(store, bundle);
  const second = executePhase11EMergeFake(store, bundle);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(first.job.submitCount, 1);
  assert.equal(second.job.submitCount, 1);
  assert.equal(first.exportAutoStarted, false);
  assert.equal(store.export.size, 0);
  assert.equal(first.job.retryCount, 0);
  assert.equal(first.job.fallbackCount, 0);
  assert.equal(first.job.engineCalls, 0);
  assert.equal(first.job.mergeExportAuthorized, false);
  const exportFirst = executePhase11EExportFake(store, bundle);
  const exportSecond = executePhase11EExportFake(store, bundle);
  assert.equal(exportFirst.replayed, false);
  assert.equal(exportSecond.replayed, true);
  assert.equal(exportFirst.job.submitCount, 1);
  assert.equal(exportSecond.job.submitCount, 1);
  assert.equal(exportFirst.fake.published, false);
});

test("11E — export fake refuse sans merge préalable", () => {
  const bundle = cloneBundle();
  assert.throws(() => executePhase11EExportFake(createPhase11EMergeExportStore(), bundle), /not automatic/);
});

test("11E — merge_ready et completed insuffisants, authorized reste false", () => {
  assert.doesNotThrow(() =>
    assertCompletedDoesNotAuthorizeMergeExport({
      completed: true,
      approved: true,
      mergeReady: true,
      fakeLipsyncSucceeded: true,
      mergeExportAuthorized: false,
    }),
  );
  assert.throws(
    () =>
      assertCompletedDoesNotAuthorizeMergeExport({
        completed: true,
        mergeExportAuthorized: true,
      }),
    /never authorize/,
  );
  assert.throws(() => assertPhase11EMergeExportAuthorizedFalse(true), /must remain false/);
});

test("11E — aucun retry, aucun fallback, états terminaux immuables", () => {
  const job = createPhase11EJobState("merge", "k");
  const submitted = beginPhase11EFakeSubmit(job);
  assert.throws(() => beginPhase11EFakeSubmit(submitted), /second merge submit/);
  const completed = completePhase11EFake(submitted, "c".repeat(64));
  const replaySubmit = beginPhase11EFakeSubmit(completed);
  assert.equal(replaySubmit.submitCount, 1);
  assert.equal(replaySubmit.runStatus, "completed");
  assert.throws(() => failPhase11EJob(completed, { code: "x", message: "x" }), /terminal/);
  assert.throws(() => cancelPhase11EJob(completed), /terminal/);
  assert.throws(
    () =>
      assertVhs11EMergeExportAllowlistScope({
        action: PHASE_11E_MERGE_ACTION,
        capabilityProfile: PHASE_11E_MERGE_CAPABILITY,
        retryRequested: true,
      }),
    /retry/,
  );
  assert.throws(
    () =>
      assertVhs11EMergeExportAllowlistScope({
        action: PHASE_11E_EXPORT_ACTION,
        capabilityProfile: PHASE_11E_EXPORT_CAPABILITY,
        fallbackRequested: true,
      }),
    /fallback|forbidden/,
  );
});

test("11E — annulation et erreur structurée", () => {
  const store = createPhase11EMergeExportStore();
  const bundle = cloneBundle();
  const plan = buildPhase11EMergePlan(bundle);
  markPhase11EDryRunInStore(store, "merge", plan.idempotencyKey);
  const cancelled = cancelPhase11EInStore(store, "merge", plan.idempotencyKey);
  assert.equal(cancelled.runStatus, "cancelled");
  assert.equal(cancelled.error?.code, "cancelled");
  const failed = failPhase11EStructured(createPhase11EMergeExportStore(), "export", "fail-key", "structured");
  assert.equal(failed.runStatus, "failed");
  assert.equal(failed.error?.code, "export_failed");
  assert.equal(failed.error?.message, "structured");
});

test("11E — QC préparé, Human Review future, publication fermée", () => {
  const bundle = cloneBundle();
  const fake = runPhase11EFakeMergeAdapter(buildPhase11EMergePlan(bundle));
  const qc = evaluatePhase11EMergeExportTechnicalQuality(fake);
  assert.equal(qc.prepared, true);
  assert.equal(qc.autoApproved, false);
  assert.equal(qc.humanReviewRequired, true);
  assert.equal(qc.filesProduced, false);
  assertPhase11EMergeExportNoAutoApprove(qc);
  const review = createPhase11EMergeExportReviewHandoff();
  assert.equal(review.mergeExportAuthorized, false);
  assert.equal(review.publicationAllowed, false);
  assert.equal(review.downloadAllowed, false);
  assert.equal(review.activationAllowed, false);
  assert.equal(review.persistedToProduction, false);
});

test("11E — legacy endpoint interdit, erreurs redactées, pas d’URL signée", () => {
  assert.throws(() => assertPhase11ENotLegacyMergeEndpoint(PHASE_11E_LEGACY_MERGE_ROUTE), /legacy/);
  const redacted = redactPhase11EError("fail https://example.invalid/x?token=abc sk-SHORT data:video/mp4;base64,AAAA");
  assert.doesNotMatch(redacted, /https?:\/\//);
  assert.doesNotMatch(redacted, /sk-SHORT/);
  assert.doesNotMatch(redacted, /base64,AAAA/);
});

test("11E — source : AICCOS intact, pas de moteur UI, pas d’IDs Production, pas de média", () => {
  const files = [
    "src/application/production/phase-11e-merge-export-allowlist.ts",
    "src/application/production/phase-11e-merge-export-bundle.ts",
    "src/application/production/phase-11e-merge-export-plan.ts",
    "src/application/production/phase-11e-merge-export-run-state.ts",
    "src/application/production/phase-11e-merge-export-fake-adapter.ts",
    "src/application/production/phase-11e-merge-export-qc.ts",
    "src/application/production/phase-11e-merge-export-orchestration.ts",
    "src/app/director/_components/merge-export-section.tsx",
    "src/app/director/_components/merge-export-section-view.ts",
    "src/app/director/_components/director-project-client.tsx",
  ];
  const blob = files.map(read).join("\n");
  assert.doesNotMatch(blob, /createSignedUrl|getSignedUrl|signed_url/);
  assert.doesNotMatch(blob, /49284892|bc36bba7|6be95728|398d8c4a|068a2b25/);
  assert.doesNotMatch(blob, /from ["']@fal-ai|from ["']openai|from ["']elevenlabs/);
  assert.doesNotMatch(blob, /DIRECTOR_V2_ENABLED\s*=/);
  assert.doesNotMatch(blob, /spawn\(|execFile|child_process|ffmpeg\.exe/);
  assert.match(read("src/app/director/_components/merge-export-section.tsx"), /useUpdateBlocker/);
  assert.match(read("src/app/director/_components/merge-export-section.tsx"), /disabled/);
  assert.doesNotMatch(read("src/app/director/_components/merge-export-section.tsx"), /<select/);
  assert.match(read("src/app/director/_components/director-project-client.tsx"), /MergeExportSection/);
  assert.doesNotMatch(read("src/components/send-to-aiccos.tsx"), /phase-11e|directorMergeExport/);
  assert.doesNotMatch(read("src/app/api/aiccos/send/route.ts"), /phase-11e|directorMergeExport/);
});

/**
 * Phase 11D — Director lipsync path. Fakes only. 0 provider. 0 Production media.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createExistingTimedMediaAssetReference } from "@/domain/generation/existing-timed-media-asset-reference";
import { readMergeExportAuthorized } from "../artifact-bundle-coherence";
import {
  PHASE_11D_ACTION,
  PHASE_11D_CAPABILITY,
  PHASE_11D_LEGACY_LIPSYNC_ROUTE,
  PHASE_11D_LIVE_BUDGET,
  PHASE_11D_LIPSYNC_CAPABILITY_FLAG_ENV,
  PHASE_11D_LIPSYNC_WIRING_AUTH,
  PHASE_11D_LIPSYNC_WIRING_VERDICT,
  PHASE_11D_MODEL,
  PHASE_11D_NEXT_AUTH,
  PHASE_11D_PROVIDER,
  assertPhase11DLipsyncFlagsRemainOff,
  assertPhase11DNotLegacyLipsyncEndpoint,
  assertPhase11DRegistryDisabled,
  assertVhs11DLipsyncAllowlistScope,
  phase11DLipsyncFlagsAuditView,
  redactPhase11DError,
} from "../phase-11d-lipsync-allowlist";
import { PHASE_11D_FAKE_ADAPTER_ID, runPhase11DFakeLipsyncAdapter } from "../phase-11d-lipsync-fake-adapter";
import {
  cancelPhase11DLipsyncInStore,
  createPhase11DLipsyncStore,
  executePhase11DLipsyncFake,
  failPhase11DLipsyncStructured,
  markPhase11DDryRunInStore,
  phase11DAllowlistSnapshot,
  refusePhase11DRealLipsync,
  runPhase11DLipsyncWiringDryRun,
} from "../phase-11d-lipsync-orchestration";
import { buildPhase11DLipsyncIdempotencyKey, buildPhase11DLipsyncPlan } from "../phase-11d-lipsync-plan";
import {
  assertPhase11DLipsyncNoAutoApprove,
  createPhase11DLipsyncReviewHandoff,
  evaluatePhase11DLipsyncTechnicalQuality,
} from "../phase-11d-lipsync-qc";
import {
  createOpaqueLipsyncFixtureFacts,
  createOpaqueLipsyncFixturePair,
  resolveExplicitLipsyncPair,
} from "../phase-11d-lipsync-references";
import {
  beginPhase11DLipsyncFakeSubmit,
  cancelPhase11DLipsync,
  completePhase11DLipsyncFake,
  createPhase11DLipsyncJobState,
  failPhase11DLipsync,
} from "../phase-11d-lipsync-run-state";

const root = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function clonePair() {
  return createOpaqueLipsyncFixturePair();
}

test("11D — auth, capability réutilisée, flags OFF, budget inchangé, provider absent", () => {
  assert.equal(
    PHASE_11D_LIPSYNC_WIRING_AUTH,
    "AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_IMPLEMENT_DISABLED_NO_PROVIDER_NO_DEPLOY_NO_FLAG_WRITE",
  );
  assert.equal(PHASE_11D_LIPSYNC_WIRING_VERDICT, "VHS_DIRECTOR_LIPSYNC_PATH_WIRED_DISABLED_READY");
  assert.equal(
    PHASE_11D_NEXT_AUTH,
    "AUTH_VHS_DIRECTOR_LIPSYNC_PATH_WIRING_SYNC_AND_DEPLOY_ONCE_NO_PROVIDER_NO_FLAG_WRITE",
  );
  assert.equal(PHASE_11D_CAPABILITY, "audio.lipsync");
  assert.equal(PHASE_11D_ACTION, "lipsync");
  assert.equal(PHASE_11D_PROVIDER, "unavailable");
  assert.equal(PHASE_11D_MODEL, "unavailable");
  assertPhase11DLipsyncFlagsRemainOff({});
  const flags = phase11DLipsyncFlagsAuditView({});
  assert.equal(flags.capability, false);
  assert.equal(flags.paid, false);
  assert.equal(flags.provider, false);
  assert.equal(flags.worker, false);
  assert.equal(flags.exception, false);
  assert.equal(flags.downstream, false);
  assert.equal(flags.mergeExport, false);
  assert.equal(flags.providerSelected, false);
  assert.equal(PHASE_11D_LIVE_BUDGET.hard, 437);
  assert.equal(PHASE_11D_LIVE_BUDGET.committed, 391);
  assert.equal(PHASE_11D_LIVE_BUDGET.reserved, 0);
  assert.equal(PHASE_11D_LIVE_BUDGET.available, 46);
  const snapshot = phase11DAllowlistSnapshot();
  assert.equal(snapshot.providerSelected, false);
  assert.equal(snapshot.realAdapterPresent, false);
  assert.equal(snapshot.mergeAllowed, false);
  assert.throws(
    () => assertPhase11DLipsyncFlagsRemainOff({ [PHASE_11D_LIPSYNC_CAPABILITY_FLAG_ENV]: "1" }),
    /OFF/,
  );
});

test("11D — contrat vidéo + audio valide et sélection explicite d’assets approuvés inactifs", () => {
  const pair = clonePair();
  const facts = createOpaqueLipsyncFixtureFacts(pair);
  const resolved = resolveExplicitLipsyncPair(pair, facts);
  assert.equal(resolved.video.kind, "video");
  assert.equal(resolved.audio.kind, "audio");
  assert.equal(resolved.video.expectedLifecycle, "approved");
  assert.equal(resolved.audio.expectedLifecycle, "approved");
  assert.equal(facts.video.active, false);
  assert.equal(facts.audio.active, false);
  assert.equal(facts.video.bucketPrivate, true);
  assert.equal(facts.audio.bucketPrivate, true);
});

test("11D — vidéo absente", () => {
  const pair = clonePair();
  assert.throws(() => resolveExplicitLipsyncPair({ audio: pair.audio }), /video reference is required/);
});

test("11D — audio absent", () => {
  const pair = clonePair();
  assert.throws(() => resolveExplicitLipsyncPair({ video: pair.video }), /audio reference is required/);
});

test("11D — type média invalide", () => {
  const pair = clonePair();
  assert.throws(
    () =>
      createExistingTimedMediaAssetReference({
        ...pair.video,
        expectedMimeType: "image/png",
      }),
    /MIME|still-image|video\/mp4/,
  );
});

test("11D — lifecycle incompatible et asset rejeté refusé", () => {
  const pair = clonePair();
  const facts = createOpaqueLipsyncFixtureFacts(pair);
  assert.throws(
    () =>
      resolveExplicitLipsyncPair(pair, {
        ...facts,
        video: { ...facts.video, lifecycle: "pending_review" },
      }),
    /pending/,
  );
  assert.throws(
    () =>
      resolveExplicitLipsyncPair(pair, {
        ...facts,
        audio: { ...facts.audio, lifecycle: "rejected", humanReviewDecision: "rejected" },
      }),
    /rejected/,
  );
});

test("11D — références incohérentes et mélange 11A interdit", () => {
  const pair = clonePair();
  const otherProject = createExistingTimedMediaAssetReference({
    ...pair.audio,
    projectId: "77777777-7777-4777-8777-777777777777",
    expectedStoragePath: `${pair.audio.workspaceId}/77777777-7777-4777-8777-777777777777/audio/fixture.mp3`,
  });
  assert.throws(() => resolveExplicitLipsyncPair({ video: pair.video, audio: otherProject }), /same workspace\/project/);
  assert.throws(
    () =>
      resolveExplicitLipsyncPair({
        video: createExistingTimedMediaAssetReference({
          kind: pair.video.kind,
          workspaceId: pair.video.workspaceId,
          projectId: pair.video.projectId,
          assetId: pair.video.assetId,
          expectedChecksum: pair.video.expectedChecksum,
          expectedMimeType: pair.video.expectedMimeType,
          sourceRole: "phase-11a-still",
          expectedStoragePath: pair.video.expectedStoragePath,
        }),
        audio: pair.audio,
      }),
    /11A/,
  );
});

test("11D — registry disabled, provider unavailable, flags OFF, exécution réelle refusée", () => {
  assert.throws(() => assertPhase11DRegistryDisabled(true), /disabled/);
  assert.doesNotThrow(() => assertPhase11DRegistryDisabled(false));
  assert.throws(
    () =>
      assertVhs11DLipsyncAllowlistScope({
        action: PHASE_11D_ACTION,
        capabilityProfile: PHASE_11D_CAPABILITY,
        providerId: "fal",
      }),
    /no lipsync provider/,
  );
  assert.throws(() => refusePhase11DRealLipsync({}), /refused|OFF/);
  assert.throws(
    () =>
      assertVhs11DLipsyncAllowlistScope({
        action: PHASE_11D_ACTION,
        capabilityProfile: PHASE_11D_CAPABILITY,
        realSubmitRequested: true,
      }),
    /real provider submit/,
  );
});

test("11D — dry-run WIRED_DISABLED sans blocker, sans persist, merge/export fermé", () => {
  const dry = runPhase11DLipsyncWiringDryRun();
  assert.equal(dry.verdict, PHASE_11D_LIPSYNC_WIRING_VERDICT);
  assert.equal(dry.pathStatus, "WIRED_DISABLED");
  assert.equal(dry.blockerRequired, false);
  assert.equal(dry.persistedToProduction, false);
  assert.equal(dry.mergeExportAuthorized, false);
  assert.equal(dry.providerSelected, false);
  assert.equal(dry.realAdapterPresent, false);
  assert.equal(dry.mediaReads, 0);
  assert.equal(dry.signedUrlsCreated, 0);
  assert.equal(readMergeExportAuthorized({ phase11d: { mergeExportAuthorized: dry.mergeExportAuthorized } }), false);
});

test("11D — fake déterministe, idempotency key stable, replay sans second submit", () => {
  const pair = clonePair();
  const keyA = buildPhase11DLipsyncIdempotencyKey(pair);
  const keyB = buildPhase11DLipsyncIdempotencyKey(pair);
  assert.equal(keyA, keyB);
  const store = createPhase11DLipsyncStore();
  const first = executePhase11DLipsyncFake(store, pair);
  const second = executePhase11DLipsyncFake(store, pair);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(first.job.submitCount, 1);
  assert.equal(second.job.submitCount, 1);
  assert.equal(first.fake.checksum, second.fake.checksum);
  assert.equal(first.fake.adapterId, PHASE_11D_FAKE_ADAPTER_ID);
  assert.equal(first.fake.realProvider, false);
  assert.equal(first.job.retryCount, 0);
  assert.equal(first.job.fallbackCount, 0);
  assert.equal(first.job.providerCalls, 0);
  assert.equal(first.job.mergeExportAuthorized, false);
  assert.equal(first.job.mergeExportCalls, 0);
  assert.equal(first.job.outputActive, false);
});

test("11D — aucun retry, aucun fallback, états terminaux immuables", () => {
  const job = createPhase11DLipsyncJobState("k");
  const submitted = beginPhase11DLipsyncFakeSubmit(job);
  assert.throws(() => beginPhase11DLipsyncFakeSubmit(submitted), /second lipsync submit/);
  const completed = completePhase11DLipsyncFake(submitted, "c".repeat(64));
  const replaySubmit = beginPhase11DLipsyncFakeSubmit(completed);
  assert.equal(replaySubmit.submitCount, 1);
  assert.equal(replaySubmit.runStatus, "completed");
  assert.throws(() => failPhase11DLipsync(completed, { code: "x", message: "x" }), /terminal/);
  assert.throws(() => cancelPhase11DLipsync(completed), /terminal/);
  assert.throws(
    () =>
      assertVhs11DLipsyncAllowlistScope({
        action: PHASE_11D_ACTION,
        capabilityProfile: PHASE_11D_CAPABILITY,
        retryRequested: true,
      }),
    /retry/,
  );
  assert.throws(
    () =>
      assertVhs11DLipsyncAllowlistScope({
        action: PHASE_11D_ACTION,
        capabilityProfile: PHASE_11D_CAPABILITY,
        fallbackRequested: true,
      }),
    /fallback|forbidden/,
  );
});

test("11D — annulation et erreur structurée", () => {
  const store = createPhase11DLipsyncStore();
  const pair = clonePair();
  const plan = buildPhase11DLipsyncPlan(pair);
  markPhase11DDryRunInStore(store, plan.idempotencyKey);
  const cancelled = cancelPhase11DLipsyncInStore(store, plan.idempotencyKey);
  assert.equal(cancelled.runStatus, "cancelled");
  assert.equal(cancelled.error?.code, "cancelled");
  const failed = failPhase11DLipsyncStructured(createPhase11DLipsyncStore(), "fail-key", "structured");
  assert.equal(failed.runStatus, "failed");
  assert.equal(failed.error?.code, "lipsync_failed");
  assert.equal(failed.error?.message, "structured");
});

test("11D — QC préparé, Human Review future, completed n’ouvre pas merge/export", () => {
  const pair = clonePair();
  const fake = runPhase11DFakeLipsyncAdapter(buildPhase11DLipsyncPlan(pair));
  const qc = evaluatePhase11DLipsyncTechnicalQuality(fake);
  assert.equal(qc.prepared, true);
  assert.equal(qc.autoApproved, false);
  assert.equal(qc.humanReviewRequired, true);
  assertPhase11DLipsyncNoAutoApprove(qc);
  const review = createPhase11DLipsyncReviewHandoff();
  assert.equal(review.lipsyncAuthorized, false);
  assert.equal(review.mergeExportAuthorized, false);
  assert.equal(review.activationAllowed, false);
  assert.equal(review.persistedToProduction, false);
});

test("11D — legacy endpoint interdit, erreurs redactées, pas d’URL signée", () => {
  assert.throws(() => assertPhase11DNotLegacyLipsyncEndpoint(PHASE_11D_LEGACY_LIPSYNC_ROUTE), /legacy/);
  const redacted = redactPhase11DError("fail https://example.invalid/x?token=abc sk-ABCDEFGHIJKLMNOP data:audio/mpeg;base64,AAAA");
  assert.doesNotMatch(redacted, /https?:\/\//);
  assert.doesNotMatch(redacted, /sk-ABCDEF/);
  assert.doesNotMatch(redacted, /base64,AAAA/);
});

test("11D — source : AICCOS intact, pas de provider UI, pas d’IDs Production, pas de média", () => {
  const files = [
    "src/application/production/phase-11d-lipsync-allowlist.ts",
    "src/application/production/phase-11d-lipsync-references.ts",
    "src/application/production/phase-11d-lipsync-plan.ts",
    "src/application/production/phase-11d-lipsync-run-state.ts",
    "src/application/production/phase-11d-lipsync-fake-adapter.ts",
    "src/application/production/phase-11d-lipsync-qc.ts",
    "src/application/production/phase-11d-lipsync-orchestration.ts",
    "src/domain/generation/existing-timed-media-asset-reference.ts",
    "src/app/director/_components/lipsync-section.tsx",
    "src/app/director/_components/lipsync-section-view.ts",
    "src/app/director/_components/director-project-client.tsx",
  ];
  const blob = files.map(read).join("\n");
  assert.doesNotMatch(blob, /createSignedUrl|getSignedUrl|signed_url/);
  assert.doesNotMatch(blob, /49284892|bc36bba7|6be95728|068a2b25/);
  assert.doesNotMatch(blob, /from ["']@fal-ai|from ["']openai|from ["']elevenlabs/);
  assert.doesNotMatch(blob, /DIRECTOR_V2_ENABLED\s*=/);
  assert.match(read("src/app/director/_components/lipsync-section.tsx"), /useUpdateBlocker/);
  assert.match(read("src/app/director/_components/lipsync-section.tsx"), /disabled/);
  assert.doesNotMatch(read("src/app/director/_components/lipsync-section.tsx"), /<select/);
  assert.match(read("src/app/director/_components/director-project-client.tsx"), /LipsyncSection/);
  assert.doesNotMatch(read("src/components/send-to-aiccos.tsx"), /phase-11d|directorLipsync/);
  assert.doesNotMatch(read("src/app/api/aiccos/send/route.ts"), /phase-11d|directorLipsync/);
});

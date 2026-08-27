/**
 * Director merge/export orchestration. Dry-run and fake metadata only.
 * Real path refuse-closed. Export never auto-starts after merge.
 */
import {
  PHASE_11E_EXPORT_CAPABILITY,
  PHASE_11E_MERGE_ACTION,
  PHASE_11E_MERGE_CAPABILITY,
  PHASE_11E_MERGE_EXPORT_WIRING_VERDICT,
  PHASE_11E_ENGINE,
  assertPhase11EMergeExportAuthorizedFalse,
  assertPhase11EMergeExportFlagsRemainOff,
  assertPhase11ENotLegacyMergeEndpoint,
  assertPhase11ERealExecutionGates,
  assertPhase11ERegistryDisabled,
  assertVhs11EMergeExportAllowlistScope,
  phase11EMergeExportFlagsAuditView,
  type Vhs11EMergeExportAllowlistScope,
} from "./phase-11e-merge-export-allowlist";
import {
  createOpaqueMergeExportFixtureBundle,
  createOpaqueMergeExportFixtureFacts,
  resolveExplicitMergeExportBundle,
  type Phase11EMergeExportBundle,
} from "./phase-11e-merge-export-bundle";
import {
  runPhase11EFakeExportAdapter,
  runPhase11EFakeMergeAdapter,
  type Phase11EFakeExportResult,
  type Phase11EFakeMergeResult,
} from "./phase-11e-merge-export-fake-adapter";
import {
  buildPhase11EExportPlan,
  buildPhase11EMergePlan,
  type Phase11EExportPlan,
  type Phase11EMergePlan,
} from "./phase-11e-merge-export-plan";
import {
  assertCompletedDoesNotAuthorizeMergeExport,
  assertPhase11EMergeExportNoAutoApprove,
  assertPhase11EReviewDoesNotOpenMerge,
  createPhase11EMergeExportReviewHandoff,
  evaluatePhase11EMergeExportTechnicalQuality,
  type Phase11EMergeExportQc,
  type Phase11EMergeExportReviewHandoff,
} from "./phase-11e-merge-export-qc";
import {
  assertPhase11EMergeExportRemainsClosed,
  assertPhase11ENoFilesOrUrls,
  assertPhase11ENoRetryOrFallback,
  beginPhase11EFakeSubmit,
  cancelPhase11EJob,
  completePhase11EFake,
  createPhase11EJobState,
  failPhase11EJob,
  markPhase11EDryRun,
  replayPhase11EJob,
  type Phase11EJobState,
} from "./phase-11e-merge-export-run-state";

export type Phase11EMergeExportStore = {
  merge: Map<string, Phase11EJobState>;
  export: Map<string, Phase11EJobState>;
};

export function createPhase11EMergeExportStore(): Phase11EMergeExportStore {
  return { merge: new Map(), export: new Map() };
}

export type Phase11EMergeExportDryRunResult = {
  verdict: typeof PHASE_11E_MERGE_EXPORT_WIRING_VERDICT;
  pathStatus: "WIRED_DISABLED";
  mergePlan: Phase11EMergePlan;
  exportPlan: Phase11EExportPlan;
  bundle: Phase11EMergeExportBundle;
  flags: ReturnType<typeof phase11EMergeExportFlagsAuditView>;
  registryEnabled: false;
  engineSelected: false;
  realMergeAdapterPresent: false;
  realExportAdapterPresent: false;
  blockerRequired: false;
  persistedToProduction: false;
  mergeExportAuthorized: false;
  mediaReads: 0;
  filesCreated: 0;
  signedUrlsCreated: 0;
};

export function runPhase11EMergeExportWiringDryRun(
  bundle: Phase11EMergeExportBundle = createOpaqueMergeExportFixtureBundle("fake"),
  env: Record<string, string | undefined> = {},
): Phase11EMergeExportDryRunResult {
  const facts = createOpaqueMergeExportFixtureFacts(bundle);
  const resolved = resolveExplicitMergeExportBundle(bundle, facts);
  assertVhs11EMergeExportAllowlistScope({
    action: PHASE_11E_MERGE_ACTION,
    capabilityProfile: PHASE_11E_MERGE_CAPABILITY,
    engineId: PHASE_11E_ENGINE,
  });
  assertPhase11ERegistryDisabled(false);
  assertPhase11ENotLegacyMergeEndpoint("/director");
  assertPhase11EMergeExportFlagsRemainOff(env);
  assertPhase11EMergeExportAuthorizedFalse(false);
  const flags = phase11EMergeExportFlagsAuditView(env);
  const mergePlan = buildPhase11EMergePlan(resolved);
  const exportPlan = buildPhase11EExportPlan(resolved, mergePlan.idempotencyKey);
  return {
    verdict: PHASE_11E_MERGE_EXPORT_WIRING_VERDICT,
    pathStatus: "WIRED_DISABLED",
    mergePlan,
    exportPlan,
    bundle: resolved,
    flags,
    registryEnabled: false,
    engineSelected: false,
    realMergeAdapterPresent: false,
    realExportAdapterPresent: false,
    blockerRequired: false,
    persistedToProduction: false,
    mergeExportAuthorized: false,
    mediaReads: 0,
    filesCreated: 0,
    signedUrlsCreated: 0,
  };
}

function finishJob(
  job: Phase11EJobState,
  checksum: string,
  filesCreated: number,
  urlsCreated: number,
): { job: Phase11EJobState; qc: Phase11EMergeExportQc; review: Phase11EMergeExportReviewHandoff } {
  const completed = completePhase11EFake(job, checksum);
  assertPhase11ENoRetryOrFallback(completed);
  assertPhase11ENoFilesOrUrls(completed);
  assertPhase11EMergeExportRemainsClosed(completed);
  const qc = evaluatePhase11EMergeExportTechnicalQuality({
    checksum,
    synthetic: true,
    filesCreated,
    urlsCreated,
  });
  assertPhase11EMergeExportNoAutoApprove(qc);
  const review = createPhase11EMergeExportReviewHandoff();
  assertPhase11EReviewDoesNotOpenMerge(review);
  assertCompletedDoesNotAuthorizeMergeExport({
    completed: true,
    mergeExportAuthorized: completed.mergeExportAuthorized,
  });
  return { job: completed, qc, review };
}

export function executePhase11EMergeFake(
  store: Phase11EMergeExportStore,
  bundle: Phase11EMergeExportBundle,
): {
  job: Phase11EJobState;
  fake: Phase11EFakeMergeResult;
  qc: Phase11EMergeExportQc;
  review: Phase11EMergeExportReviewHandoff;
  replayed: boolean;
  exportAutoStarted: false;
} {
  const plan = buildPhase11EMergePlan(bundle);
  const existing = replayPhase11EJob(store.merge.get(plan.idempotencyKey), plan.idempotencyKey);
  if (existing && existing.submitCount >= 1) {
    assertPhase11ENoRetryOrFallback(existing);
    assertPhase11EMergeExportRemainsClosed(existing);
    const fake = runPhase11EFakeMergeAdapter(plan);
    const qc = evaluatePhase11EMergeExportTechnicalQuality(fake);
    const review = createPhase11EMergeExportReviewHandoff();
    return { job: existing, fake, qc, review, replayed: true, exportAutoStarted: false };
  }
  let job = existing ?? createPhase11EJobState("merge", plan.idempotencyKey);
  job = beginPhase11EFakeSubmit(job);
  const fake = runPhase11EFakeMergeAdapter(plan);
  const finished = finishJob(job, fake.checksum, fake.filesCreated, fake.urlsCreated);
  store.merge.set(plan.idempotencyKey, finished.job);
  return { ...finished, fake, replayed: false, exportAutoStarted: false };
}

export function executePhase11EExportFake(
  store: Phase11EMergeExportStore,
  bundle: Phase11EMergeExportBundle,
): {
  job: Phase11EJobState;
  fake: Phase11EFakeExportResult;
  qc: Phase11EMergeExportQc;
  review: Phase11EMergeExportReviewHandoff;
  replayed: boolean;
} {
  const mergePlan = buildPhase11EMergePlan(bundle);
  const mergeJob = store.merge.get(mergePlan.idempotencyKey);
  if (!mergeJob || mergeJob.runStatus !== "completed" || !mergeJob.fakeChecksum) {
    throw new Error("Phase 11E: export fake requires a completed fake merge. Export is not automatic.");
  }
  const plan = buildPhase11EExportPlan(bundle, mergePlan.idempotencyKey);
  const existing = replayPhase11EJob(store.export.get(plan.idempotencyKey), plan.idempotencyKey);
  if (existing && existing.submitCount >= 1) {
    assertPhase11ENoRetryOrFallback(existing);
    assertPhase11EMergeExportRemainsClosed(existing);
    const fake = runPhase11EFakeExportAdapter(plan, mergeJob.fakeChecksum);
    const qc = evaluatePhase11EMergeExportTechnicalQuality(fake);
    const review = createPhase11EMergeExportReviewHandoff();
    return { job: existing, fake, qc, review, replayed: true };
  }
  let job = existing ?? createPhase11EJobState("export", plan.idempotencyKey);
  job = beginPhase11EFakeSubmit(job);
  const fake = runPhase11EFakeExportAdapter(plan, mergeJob.fakeChecksum);
  const finished = finishJob(job, fake.checksum, fake.filesCreated, fake.urlsCreated);
  store.export.set(plan.idempotencyKey, finished.job);
  return { ...finished, fake, replayed: false };
}

export function refusePhase11ERealMergeExport(env: Record<string, string | undefined> = {}): never {
  assertVhs11EMergeExportAllowlistScope({
    action: PHASE_11E_MERGE_ACTION,
    capabilityProfile: PHASE_11E_MERGE_CAPABILITY,
  });
  return assertPhase11ERealExecutionGates(env);
}

export function cancelPhase11EInStore(
  store: Phase11EMergeExportStore,
  kind: "merge" | "export",
  idempotencyKey: string,
): Phase11EJobState {
  const map = kind === "merge" ? store.merge : store.export;
  const existing = map.get(idempotencyKey);
  if (!existing) {
    throw new Error(`Phase 11E: no ${kind} run to cancel.`);
  }
  const cancelled = cancelPhase11EJob(existing);
  map.set(idempotencyKey, cancelled);
  return cancelled;
}

export function failPhase11EStructured(
  store: Phase11EMergeExportStore,
  kind: "merge" | "export",
  idempotencyKey: string,
  message: string,
): Phase11EJobState {
  const map = kind === "merge" ? store.merge : store.export;
  const existing = map.get(idempotencyKey) ?? createPhase11EJobState(kind, idempotencyKey);
  const failed = failPhase11EJob(existing, { code: `${kind}_failed`, message });
  map.set(idempotencyKey, failed);
  return failed;
}

export function markPhase11EDryRunInStore(
  store: Phase11EMergeExportStore,
  kind: "merge" | "export",
  idempotencyKey: string,
): Phase11EJobState {
  const map = kind === "merge" ? store.merge : store.export;
  const job = markPhase11EDryRun(map.get(idempotencyKey) ?? createPhase11EJobState(kind, idempotencyKey));
  map.set(idempotencyKey, job);
  return job;
}

export function phase11EAllowlistSnapshot(): Vhs11EMergeExportAllowlistScope {
  return {
    mergeCapability: PHASE_11E_MERGE_CAPABILITY,
    exportCapability: PHASE_11E_EXPORT_CAPABILITY,
    engineId: PHASE_11E_ENGINE,
    modelId: "unavailable",
    engineSelected: false,
    realMergeAdapterPresent: false,
    realExportAdapterPresent: false,
    paidExecution: false,
    globallyEligible: false,
    retryAllowed: false,
    fallbackAllowed: false,
    mergeAuthorized: false,
    exportAuthorized: false,
    publicationAllowed: false,
    downloadAllowed: false,
    activationAllowed: false,
    legacyEndpointAllowed: false,
    universalFakeAllowedInProduction: false,
  };
}

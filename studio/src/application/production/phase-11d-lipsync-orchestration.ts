/**
 * Director lipsync orchestration. Dry-run and fake only. Real path refuse-closed.
 */
import {
  PHASE_11D_ACTION,
  PHASE_11D_CAPABILITY,
  PHASE_11D_LIPSYNC_WIRING_VERDICT,
  PHASE_11D_PROVIDER,
  assertPhase11DLipsyncFlagsRemainOff,
  assertPhase11DNotLegacyLipsyncEndpoint,
  assertPhase11DRealExecutionGates,
  assertPhase11DRegistryDisabled,
  assertVhs11DLipsyncAllowlistScope,
  phase11DLipsyncFlagsAuditView,
  type Vhs11DLipsyncAllowlistScope,
} from "./phase-11d-lipsync-allowlist";
import { runPhase11DFakeLipsyncAdapter, type Phase11DFakeLipsyncResult } from "./phase-11d-lipsync-fake-adapter";
import { buildPhase11DLipsyncPlan, type Phase11DLipsyncPlan } from "./phase-11d-lipsync-plan";
import {
  assertPhase11DLipsyncNoAutoApprove,
  assertPhase11DReviewDoesNotOpenMerge,
  createPhase11DLipsyncReviewHandoff,
  evaluatePhase11DLipsyncTechnicalQuality,
  type Phase11DLipsyncQc,
  type Phase11DLipsyncReviewHandoff,
} from "./phase-11d-lipsync-qc";
import {
  createOpaqueLipsyncFixtureFacts,
  createOpaqueLipsyncFixturePair,
  resolveExplicitLipsyncPair,
  type LipsyncAssetPair,
} from "./phase-11d-lipsync-references";
import {
  assertPhase11DMergeExportRemainsClosed,
  assertPhase11DNoRetryOrFallback,
  beginPhase11DLipsyncFakeSubmit,
  cancelPhase11DLipsync,
  completePhase11DLipsyncFake,
  createPhase11DLipsyncJobState,
  failPhase11DLipsync,
  markPhase11DLipsyncDryRun,
  replayPhase11DLipsync,
  type Phase11DLipsyncJobState,
} from "./phase-11d-lipsync-run-state";

export type Phase11DLipsyncStore = Map<string, Phase11DLipsyncJobState>;

export function createPhase11DLipsyncStore(): Phase11DLipsyncStore {
  return new Map();
}

export type Phase11DLipsyncDryRunResult = {
  verdict: typeof PHASE_11D_LIPSYNC_WIRING_VERDICT;
  pathStatus: "WIRED_DISABLED";
  plan: Phase11DLipsyncPlan;
  pair: LipsyncAssetPair;
  flags: ReturnType<typeof phase11DLipsyncFlagsAuditView>;
  registryEnabled: false;
  providerSelected: false;
  realAdapterPresent: false;
  blockerRequired: false;
  persistedToProduction: false;
  mergeExportAuthorized: false;
  mediaReads: 0;
  signedUrlsCreated: 0;
};

export function runPhase11DLipsyncWiringDryRun(
  pair: LipsyncAssetPair = createOpaqueLipsyncFixturePair(),
  env: Record<string, string | undefined> = {},
): Phase11DLipsyncDryRunResult {
  const facts = createOpaqueLipsyncFixtureFacts(pair);
  const resolved = resolveExplicitLipsyncPair(pair, facts);
  assertVhs11DLipsyncAllowlistScope({
    action: PHASE_11D_ACTION,
    capabilityProfile: PHASE_11D_CAPABILITY,
    providerId: PHASE_11D_PROVIDER,
  });
  assertPhase11DRegistryDisabled(false);
  assertPhase11DNotLegacyLipsyncEndpoint("/director");
  assertPhase11DLipsyncFlagsRemainOff(env);
  const flags = phase11DLipsyncFlagsAuditView(env);
  const plan = buildPhase11DLipsyncPlan(resolved);
  return {
    verdict: PHASE_11D_LIPSYNC_WIRING_VERDICT,
    pathStatus: "WIRED_DISABLED",
    plan,
    pair: resolved,
    flags,
    registryEnabled: false,
    providerSelected: false,
    realAdapterPresent: false,
    blockerRequired: false,
    persistedToProduction: false,
    mergeExportAuthorized: false,
    mediaReads: 0,
    signedUrlsCreated: 0,
  };
}

export function executePhase11DLipsyncFake(
  store: Phase11DLipsyncStore,
  pair: LipsyncAssetPair,
): {
  job: Phase11DLipsyncJobState;
  fake: Phase11DFakeLipsyncResult;
  qc: Phase11DLipsyncQc;
  review: Phase11DLipsyncReviewHandoff;
  replayed: boolean;
} {
  const plan = buildPhase11DLipsyncPlan(pair);
  const existing = replayPhase11DLipsync(store.get(plan.idempotencyKey), plan.idempotencyKey);
  if (existing && existing.submitCount >= 1) {
    assertPhase11DNoRetryOrFallback(existing);
    assertPhase11DMergeExportRemainsClosed(existing);
    const fake = runPhase11DFakeLipsyncAdapter(plan);
    const qc = evaluatePhase11DLipsyncTechnicalQuality(fake);
    const review = createPhase11DLipsyncReviewHandoff();
    return { job: existing, fake, qc, review, replayed: true };
  }
  let job = existing ?? createPhase11DLipsyncJobState(plan.idempotencyKey);
  job = beginPhase11DLipsyncFakeSubmit(job);
  const fake = runPhase11DFakeLipsyncAdapter(plan);
  job = completePhase11DLipsyncFake(job, fake.checksum);
  assertPhase11DNoRetryOrFallback(job);
  assertPhase11DMergeExportRemainsClosed(job);
  const qc = evaluatePhase11DLipsyncTechnicalQuality(fake);
  assertPhase11DLipsyncNoAutoApprove(qc);
  const review = createPhase11DLipsyncReviewHandoff();
  assertPhase11DReviewDoesNotOpenMerge(review);
  store.set(plan.idempotencyKey, job);
  return { job, fake, qc, review, replayed: false };
}

export function refusePhase11DRealLipsync(env: Record<string, string | undefined> = {}): never {
  assertVhs11DLipsyncAllowlistScope({
    action: PHASE_11D_ACTION,
    capabilityProfile: PHASE_11D_CAPABILITY,
  });
  return assertPhase11DRealExecutionGates(env);
}

export function cancelPhase11DLipsyncInStore(
  store: Phase11DLipsyncStore,
  idempotencyKey: string,
): Phase11DLipsyncJobState {
  const existing = store.get(idempotencyKey);
  if (!existing) {
    throw new Error("Phase 11D: no lipsync run to cancel.");
  }
  const cancelled = cancelPhase11DLipsync(existing);
  store.set(idempotencyKey, cancelled);
  return cancelled;
}

export function failPhase11DLipsyncStructured(
  store: Phase11DLipsyncStore,
  idempotencyKey: string,
  message: string,
): Phase11DLipsyncJobState {
  const existing = store.get(idempotencyKey) ?? createPhase11DLipsyncJobState(idempotencyKey);
  const failed = failPhase11DLipsync(existing, { code: "lipsync_failed", message });
  store.set(idempotencyKey, failed);
  return failed;
}

export function markPhase11DDryRunInStore(
  store: Phase11DLipsyncStore,
  idempotencyKey: string,
): Phase11DLipsyncJobState {
  const job = markPhase11DLipsyncDryRun(store.get(idempotencyKey) ?? createPhase11DLipsyncJobState(idempotencyKey));
  store.set(idempotencyKey, job);
  return job;
}

export function phase11DAllowlistSnapshot(): Vhs11DLipsyncAllowlistScope {
  return {
    capability: PHASE_11D_CAPABILITY,
    action: PHASE_11D_ACTION,
    providerId: PHASE_11D_PROVIDER,
    modelId: "unavailable",
    providerSelected: false,
    realAdapterPresent: false,
    paidExecution: false,
    globallyEligible: false,
    downstreamChaining: false,
    retryAllowed: false,
    fallbackAllowed: false,
    mergeAllowed: false,
    exportAllowed: false,
    activationAllowed: false,
    legacyEndpointAllowed: false,
    universalFakeAllowedInProduction: false,
  };
}

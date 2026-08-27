/**
 * Non-persistent merge and export plans. No Production write. No engine chosen.
 */
import { createHash } from "node:crypto";
import {
  PHASE_11E_ENGINE,
  PHASE_11E_EXPORT_ACTION,
  PHASE_11E_EXPORT_CAPABILITY,
  PHASE_11E_MERGE_ACTION,
  PHASE_11E_MERGE_CAPABILITY,
  PHASE_11E_MODEL,
  PHASE_11E_WIRE_VERSION,
} from "./phase-11e-merge-export-allowlist";
import {
  assertMergeExportBundleCoherent,
  lipsyncFingerprint,
  type Phase11EMergeExportBundle,
} from "./phase-11e-merge-export-bundle";

export type Phase11EMergePlan = {
  version: typeof PHASE_11E_WIRE_VERSION;
  capability: typeof PHASE_11E_MERGE_CAPABILITY;
  action: typeof PHASE_11E_MERGE_ACTION;
  engineId: typeof PHASE_11E_ENGINE;
  modelId: typeof PHASE_11E_MODEL;
  workspaceId: string;
  projectId: string;
  videoAssetId: string;
  audioAssetId: string;
  videoFingerprint: string;
  audioFingerprint: string;
  lipsyncFingerprint: string;
  expectedDurationMs: number;
  expectedWidth: number;
  expectedHeight: number;
  targetFormat: "video/mp4";
  mergeExportAuthorized: false;
  persistedToProduction: false;
  fingerprint: string;
  idempotencyKey: string;
};

export type Phase11EExportPlan = {
  version: typeof PHASE_11E_WIRE_VERSION;
  capability: typeof PHASE_11E_EXPORT_CAPABILITY;
  action: typeof PHASE_11E_EXPORT_ACTION;
  engineId: typeof PHASE_11E_ENGINE;
  mergeIdempotencyKey: string;
  workspaceId: string;
  projectId: string;
  targetFormat: "video/mp4";
  synthetic: true;
  published: false;
  active: false;
  mergeExportAuthorized: false;
  persistedToProduction: false;
  fingerprint: string;
  idempotencyKey: string;
};

function bundleKeyPayload(bundle: Phase11EMergeExportBundle) {
  return {
    v: PHASE_11E_WIRE_VERSION,
    workspaceId: bundle.workspaceId,
    projectId: bundle.projectId,
    videoAssetId: bundle.video.assetId,
    audioAssetId: bundle.audio.assetId,
    videoFingerprint: bundle.video.provenanceFingerprint,
    audioFingerprint: bundle.audio.provenanceFingerprint,
    lipsyncFingerprint: lipsyncFingerprint(bundle.lipsync),
    expectedDurationMs: bundle.expectedDurationMs,
    expectedWidth: bundle.expectedWidth,
    expectedHeight: bundle.expectedHeight,
    targetFormat: bundle.targetFormat,
  };
}

export function buildPhase11EMergeIdempotencyKey(bundle: Phase11EMergeExportBundle): string {
  assertMergeExportBundleCoherent(bundle);
  return createHash("sha256")
    .update(JSON.stringify({ ...bundleKeyPayload(bundle), action: PHASE_11E_MERGE_ACTION }))
    .digest("hex");
}

export function buildPhase11EMergePlan(bundle: Phase11EMergeExportBundle): Phase11EMergePlan {
  assertMergeExportBundleCoherent(bundle);
  const idempotencyKey = buildPhase11EMergeIdempotencyKey(bundle);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ v: PHASE_11E_WIRE_VERSION, idempotencyKey, engine: PHASE_11E_ENGINE }))
    .digest("hex");
  return {
    version: PHASE_11E_WIRE_VERSION,
    capability: PHASE_11E_MERGE_CAPABILITY,
    action: PHASE_11E_MERGE_ACTION,
    engineId: PHASE_11E_ENGINE,
    modelId: PHASE_11E_MODEL,
    workspaceId: bundle.workspaceId,
    projectId: bundle.projectId,
    videoAssetId: bundle.video.assetId,
    audioAssetId: bundle.audio.assetId,
    videoFingerprint: bundle.video.provenanceFingerprint,
    audioFingerprint: bundle.audio.provenanceFingerprint,
    lipsyncFingerprint: lipsyncFingerprint(bundle.lipsync),
    expectedDurationMs: bundle.expectedDurationMs,
    expectedWidth: bundle.expectedWidth,
    expectedHeight: bundle.expectedHeight,
    targetFormat: "video/mp4",
    mergeExportAuthorized: false,
    persistedToProduction: false,
    fingerprint,
    idempotencyKey,
  };
}

export function buildPhase11EExportIdempotencyKey(
  bundle: Phase11EMergeExportBundle,
  mergeIdempotencyKey: string,
): string {
  assertMergeExportBundleCoherent(bundle);
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...bundleKeyPayload(bundle),
        action: PHASE_11E_EXPORT_ACTION,
        mergeIdempotencyKey,
      }),
    )
    .digest("hex");
}

export function buildPhase11EExportPlan(
  bundle: Phase11EMergeExportBundle,
  mergeIdempotencyKey: string,
): Phase11EExportPlan {
  const idempotencyKey = buildPhase11EExportIdempotencyKey(bundle, mergeIdempotencyKey);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ v: PHASE_11E_WIRE_VERSION, idempotencyKey, engine: PHASE_11E_ENGINE }))
    .digest("hex");
  return {
    version: PHASE_11E_WIRE_VERSION,
    capability: PHASE_11E_EXPORT_CAPABILITY,
    action: PHASE_11E_EXPORT_ACTION,
    engineId: PHASE_11E_ENGINE,
    mergeIdempotencyKey,
    workspaceId: bundle.workspaceId,
    projectId: bundle.projectId,
    targetFormat: "video/mp4",
    synthetic: true,
    published: false,
    active: false,
    mergeExportAuthorized: false,
    persistedToProduction: false,
    fingerprint,
    idempotencyKey,
  };
}

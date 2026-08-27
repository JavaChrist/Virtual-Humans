/**
 * Non-persistent lipsync plan. No Production write. No provider chosen.
 */
import { createHash } from "node:crypto";
import {
  PHASE_11D_ACTION,
  PHASE_11D_CAPABILITY,
  PHASE_11D_MODEL,
  PHASE_11D_PROVIDER,
  PHASE_11D_WIRE_VERSION,
} from "./phase-11d-lipsync-allowlist";
import { assertLipsyncPairCoherent, type LipsyncAssetPair } from "./phase-11d-lipsync-references";

export type Phase11DLipsyncPlan = {
  version: typeof PHASE_11D_WIRE_VERSION;
  capability: typeof PHASE_11D_CAPABILITY;
  action: typeof PHASE_11D_ACTION;
  providerId: typeof PHASE_11D_PROVIDER;
  modelId: typeof PHASE_11D_MODEL;
  workspaceId: string;
  projectId: string;
  videoAssetId: string;
  audioAssetId: string;
  videoFingerprint: string;
  audioFingerprint: string;
  mergeExportAuthorized: false;
  persistedToProduction: false;
  fingerprint: string;
  idempotencyKey: string;
};

export function buildPhase11DLipsyncIdempotencyKey(pair: LipsyncAssetPair): string {
  assertLipsyncPairCoherent(pair);
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11D_WIRE_VERSION,
        capability: PHASE_11D_CAPABILITY,
        action: PHASE_11D_ACTION,
        workspaceId: pair.video.workspaceId,
        projectId: pair.video.projectId,
        videoAssetId: pair.video.assetId,
        audioAssetId: pair.audio.assetId,
        videoFingerprint: pair.video.provenanceFingerprint,
        audioFingerprint: pair.audio.provenanceFingerprint,
      }),
    )
    .digest("hex");
}

export function buildPhase11DLipsyncPlan(pair: LipsyncAssetPair): Phase11DLipsyncPlan {
  assertLipsyncPairCoherent(pair);
  const idempotencyKey = buildPhase11DLipsyncIdempotencyKey(pair);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11D_WIRE_VERSION,
        idempotencyKey,
        provider: PHASE_11D_PROVIDER,
        model: PHASE_11D_MODEL,
      }),
    )
    .digest("hex");
  return {
    version: PHASE_11D_WIRE_VERSION,
    capability: PHASE_11D_CAPABILITY,
    action: PHASE_11D_ACTION,
    providerId: PHASE_11D_PROVIDER,
    modelId: PHASE_11D_MODEL,
    workspaceId: pair.video.workspaceId,
    projectId: pair.video.projectId,
    videoAssetId: pair.video.assetId,
    audioAssetId: pair.audio.assetId,
    videoFingerprint: pair.video.provenanceFingerprint,
    audioFingerprint: pair.audio.provenanceFingerprint,
    mergeExportAuthorized: false,
    persistedToProduction: false,
    fingerprint,
    idempotencyKey,
  };
}

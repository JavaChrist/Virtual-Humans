/**
 * Local deterministic fake merge/export adapters. Metadata only.
 * Not engines. Not Production proof. No files, bytes, URLs, or processes.
 */
import { createHash } from "node:crypto";
import type { Phase11EExportPlan, Phase11EMergePlan } from "./phase-11e-merge-export-plan";

export const PHASE_11E_FAKE_MERGE_ADAPTER_ID = "fake-local-merge" as const;
export const PHASE_11E_FAKE_EXPORT_ADAPTER_ID = "fake-local-export" as const;

export type Phase11EFakeMergeResult = {
  adapterId: typeof PHASE_11E_FAKE_MERGE_ADAPTER_ID;
  synthetic: true;
  realEngine: false;
  engineSelected: false;
  outputId: string;
  outputKind: "merged_video_metadata";
  expectedMimeType: "video/mp4";
  expectedDurationMs: number;
  expectedWidth: number;
  expectedHeight: number;
  checksum: string;
  checksumKind: "fake-synthetic";
  filesCreated: 0;
  bytesProduced: 0;
  urlsCreated: 0;
  persistedToProduction: false;
  productionProof: false;
};

export type Phase11EFakeExportManifest = {
  synthetic: true;
  deliveryStatus: "prepared_disabled";
  published: false;
  active: false;
  downloadUrl: null;
  archiveCreated: false;
  targetFormat: "video/mp4";
  mergeChecksum: string;
  workspaceId: string;
  projectId: string;
};

export type Phase11EFakeExportResult = {
  adapterId: typeof PHASE_11E_FAKE_EXPORT_ADAPTER_ID;
  synthetic: true;
  realEngine: false;
  engineSelected: false;
  checksum: string;
  checksumKind: "fake-synthetic";
  manifest: Phase11EFakeExportManifest;
  filesCreated: 0;
  urlsCreated: 0;
  downloadsTriggered: 0;
  published: false;
  active: false;
  persistedToProduction: false;
  productionProof: false;
};

export function runPhase11EFakeMergeAdapter(plan: Phase11EMergePlan): Phase11EFakeMergeResult {
  const checksum = createHash("sha256")
    .update(`fake-merge:${plan.idempotencyKey}:${plan.videoFingerprint}:${plan.audioFingerprint}:${plan.lipsyncFingerprint}`)
    .digest("hex");
  const outputId = createHash("sha256").update(`fake-merge-id:${plan.idempotencyKey}`).digest("hex").slice(0, 32);
  return {
    adapterId: PHASE_11E_FAKE_MERGE_ADAPTER_ID,
    synthetic: true,
    realEngine: false,
    engineSelected: false,
    outputId,
    outputKind: "merged_video_metadata",
    expectedMimeType: "video/mp4",
    expectedDurationMs: plan.expectedDurationMs,
    expectedWidth: plan.expectedWidth,
    expectedHeight: plan.expectedHeight,
    checksum,
    checksumKind: "fake-synthetic",
    filesCreated: 0,
    bytesProduced: 0,
    urlsCreated: 0,
    persistedToProduction: false,
    productionProof: false,
  };
}

export function runPhase11EFakeExportAdapter(
  plan: Phase11EExportPlan,
  mergeChecksum: string,
): Phase11EFakeExportResult {
  const checksum = createHash("sha256")
    .update(`fake-export:${plan.idempotencyKey}:${mergeChecksum}`)
    .digest("hex");
  return {
    adapterId: PHASE_11E_FAKE_EXPORT_ADAPTER_ID,
    synthetic: true,
    realEngine: false,
    engineSelected: false,
    checksum,
    checksumKind: "fake-synthetic",
    manifest: {
      synthetic: true,
      deliveryStatus: "prepared_disabled",
      published: false,
      active: false,
      downloadUrl: null,
      archiveCreated: false,
      targetFormat: "video/mp4",
      mergeChecksum,
      workspaceId: plan.workspaceId,
      projectId: plan.projectId,
    },
    filesCreated: 0,
    urlsCreated: 0,
    downloadsTriggered: 0,
    published: false,
    active: false,
    persistedToProduction: false,
    productionProof: false,
  };
}

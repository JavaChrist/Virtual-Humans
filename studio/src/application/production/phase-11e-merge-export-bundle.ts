/**
 * Explicit merge/export bundle. Metadata and fakes only. Never last-active.
 */
import {
  assertExistingTimedMediaAssetReferenceMatchesFacts,
  assertTimedMediaMayStayInactive,
  createExistingTimedMediaAssetReference,
  type ExistingTimedMediaAssetFacts,
  type ExistingTimedMediaAssetReference,
} from "@/domain/generation/existing-timed-media-asset-reference";

const IMAGE_OR_11A_ROLES = /phase.?11a|still|composed|overlay|image_source|provider_still/i;
const PLAN_ROLES = /generation_plan|i2v_plan|inactive_plan/i;
const VOICE_POINTER_ROLES = /voice_pointer|narrator_binding|voice_catalog/i;

export const PHASE_11E_FAKE_LIPSYNC_KIND = "fake" as const;
export const PHASE_11E_REAL_LIPSYNC_KIND = "real" as const;

export type Phase11EFakeLipsyncSource = {
  kind: typeof PHASE_11E_FAKE_LIPSYNC_KIND;
  synthetic: true;
  adapterId: "fake-local-lipsync";
  checksum: string;
  mimeType: "video/mp4";
};

export type Phase11ERealLipsyncSource = {
  kind: typeof PHASE_11E_REAL_LIPSYNC_KIND;
  synthetic: false;
  reference: ExistingTimedMediaAssetReference;
};

export type Phase11ELipsyncSource = Phase11EFakeLipsyncSource | Phase11ERealLipsyncSource;

export type Phase11EMergeExportBundle = {
  video: ExistingTimedMediaAssetReference;
  audio: ExistingTimedMediaAssetReference;
  lipsync: Phase11ELipsyncSource;
  workspaceId: string;
  projectId: string;
  expectedDurationMs: number;
  expectedWidth: number;
  expectedHeight: number;
  expectedFrameRate: number;
  targetFormat: "video/mp4";
  mode: "fake" | "real";
};

export type Phase11EMergeExportBundleFacts = {
  video: ExistingTimedMediaAssetFacts;
  audio: ExistingTimedMediaAssetFacts;
  lipsync?: ExistingTimedMediaAssetFacts;
};

export function assertMergeExportVideoPresent(
  video?: ExistingTimedMediaAssetReference | null,
): asserts video is ExistingTimedMediaAssetReference {
  if (!video) throw new Error("Phase 11E: video reference is required.");
}

export function assertMergeExportAudioPresent(
  audio?: ExistingTimedMediaAssetReference | null,
): asserts audio is ExistingTimedMediaAssetReference {
  if (!audio) throw new Error("Phase 11E: audio reference is required.");
}

export function assertMergeExportLipsyncPresent(
  lipsync?: Phase11ELipsyncSource | null,
): asserts lipsync is Phase11ELipsyncSource {
  if (!lipsync) throw new Error("Phase 11E: lipsync output is required.");
}

export function selectLastActiveArtifact(): never {
  throw new Error("Phase 11E: naive last-active artifact selection is forbidden.");
}

export function assertMergeExportBundleCoherent(bundle: Phase11EMergeExportBundle): void {
  assertMergeExportVideoPresent(bundle.video);
  assertMergeExportAudioPresent(bundle.audio);
  assertMergeExportLipsyncPresent(bundle.lipsync);
  if (bundle.video.kind !== "video") {
    throw new Error("Phase 11E: first reference must be video.");
  }
  if (bundle.audio.kind !== "audio") {
    throw new Error("Phase 11E: second reference must be audio.");
  }
  if (bundle.video.workspaceId !== bundle.audio.workspaceId || bundle.video.projectId !== bundle.audio.projectId) {
    throw new Error("Phase 11E: video and audio must belong to the same workspace/project.");
  }
  if (bundle.workspaceId !== bundle.video.workspaceId || bundle.projectId !== bundle.video.projectId) {
    throw new Error("Phase 11E: bundle workspace/project mismatch.");
  }
  if (bundle.video.assetId === bundle.audio.assetId) {
    throw new Error("Phase 11E: video and audio references must be distinct assets.");
  }
  if (IMAGE_OR_11A_ROLES.test(bundle.video.sourceRole) || bundle.video.expectedMimeType.startsWith("image/")) {
    throw new Error("Phase 11E: 11A still/image pointers cannot be used as merge video.");
  }
  if (PLAN_ROLES.test(bundle.video.sourceRole) || PLAN_ROLES.test(bundle.audio.sourceRole)) {
    throw new Error("Phase 11E: inactive GenerationPlan pointers cannot be merge sources.");
  }
  if (VOICE_POINTER_ROLES.test(bundle.video.sourceRole)) {
    throw new Error("Phase 11E: Voice catalog pointers cannot be used as merge video.");
  }
  if (bundle.video.expectedMimeType !== "video/mp4" || bundle.audio.expectedMimeType !== "audio/mpeg") {
    throw new Error("Phase 11E: format incompatible for merge/export.");
  }
  if (bundle.targetFormat !== "video/mp4") {
    throw new Error("Phase 11E: target format must be video/mp4.");
  }
  if (bundle.expectedDurationMs <= 0 || bundle.expectedWidth <= 0 || bundle.expectedHeight <= 0) {
    throw new Error("Phase 11E: temporal/format metadata must be present and positive.");
  }
  if (bundle.lipsync.kind === "fake") {
    if (bundle.mode !== "fake") {
      throw new Error("Phase 11E: fake lipsync is accepted only in fake mode.");
    }
    if (!bundle.lipsync.synthetic || bundle.lipsync.adapterId !== "fake-local-lipsync") {
      throw new Error("Phase 11E: fake lipsync marker is invalid.");
    }
  }
  if (bundle.lipsync.kind === "real") {
    const lipsync = bundle.lipsync.reference;
    if (lipsync.kind !== "video") {
      throw new Error("Phase 11E: real lipsync output must be video.");
    }
    if (lipsync.workspaceId !== bundle.workspaceId || lipsync.projectId !== bundle.projectId) {
      throw new Error("Phase 11E: lipsync output must belong to the same workspace/project.");
    }
    if (lipsync.assetId === bundle.video.assetId || lipsync.assetId === bundle.audio.assetId) {
      throw new Error("Phase 11E: lipsync output must be a distinct asset.");
    }
  }
  if (bundle.mode === "real" && bundle.lipsync.kind !== "real") {
    throw new Error("Phase 11E: real merge/export requires a real lipsync output.");
  }
}

export function resolveExplicitMergeExportBundle(
  input: {
    video?: ExistingTimedMediaAssetReference | null;
    audio?: ExistingTimedMediaAssetReference | null;
    lipsync?: Phase11ELipsyncSource | null;
    expectedDurationMs?: number;
    expectedWidth?: number;
    expectedHeight?: number;
    expectedFrameRate?: number;
    mode?: "fake" | "real";
  },
  facts?: Phase11EMergeExportBundleFacts,
): Phase11EMergeExportBundle {
  assertMergeExportVideoPresent(input.video);
  assertMergeExportAudioPresent(input.audio);
  assertMergeExportLipsyncPresent(input.lipsync);
  const bundle: Phase11EMergeExportBundle = {
    video: input.video,
    audio: input.audio,
    lipsync: input.lipsync,
    workspaceId: input.video.workspaceId,
    projectId: input.video.projectId,
    expectedDurationMs: input.expectedDurationMs ?? 26_000,
    expectedWidth: input.expectedWidth ?? 1080,
    expectedHeight: input.expectedHeight ?? 1920,
    expectedFrameRate: input.expectedFrameRate ?? 30,
    targetFormat: "video/mp4",
    mode: input.mode ?? "fake",
  };
  assertMergeExportBundleCoherent(bundle);
  if (facts) {
    assertExistingTimedMediaAssetReferenceMatchesFacts(bundle.video, facts.video);
    assertExistingTimedMediaAssetReferenceMatchesFacts(bundle.audio, facts.audio);
    assertTimedMediaMayStayInactive(facts.video.active);
    assertTimedMediaMayStayInactive(facts.audio.active);
    if (bundle.lipsync.kind === "real") {
      if (!facts.lipsync) {
        throw new Error("Phase 11E: real lipsync facts are required.");
      }
      assertExistingTimedMediaAssetReferenceMatchesFacts(bundle.lipsync.reference, facts.lipsync);
      assertTimedMediaMayStayInactive(facts.lipsync.active);
    }
  }
  return bundle;
}

export function createOpaqueMergeExportFixtureBundle(
  mode: "fake" | "real" = "fake",
): Phase11EMergeExportBundle {
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";
  const video = createExistingTimedMediaAssetReference({
    kind: "video",
    workspaceId,
    projectId,
    assetId: "33333333-3333-4333-8333-333333333333",
    expectedChecksum: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    expectedMimeType: "video/mp4",
    sourceRole: "i2v_approved_inactive",
    expectedStoragePath: `${workspaceId}/${projectId}/video/fixture.mp4`,
    humanReviewDecisionId: "55555555-5555-4555-8555-555555555555",
  });
  const audio = createExistingTimedMediaAssetReference({
    kind: "audio",
    workspaceId,
    projectId,
    assetId: "44444444-4444-4444-8444-444444444444",
    expectedChecksum: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    expectedMimeType: "audio/mpeg",
    sourceRole: "voice_approved_inactive",
    expectedStoragePath: `${workspaceId}/${projectId}/audio/fixture.mp3`,
    humanReviewDecisionId: "66666666-6666-4666-8666-666666666666",
  });
  const lipsync: Phase11ELipsyncSource =
    mode === "real"
      ? {
          kind: "real",
          synthetic: false,
          reference: createExistingTimedMediaAssetReference({
            kind: "video",
            workspaceId,
            projectId,
            assetId: "77777777-7777-4777-8777-777777777777",
            expectedChecksum: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            expectedMimeType: "video/mp4",
            sourceRole: "lipsync_approved_inactive",
            expectedStoragePath: `${workspaceId}/${projectId}/video/lipsync-fixture.mp4`,
            humanReviewDecisionId: "88888888-8888-4888-8888-888888888888",
          }),
        }
      : {
          kind: "fake",
          synthetic: true,
          adapterId: "fake-local-lipsync",
          checksum: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          mimeType: "video/mp4",
        };
  return {
    video,
    audio,
    lipsync,
    workspaceId,
    projectId,
    expectedDurationMs: 26_000,
    expectedWidth: 1080,
    expectedHeight: 1920,
    expectedFrameRate: 30,
    targetFormat: "video/mp4",
    mode,
  };
}

export function createOpaqueMergeExportFixtureFacts(
  bundle: Phase11EMergeExportBundle,
): Phase11EMergeExportBundleFacts {
  const toFacts = (ref: ExistingTimedMediaAssetReference): ExistingTimedMediaAssetFacts => ({
    workspaceId: ref.workspaceId,
    projectId: ref.projectId,
    assetId: ref.assetId,
    checksum: ref.expectedChecksum,
    mimeType: ref.expectedMimeType,
    lifecycle: "approved",
    sourceKind: "internal",
    storagePath: ref.expectedStoragePath,
    bucketPrivate: true,
    active: false,
    humanReviewDecision: "approved",
  });
  return {
    video: toFacts(bundle.video),
    audio: toFacts(bundle.audio),
    lipsync: bundle.lipsync.kind === "real" ? toFacts(bundle.lipsync.reference) : undefined,
  };
}

export function lipsyncFingerprint(source: Phase11ELipsyncSource): string {
  if (source.kind === "fake") return `fake:${source.adapterId}:${source.checksum}`;
  return source.reference.provenanceFingerprint;
}

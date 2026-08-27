/**
 * Explicit video + audio selection for Director lipsync. Metadata/fakes only.
 */
import {
  assertExistingTimedMediaAssetReferenceMatchesFacts,
  assertTimedMediaMayStayInactive,
  createExistingTimedMediaAssetReference,
  type ExistingTimedMediaAssetFacts,
  type ExistingTimedMediaAssetReference,
} from "@/domain/generation/existing-timed-media-asset-reference";

const IMAGE_OR_11A_ROLES = /phase.?11a|still|composed|overlay|image_source|provider_still/i;

export type LipsyncAssetPair = {
  video: ExistingTimedMediaAssetReference;
  audio: ExistingTimedMediaAssetReference;
};

export type LipsyncAssetPairFacts = {
  video: ExistingTimedMediaAssetFacts;
  audio: ExistingTimedMediaAssetFacts;
};

export function assertLipsyncVideoPresent(video?: ExistingTimedMediaAssetReference | null): asserts video is ExistingTimedMediaAssetReference {
  if (!video) {
    throw new Error("Phase 11D: video reference is required.");
  }
}

export function assertLipsyncAudioPresent(audio?: ExistingTimedMediaAssetReference | null): asserts audio is ExistingTimedMediaAssetReference {
  if (!audio) {
    throw new Error("Phase 11D: audio reference is required.");
  }
}

export function assertLipsyncPairCoherent(pair: LipsyncAssetPair): void {
  assertLipsyncVideoPresent(pair.video);
  assertLipsyncAudioPresent(pair.audio);
  if (pair.video.kind !== "video") {
    throw new Error("Phase 11D: first reference must be video.");
  }
  if (pair.audio.kind !== "audio") {
    throw new Error("Phase 11D: second reference must be audio.");
  }
  if (pair.video.workspaceId !== pair.audio.workspaceId || pair.video.projectId !== pair.audio.projectId) {
    throw new Error("Phase 11D: video and audio must belong to the same workspace/project.");
  }
  if (pair.video.assetId === pair.audio.assetId) {
    throw new Error("Phase 11D: video and audio references must be distinct assets.");
  }
  if (IMAGE_OR_11A_ROLES.test(pair.video.sourceRole) || pair.video.expectedMimeType.startsWith("image/")) {
    throw new Error("Phase 11D: 11A still/image pointers cannot be used as lipsync video.");
  }
  if (IMAGE_OR_11A_ROLES.test(pair.audio.sourceRole)) {
    throw new Error("Phase 11D: 11A still/image pointers cannot be used as lipsync audio.");
  }
}

export function resolveExplicitLipsyncPair(
  pair: { video?: ExistingTimedMediaAssetReference | null; audio?: ExistingTimedMediaAssetReference | null },
  facts?: LipsyncAssetPairFacts,
): LipsyncAssetPair {
  assertLipsyncVideoPresent(pair.video);
  assertLipsyncAudioPresent(pair.audio);
  const resolved = { video: pair.video, audio: pair.audio };
  assertLipsyncPairCoherent(resolved);
  if (facts) {
    assertExistingTimedMediaAssetReferenceMatchesFacts(resolved.video, facts.video);
    assertExistingTimedMediaAssetReferenceMatchesFacts(resolved.audio, facts.audio);
    assertTimedMediaMayStayInactive(facts.video.active);
    assertTimedMediaMayStayInactive(facts.audio.active);
  }
  return resolved;
}

export function createOpaqueLipsyncFixturePair(): LipsyncAssetPair {
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";
  const videoChecksum = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const audioChecksum = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  return {
    video: createExistingTimedMediaAssetReference({
      kind: "video",
      workspaceId,
      projectId,
      assetId: "33333333-3333-4333-8333-333333333333",
      expectedChecksum: videoChecksum,
      expectedMimeType: "video/mp4",
      sourceRole: "i2v_approved_inactive",
      expectedStoragePath: `${workspaceId}/${projectId}/video/fixture.mp4`,
      humanReviewDecisionId: "55555555-5555-4555-8555-555555555555",
    }),
    audio: createExistingTimedMediaAssetReference({
      kind: "audio",
      workspaceId,
      projectId,
      assetId: "44444444-4444-4444-8444-444444444444",
      expectedChecksum: audioChecksum,
      expectedMimeType: "audio/mpeg",
      sourceRole: "voice_approved_inactive",
      expectedStoragePath: `${workspaceId}/${projectId}/audio/fixture.mp3`,
      humanReviewDecisionId: "66666666-6666-4666-8666-666666666666",
    }),
  };
}

export function createOpaqueLipsyncFixtureFacts(pair: LipsyncAssetPair): LipsyncAssetPairFacts {
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
  return { video: toFacts(pair.video), audio: toFacts(pair.audio) };
}

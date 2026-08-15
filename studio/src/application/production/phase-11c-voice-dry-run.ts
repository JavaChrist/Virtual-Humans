/**
 * Phase 11C — local Voice/TTS dry-run. Synthetic buffers only. Never persisted.
 */
import { createHash } from "node:crypto";
import {
  buildPhase11BExplicitI2vBundle,
  livePhase11BPointerFacts,
} from "./phase-11b-artifact-pointer-coherence";
import { evaluateArtifactBundleCoherence } from "./artifact-bundle-coherence";
import {
  PHASE_11C_ACTION,
  PHASE_11C_CAPABILITY,
  PHASE_11C_MODEL,
  PHASE_11C_PROJECT_ID,
  PHASE_11C_PROVIDER,
  PHASE_11C_VOICE_WIRING_VERDICT,
  PHASE_11C_WIRE_VERSION,
  assertPhase11CVoiceFlagsRemainOff,
  estimatePhase11CVoiceCatalogue,
  phase11CVoiceFlagsAuditView,
} from "./phase-11c-voice-allowlist";
import {
  PHASE_11C_CANONICAL_SCENE_PACKAGE_SET_ID,
  PHASE_11C_CANONICAL_STORYBOARD_ID,
  buildSpokenSegmentFromExplicitText,
  resolveCanonicalI2vSpokenSegment,
} from "./phase-11c-spoken-segment";
import { buildPhase11CFixtureVoiceReference } from "./phase-11c-voice-reference";
import {
  buildPhase11CIdempotencyKey,
  buildPhase11CSingleStepGenerationPlan,
} from "./phase-11c-single-step-plan";
import {
  assertPhase11CVoiceNoAutomaticDownstream,
  createPhase11CVoiceJobState,
  ingestPhase11CVoiceFromDurableBuffer,
  persistPhase11CVoiceSubmitIntent,
  recordPhase11CVoiceSyntheticCompletion,
  settlePhase11CVoiceLedgerOnce,
} from "./phase-11c-voice-worker";
import {
  checksumPhase11CVoiceBuffer,
  createPhase11CVoiceOutputProvenance,
  simulatePhase11CVoiceIngest,
} from "./phase-11c-voice-ingest";
import {
  assertPhase11CVoiceNoAutoApprove,
  evaluatePhase11CVoiceTechnicalQuality,
} from "./phase-11c-voice-qc";
import {
  assertPhase11CVoiceApproveDoesNotOpenLipsync,
  assertPhase11CVoiceReviewStaysLocal,
  createPhase11CVoiceReviewHandoff,
} from "./phase-11c-voice-human-review";

export const PHASE_11C_DRY_RUN_FIXTURE_TEXT =
  "Fixture VO scene-2. Hash only. Not Production copy." as const;

export const PHASE_11C_DRY_RUN_OUTPUT_ASSET_ID =
  "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" as const;

export function createPhase11CSyntheticMp3Buffer(): Uint8Array {
  return new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00, 0x0b, 0x11, 0xc0]);
}

export function runPhase11CVoiceWiringDryRun(): {
  verdict: typeof PHASE_11C_VOICE_WIRING_VERDICT;
  spoken: ReturnType<typeof resolveCanonicalI2vSpokenSegment>;
  fixtureSegment: ReturnType<typeof buildSpokenSegmentFromExplicitText>;
  voice: ReturnType<typeof buildPhase11CFixtureVoiceReference>;
  liveVoiceBlocked: true;
  consent: "insufficient";
  planFingerprint: string;
  idempotencyKey: string;
  i2vBundleCoherent: boolean;
  pricingFirm: false;
  budgetDecisionAllowed: false;
  reservationCreated: false;
  providerCalls: 0;
  flags: ReturnType<typeof phase11CVoiceFlagsAuditView>;
  ingest: ReturnType<typeof simulatePhase11CVoiceIngest>;
  qc: ReturnType<typeof evaluatePhase11CVoiceTechnicalQuality>;
  review: ReturnType<typeof createPhase11CVoiceReviewHandoff>;
  outputActive: false;
  lipsyncSteps: 0;
  persistedToProduction: false;
} {
  assertPhase11CVoiceFlagsRemainOff({});
  const spoken = resolveCanonicalI2vSpokenSegment();
  const fixtureSegment = buildSpokenSegmentFromExplicitText({
    workspaceId: spoken.workspaceId,
    projectId: spoken.projectId,
    sceneId: spoken.sceneId,
    scriptArtifactId: spoken.scriptArtifactId,
    scriptRevision: spoken.scriptRevision,
    segmentId: spoken.segmentId,
    spokenKind: "voice_over",
    speakerKind: "narrator",
    narratorId: "narrator:fixture",
    language: spoken.language,
    text: PHASE_11C_DRY_RUN_FIXTURE_TEXT,
    estimatedDurationSeconds: 4,
    provenance: "phase-11c-synthetic-dry-run",
  });
  const voice = buildPhase11CFixtureVoiceReference();
  const planBuild = buildPhase11CSingleStepGenerationPlan({
    spokenSegment: fixtureSegment,
    voice,
    createdAt: "2026-08-15T10:00:00.000Z",
    createdBy: "00000000-0000-4000-8000-000000000001",
    correlationId: "11c-voice-wiring-preflight",
    storyboardRevisionId: PHASE_11C_CANONICAL_STORYBOARD_ID,
    scenePackageRevisionIds: [PHASE_11C_CANONICAL_SCENE_PACKAGE_SET_ID],
  });
  const i2vBundle = buildPhase11BExplicitI2vBundle(livePhase11BPointerFacts());
  const i2vCoherence = evaluateArtifactBundleCoherence(i2vBundle);
  const pricing = estimatePhase11CVoiceCatalogue(fixtureSegment.characterCount);
  const bytes = createPhase11CSyntheticMp3Buffer();
  let job = createPhase11CVoiceJobState();
  job = persistPhase11CVoiceSubmitIntent(job);
  job = recordPhase11CVoiceSyntheticCompletion(job, {
    mimeType: "audio/mpeg",
    byteLength: bytes.byteLength,
    checksum: checksumPhase11CVoiceBuffer(bytes),
    persisted: true,
  });
  job = ingestPhase11CVoiceFromDurableBuffer(job);
  job = settlePhase11CVoiceLedgerOnce({ ...job, status: "completed" });
  assertPhase11CVoiceNoAutomaticDownstream(job);
  const ingest = simulatePhase11CVoiceIngest({
    outputAssetId: PHASE_11C_DRY_RUN_OUTPUT_ASSET_ID,
    bytes,
    mimeType: "audio/mpeg",
  });
  const provenance = createPhase11CVoiceOutputProvenance({
    scriptArtifactId: fixtureSegment.scriptArtifactId,
    scriptRevision: fixtureSegment.scriptRevision,
    segmentId: fixtureSegment.segmentId,
    textSha256: fixtureSegment.textSha256,
    voiceFingerprint: voice.provenanceFingerprint,
    outputAssetId: PHASE_11C_DRY_RUN_OUTPUT_ASSET_ID,
    i2vVideoAssetId: planBuild.i2vContext.videoAssetId,
  });
  const qc = evaluatePhase11CVoiceTechnicalQuality({
    mime: ingest.mimeType,
    bytes: ingest.byteLength,
    checksum: ingest.checksum,
    expectedChecksum: ingest.checksum,
    probeAvailable: false,
    provenanceOk: Boolean(provenance.mediaRole),
    estimateOk: pricing.firm === false,
  });
  assertPhase11CVoiceNoAutoApprove(qc);
  const review = createPhase11CVoiceReviewHandoff({
    outputAssetId: PHASE_11C_DRY_RUN_OUTPUT_ASSET_ID,
    qualityReportId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
    reviewRequestId: "cccccccc-dddd-4eee-8fff-000000000000",
    expectedRevision: 1,
  });
  assertPhase11CVoiceReviewStaysLocal(review.persistedToProduction);
  assertPhase11CVoiceApproveDoesNotOpenLipsync(review.lipsyncAuthorized);

  return {
    verdict: PHASE_11C_VOICE_WIRING_VERDICT,
    spoken,
    fixtureSegment,
    voice,
    liveVoiceBlocked: true,
    consent: "insufficient",
    planFingerprint: planBuild.fingerprint,
    idempotencyKey: buildPhase11CIdempotencyKey({ spokenSegment: fixtureSegment, voice }),
    i2vBundleCoherent: i2vCoherence.coherent,
    pricingFirm: false,
    budgetDecisionAllowed: false,
    reservationCreated: false,
    providerCalls: 0,
    flags: phase11CVoiceFlagsAuditView({}),
    ingest,
    qc,
    review,
    outputActive: false,
    lipsyncSteps: 0,
    persistedToProduction: false,
  };
}

export function fingerprintPhase11CVoiceDryRun(
  result: ReturnType<typeof runPhase11CVoiceWiringDryRun>,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        v: PHASE_11C_WIRE_VERSION,
        capability: PHASE_11C_CAPABILITY,
        action: PHASE_11C_ACTION,
        provider: PHASE_11C_PROVIDER,
        model: PHASE_11C_MODEL,
        projectId: PHASE_11C_PROJECT_ID,
        spokenHash: result.spoken.textSha256,
        fixtureHash: result.fixtureSegment.textSha256,
        planFingerprint: result.planFingerprint,
        idempotencyKey: result.idempotencyKey,
        ingestChecksum: result.ingest.checksum,
        verdict: result.verdict,
      }),
    )
    .digest("hex");
}

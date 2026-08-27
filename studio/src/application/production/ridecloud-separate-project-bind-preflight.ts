/**
 * RideCloud storyboard/pack bind preflight — local / read-only.
 * Designs two inactive textual artifacts. Does not persist, read media, or call RPC.
 */
import { createHash } from "node:crypto";
import { PHASE_11A_SMOKE_PROJECT_ID } from "./phase-11a-openai-image-allowlist";
import { MV001_MOTION_PROJECT_ID } from "./phase-11a-motion-isolation";
import { PHASE_11B_POINTER_STRATEGY } from "./phase-11b-artifact-pointer-coherence";
import {
  RIDECLOUD_BANNER_REF,
  RIDECLOUD_BANNER_VARIANT_REF,
  RIDECLOUD_CAPTURE_REFS,
  RIDECLOUD_CAPTURE_VARIANT_REFS,
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_LEGAL,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_LOGO_REF,
  RIDECLOUD_PROJECT_KEY,
  RIDECLOUD_REJECTED_UNSAFE_SOURCES,
  RIDECLOUD_VARIANT_PREFERENCE,
  assertNotRideCloudDeliverable,
  assertRideCloudLocatorIsRedactedSafe,
  assertRideCloudNoSideEffects,
  buildRideCloudCurrentManifest,
  rideCloudOfficialRefs,
  type RideCloudOpaqueRef,
} from "./ridecloud-input-preflight";
import {
  RIDECLOUD_ALLOWED_NARRATION,
  RIDECLOUD_FIRST_AD_SHOTS,
  RIDECLOUD_LOCKED_CTA_INVITE,
  RIDECLOUD_LOCKED_CTA_PREMIUM,
  RIDECLOUD_LOCKED_FOLLOW_NARRATION,
  RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION,
  RIDECLOUD_STORYBOARD_DURATION_SEC,
  buildRideCloudFirstAdStoryboard,
} from "./ridecloud-first-ad-storyboard-preflight";
import {
  RIDECLOUD_FINGERPRINT_PREFIX as RIDECLOUD_BRIEF_FINGERPRINT_PREFIX,
  RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH,
} from "./ridecloud-separate-project-create-apply";
import {
  RIDECLOUD_CANONICAL_WORKSPACE_ID,
  RIDECLOUD_DOCUMENTED_BUDGET,
  RIDECLOUD_ID_NAMESPACE,
  RIDECLOUD_PROJECT_DISPLAY_NAME,
  RIDECLOUD_VOICE_MAY_SUBMIT,
  RIDECLOUD_VOICE_SUBMIT_COUNT,
  assertRideCloudCreateBudget,
  assertRideCloudCreateIsolation,
  assertRideCloudCreateRuntime,
  redactRideCloudId,
  rideCloudCreateCommandFingerprint,
  rideCloudDeterministicBriefId,
  rideCloudDeterministicProjectId,
  rideCloudUuidV5,
} from "./ridecloud-separate-project-create-preflight";

export const RIDECLOUD_BIND_PREFLIGHT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_BIND_PREFLIGHT_VERDICT =
  "RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_READY" as const;

export const RIDECLOUD_BIND_NEXT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_BIND_KIND_SCHEMA_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_STORYBOARD_CONTRACT_KIND = "storyboard_contract" as const;
export const RIDECLOUD_MEDIA_MANIFEST_KIND = "media_input_manifest" as const;

export const RIDECLOUD_BIND_FUTURE_WRITES = 2 as const;
export const RIDECLOUD_BIND_FUTURE_ACTIVE_POINTERS = 0 as const;
export const RIDECLOUD_BIND_FUTURE_RPC_CALLS = 1 as const;
export const RIDECLOUD_BIND_LIFECYCLE = "inactive" as const;

export const CURRENT_PROJECT_ARTIFACT_KINDS = [
  "video_project_brief",
  "marketing_plan",
  "creative_concept",
  "video_script",
  "visual_direction",
  "storyboard_project",
  "scene_package",
  "scene_package_set",
  "generation_plan",
  "production_result",
  "quality_report",
  "merge_plan",
  "export_package",
] as const;

const LOCAL_PATH =
  /(?:[A-Za-z]:\\|studio\/\.tmp|ridecloud-pack|\/Users\/|\\\\)/i;
const SIGNED_OR_BLOB =
  /X-Amz-Signature=|data:(?:image|audio|video)\/|[?&]token=|eyJ[A-Za-z0-9_-]{20,}\.|sk-[A-Za-z0-9]{12,}/i;

export type RideCloudBindDecision = "CREATE" | "EXISTING" | "REFUSE";

export type RideCloudBindObservedArtifact = {
  id: string;
  projectId: string;
  kind: string;
  revision: number;
  fingerprint?: string;
  parentId?: string | null;
};

export type RideCloudBindLiveFacts = {
  projectId: string;
  workspaceId: string;
  name: string;
  status: string;
  briefId: string;
  briefRevision: number;
  mediaReferenceCount: number;
  storyboardProjectCount: number;
  generationPlanCount: number;
  bindArtifactCount: number;
  rideCloudRunCount: number;
  rideCloudJobCount: number;
  technicalProjectIntact: boolean;
  motionProjectIntact: boolean;
  budgetHard: number;
  budgetCommitted: number;
  budgetReserved: number;
  budgetAvailable: number;
  activeReservations: number;
  voiceRuntime: "OFF" | "ON";
  paidMediaRuntime: "OFF" | "ON";
  voiceSubmitCount: number;
  maySubmit: boolean;
  flagsOff: boolean;
  observedContract: RideCloudBindObservedArtifact | null;
  observedManifest: RideCloudBindObservedArtifact | null;
};

export function assertRideCloudBindAuthChain(): void {
  if (RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH !== RIDECLOUD_BIND_PREFLIGHT_AUTH) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_AUTH_CHAIN");
  }
}

export function rideCloudDeterministicStoryboardContractId(projectId: string): string {
  return rideCloudUuidV5(
    RIDECLOUD_ID_NAMESPACE,
    `vhs.artifact.${RIDECLOUD_STORYBOARD_CONTRACT_KIND}.${projectId}.rev1`,
  );
}

export function rideCloudDeterministicMediaManifestId(projectId: string): string {
  return rideCloudUuidV5(
    RIDECLOUD_ID_NAMESPACE,
    `vhs.artifact.${RIDECLOUD_MEDIA_MANIFEST_KIND}.${projectId}.rev1`,
  );
}

export function plannedRideCloudNarrations(): readonly string[] {
  return [
    RIDECLOUD_LOCKED_CLAIM,
    RIDECLOUD_LOCKED_SIGNATURE,
    RIDECLOUD_LOCKED_FOLLOW_NARRATION,
    RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION,
    RIDECLOUD_LOCKED_CTA_INVITE,
    RIDECLOUD_LOCKED_CTA_PREMIUM,
  ];
}

export function plannedRideCloudLockedPackRefs(): readonly RideCloudOpaqueRef[] {
  return [RIDECLOUD_LOGO_REF, RIDECLOUD_BANNER_REF, ...RIDECLOUD_CAPTURE_REFS];
}

export function plannedRideCloudHdVariantRefs(): readonly RideCloudOpaqueRef[] {
  return [...RIDECLOUD_CAPTURE_VARIANT_REFS, RIDECLOUD_BANNER_VARIANT_REF];
}

export function plannedRideCloudStoryboardContract(input: {
  projectId: string;
  briefId: string;
  contractId: string;
}) {
  const storyboard = buildRideCloudFirstAdStoryboard();
  return {
    kind: RIDECLOUD_STORYBOARD_CONTRACT_KIND,
    id: input.contractId,
    projectId: input.projectId,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    parentKind: "video_project_brief",
    parentId: input.briefId,
    parentRevision: 1,
    revision: 1,
    lifecycle: RIDECLOUD_BIND_LIFECYCLE,
    activePointer: false,
    durationSec: RIDECLOUD_STORYBOARD_DURATION_SEC,
    masterAspectRatio: "9:16" as const,
    derivedAspectRatios: ["4:5", "1:1"] as const,
    language: "fr" as const,
    voiceRole: "narrator_female" as const,
    lipsync: false,
    music: false,
    narrations: plannedRideCloudNarrations(),
    shots: RIDECLOUD_FIRST_AD_SHOTS.map((shot) => ({
      id: shot.id,
      startSec: shot.startSec,
      endSec: shot.endSec,
      visualRef: shot.visualRef,
      visualRole: shot.visualRole,
      motion: shot.motion,
      transitionOut: shot.transitionOut,
      onScreenText: shot.onScreenText,
      narration: shot.narration,
      cropRules: shot.cropRules,
    })),
    unusedOfficialRefs: storyboard.unusedOfficialRefs,
    legalConstraints: RIDECLOUD_LOCKED_LEGAL,
    concept: storyboard.concept,
  };
}

export function plannedRideCloudMediaManifest(input: {
  projectId: string;
  contractId: string;
  manifestId: string;
}) {
  const pack = buildRideCloudCurrentManifest();
  return {
    kind: RIDECLOUD_MEDIA_MANIFEST_KIND,
    id: input.manifestId,
    projectId: input.projectId,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    parentKind: RIDECLOUD_STORYBOARD_CONTRACT_KIND,
    parentId: input.contractId,
    parentRevision: 1,
    revision: 1,
    lifecycle: RIDECLOUD_BIND_LIFECYCLE,
    activePointer: false,
    lockedPackRefs: plannedRideCloudLockedPackRefs(),
    hdVariantRefs: plannedRideCloudHdVariantRefs(),
    hdPreference: RIDECLOUD_VARIANT_PREFERENCE,
    autoSubstitution: false,
    bannerIsNotClaim: true,
    technicalProofsRejected: RIDECLOUD_REJECTED_UNSAFE_SOURCES,
    brandAssetReferences: pack.brandAssetReferences,
    captureReferences: pack.captureReferences,
    captureVariantReferences: pack.captureVariantReferences,
  };
}

export function rideCloudBindCommandFingerprint(input: {
  projectId: string;
  briefId: string;
  contractId: string;
  manifestId: string;
}): string {
  const payload = {
    auth: RIDECLOUD_BIND_PREFLIGHT_AUTH,
    projectKey: RIDECLOUD_PROJECT_KEY,
    name: RIDECLOUD_PROJECT_DISPLAY_NAME,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    projectId: input.projectId,
    briefId: input.briefId,
    briefFingerprint: rideCloudCreateCommandFingerprint({
      projectId: input.projectId,
      briefId: input.briefId,
    }),
    pointerStrategy: PHASE_11B_POINTER_STRATEGY,
    kinds: [RIDECLOUD_STORYBOARD_CONTRACT_KIND, RIDECLOUD_MEDIA_MANIFEST_KIND],
    contract: plannedRideCloudStoryboardContract(input),
    manifest: plannedRideCloudMediaManifest(input),
    futureWrites: RIDECLOUD_BIND_FUTURE_WRITES,
    futureActivePointers: RIDECLOUD_BIND_FUTURE_ACTIVE_POINTERS,
    mutateBrief: false,
    storyboardProject: false,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function assertRideCloudBindLocatorSafe(value: string): void {
  assertRideCloudLocatorIsRedactedSafe(value);
  if (LOCAL_PATH.test(value) || SIGNED_OR_BLOB.test(value)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_UNSAFE_LOCATOR");
  }
}

function hasAmbiguousParent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasAmbiguousParent);
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (/parent/i.test(key) && typeof child === "string" && /^(current|latest)$/i.test(child)) {
      return true;
    }
    if (hasAmbiguousParent(child)) return true;
  }
  return false;
}

export function assertRideCloudBindPayloadIsTextual(value: unknown): void {
  assertRideCloudBindLocatorSafe(JSON.stringify(value));
  if (hasAmbiguousParent(value)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_AMBIGUOUS_PARENT");
  }
}

export function assertRideCloudBindKindsAreCustom(): void {
  if ((CURRENT_PROJECT_ARTIFACT_KINDS as readonly string[]).includes(RIDECLOUD_STORYBOARD_CONTRACT_KIND)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_COLLIDES_DIRECTOR");
  }
  if ((CURRENT_PROJECT_ARTIFACT_KINDS as readonly string[]).includes(RIDECLOUD_MEDIA_MANIFEST_KIND)) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_KIND_COLLIDES_DIRECTOR");
  }
}

export function assertCurrentSchemaForbidsBindKinds(): void {
  assertRideCloudBindKindsAreCustom();
}

export function resolveRideCloudBindIdentity() {
  assertRideCloudBindAuthChain();
  const projectId = rideCloudDeterministicProjectId();
  const briefId = rideCloudDeterministicBriefId(projectId);
  const contractId = rideCloudDeterministicStoryboardContractId(projectId);
  const manifestId = rideCloudDeterministicMediaManifestId(projectId);
  assertRideCloudCreateIsolation(projectId);
  assertRideCloudCreateIsolation(contractId);
  assertRideCloudCreateIsolation(manifestId);
  const fingerprint = rideCloudBindCommandFingerprint({
    projectId,
    briefId,
    contractId,
    manifestId,
  });
  return {
    projectKey: RIDECLOUD_PROJECT_KEY,
    name: RIDECLOUD_PROJECT_DISPLAY_NAME,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    projectId,
    briefId,
    contractId,
    manifestId,
    fingerprint,
    briefFingerprint: rideCloudCreateCommandFingerprint({ projectId, briefId }),
  };
}

export function decideRideCloudBindApply(facts: RideCloudBindLiveFacts): {
  decision: RideCloudBindDecision;
  refuseCode?: string;
  futureWrites: 0 | 2;
} {
  const identity = resolveRideCloudBindIdentity();
  if (facts.projectId !== identity.projectId || facts.workspaceId !== identity.workspaceId) {
    return { decision: "REFUSE", refuseCode: "WRONG_PROJECT", futureWrites: 0 };
  }
  if (facts.name !== identity.name || facts.status !== "draft") {
    return { decision: "REFUSE", refuseCode: "PROJECT_DIVERGED", futureWrites: 0 };
  }
  if (facts.briefId !== identity.briefId || facts.briefRevision !== 1) {
    return { decision: "REFUSE", refuseCode: "BRIEF_DIVERGED", futureWrites: 0 };
  }
  if (facts.mediaReferenceCount !== 0) {
    return { decision: "REFUSE", refuseCode: "BRIEF_MEDIA_REFS", futureWrites: 0 };
  }
  if (facts.storyboardProjectCount !== 0) {
    return { decision: "REFUSE", refuseCode: "STORYBOARD_PROJECT_PRESENT", futureWrites: 0 };
  }
  if (facts.generationPlanCount !== 0) {
    return { decision: "REFUSE", refuseCode: "GENERATION_PLAN_PRESENT", futureWrites: 0 };
  }
  if (!facts.technicalProjectIntact || !facts.motionProjectIntact) {
    return { decision: "REFUSE", refuseCode: "TECHNICAL_PROJECT_DRIFT", futureWrites: 0 };
  }
  if (facts.rideCloudRunCount !== 0 || facts.rideCloudJobCount !== 0) {
    return { decision: "REFUSE", refuseCode: "RIDECLOUD_RUNTIME_PRESENT", futureWrites: 0 };
  }
  try {
    assertRideCloudCreateRuntime({
      voiceRuntime: facts.voiceRuntime,
      paidMediaRuntime: facts.paidMediaRuntime,
      voiceSubmitCount: facts.voiceSubmitCount,
      maySubmit: facts.maySubmit,
      flagsOff: facts.flagsOff,
    });
    assertRideCloudCreateBudget({
      hard: facts.budgetHard,
      committed: facts.budgetCommitted,
      reserved: facts.budgetReserved,
      available: facts.budgetAvailable,
    });
  } catch {
    return { decision: "REFUSE", refuseCode: "PRECONDITION", futureWrites: 0 };
  }
  if (facts.activeReservations !== 0) {
    return { decision: "REFUSE", refuseCode: "ACTIVE_RESERVATION", futureWrites: 0 };
  }
  if (facts.voiceSubmitCount !== RIDECLOUD_VOICE_SUBMIT_COUNT || facts.maySubmit !== RIDECLOUD_VOICE_MAY_SUBMIT) {
    return { decision: "REFUSE", refuseCode: "VOICE_SUBMIT_GATE", futureWrites: 0 };
  }
  const contract = facts.observedContract;
  const manifest = facts.observedManifest;
  if (!contract && !manifest) {
    if (facts.bindArtifactCount !== 0) {
      return { decision: "REFUSE", refuseCode: "UNEXPECTED_BIND_ARTIFACT", futureWrites: 0 };
    }
    return { decision: "CREATE", futureWrites: RIDECLOUD_BIND_FUTURE_WRITES };
  }
  if (!contract || !manifest) {
    return { decision: "REFUSE", refuseCode: "PARTIAL_STATE", futureWrites: 0 };
  }
  if (
    contract.id !== identity.contractId ||
    contract.projectId !== identity.projectId ||
    contract.kind !== RIDECLOUD_STORYBOARD_CONTRACT_KIND ||
    contract.revision !== 1 ||
    contract.parentId !== identity.briefId
  ) {
    return { decision: "REFUSE", refuseCode: "CONTRACT_DIVERGED", futureWrites: 0 };
  }
  if (
    manifest.id !== identity.manifestId ||
    manifest.projectId !== identity.projectId ||
    manifest.kind !== RIDECLOUD_MEDIA_MANIFEST_KIND ||
    manifest.revision !== 1 ||
    manifest.parentId !== identity.contractId
  ) {
    return { decision: "REFUSE", refuseCode: "MANIFEST_DIVERGED", futureWrites: 0 };
  }
  if (contract.fingerprint && contract.fingerprint !== identity.fingerprint) {
    return { decision: "REFUSE", refuseCode: "FINGERPRINT_DIVERGED", futureWrites: 0 };
  }
  return { decision: "EXISTING", futureWrites: 0 };
}

export function evaluateRideCloudBindReplay(facts: RideCloudBindLiveFacts): {
  decision: "EXISTING";
  mayBind: false;
  futureWrites: 0;
} {
  const decided = decideRideCloudBindApply(facts);
  if (decided.decision !== "EXISTING") {
    throw new Error("BLOCKED_RIDECLOUD_BIND_REPLAY_NOT_EXISTING");
  }
  return { decision: "EXISTING", mayBind: false, futureWrites: 0 };
}

export function assertRideCloudBindRejectsAutoSubstitution(input: {
  preferHd: boolean;
  replaceLocked720: boolean;
}): void {
  if (!input.preferHd || input.replaceLocked720) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_AUTO_SUBSTITUTION");
  }
}

export function assertRideCloudBindRejectsTechnicalDeliverable(ref: string): void {
  assertNotRideCloudDeliverable(ref);
}

export function buildRideCloudSeparateProjectBindPreflight() {
  assertRideCloudBindAuthChain();
  assertCurrentSchemaForbidsBindKinds();
  assertRideCloudNoSideEffects({
    providerCalls: 0,
    elevenLabsCalls: 0,
    falCalls: 0,
    signedUrlCount: 0,
    mediaReads: 0,
    mediaWrites: 0,
    storageUploads: 0,
    productionWrites: 0,
    supabaseMutations: 0,
    flagWrites: 0,
    deploymentsTriggered: 0,
    productionProjectsCreated: 0,
    humanReviewWrites: 0,
  });
  const identity = resolveRideCloudBindIdentity();
  const contract = plannedRideCloudStoryboardContract(identity);
  const manifest = plannedRideCloudMediaManifest(identity);
  assertRideCloudBindPayloadIsTextual(contract);
  assertRideCloudBindPayloadIsTextual(manifest);
  if (contract.narrations.length !== 6) throw new Error("BLOCKED_RIDECLOUD_BIND_NARRATION_COUNT");
  for (const narration of contract.narrations) {
    if (!(RIDECLOUD_ALLOWED_NARRATION as readonly string[]).includes(narration)) {
      throw new Error("BLOCKED_RIDECLOUD_BIND_NARRATION");
    }
  }
  if (manifest.lockedPackRefs.length !== 12) throw new Error("BLOCKED_RIDECLOUD_BIND_PACK_COUNT");
  if (manifest.hdVariantRefs.length !== 5) throw new Error("BLOCKED_RIDECLOUD_BIND_HD_COUNT");
  assertRideCloudBindRejectsAutoSubstitution({ preferHd: true, replaceLocked720: false });
  for (const ref of rideCloudOfficialRefs()) assertRideCloudBindLocatorSafe(ref);
  if (identity.briefFingerprint.slice(0, 16) !== RIDECLOUD_BRIEF_FINGERPRINT_PREFIX) {
    throw new Error("BLOCKED_RIDECLOUD_BIND_BRIEF_FINGERPRINT");
  }
  const report = {
    auth: RIDECLOUD_BIND_PREFLIGHT_AUTH,
    verdict: RIDECLOUD_BIND_PREFLIGHT_VERDICT,
    nextAuth: RIDECLOUD_BIND_NEXT_AUTH,
    identity: {
      projectKey: identity.projectKey,
      name: identity.name,
      workspaceIdPrefix: redactRideCloudId(identity.workspaceId),
      projectIdPrefix: redactRideCloudId(identity.projectId),
      briefIdPrefix: redactRideCloudId(identity.briefId),
      contractIdPrefix: redactRideCloudId(identity.contractId),
      manifestIdPrefix: redactRideCloudId(identity.manifestId),
      fingerprintPrefix: identity.fingerprint.slice(0, 16),
      briefFingerprintPrefix: identity.briefFingerprint.slice(0, 16),
    },
    support: {
      kinds: [RIDECLOUD_STORYBOARD_CONTRACT_KIND, RIDECLOUD_MEDIA_MANIFEST_KIND],
      revisions: [1, 1],
      lifecycle: RIDECLOUD_BIND_LIFECYCLE,
      activePointers: RIDECLOUD_BIND_FUTURE_ACTIVE_POINTERS,
      mutateBrief: false,
      storyboardProject: false,
      generationPlan: false,
      pointerStrategy: PHASE_11B_POINTER_STRATEGY,
      currentSchemaAllowsKinds: false,
      futureWrites: RIDECLOUD_BIND_FUTURE_WRITES,
      futureRpcCalls: RIDECLOUD_BIND_FUTURE_RPC_CALLS,
      transaction: "single_future_rpc_after_kind_schema",
    },
    runtime: {
      voiceRuntime: "OFF",
      paidMediaRuntime: "OFF",
      maySubmit: RIDECLOUD_VOICE_MAY_SUBMIT,
      submitCount: RIDECLOUD_VOICE_SUBMIT_COUNT,
    },
    budget: RIDECLOUD_DOCUMENTED_BUDGET,
    isolation: {
      technicalProjectIdPrefix: redactRideCloudId(PHASE_11A_SMOKE_PROJECT_ID),
      motionProjectIdPrefix: redactRideCloudId(MV001_MOTION_PROJECT_ID),
    },
    counters: {
      providerCalls: 0,
      ttsCalls: 0,
      signedUrlCount: 0,
      mediaReads: 0,
      mediaWrites: 0,
      storageUploads: 0,
      supabaseMutations: 0,
      productionWrites: 0,
      artifactsCreated: 0,
      projectsCreated: 0,
      briefsCreated: 0,
      budgetWrites: 0,
      flagsWritten: 0,
      phaseCostCents: 0,
    },
  };
  assertRideCloudBindPayloadIsTextual(report);
  return report;
}

export { RIDECLOUD_DOCUMENTED_BUDGET, redactRideCloudId };

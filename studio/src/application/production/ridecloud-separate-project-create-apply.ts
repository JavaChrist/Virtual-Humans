/**
 * RideCloud separate project create — one idempotent Production RPC.
 * No provider, media, storyboard_project, run, budget, or flag write.
 */
import { BRIEF_SCHEMA_VERSION, finalizeBrief } from "@/domain/brief";
import { MV001_MOTION_PROJECT_ID } from "./phase-11a-motion-isolation";
import { PHASE_11A_SMOKE_PROJECT_ID } from "./phase-11a-openai-image-allowlist";
import { assertPhase11CVoiceFlagsRemainOff } from "./phase-11c-voice-allowlist";
import {
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_CTA,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_PROJECT_KEY,
  assertRideCloudLocatorIsRedactedSafe,
} from "./ridecloud-input-preflight";
import {
  RIDECLOUD_CANONICAL_WORKSPACE_ID,
  RIDECLOUD_DOCUMENTED_BUDGET,
  RIDECLOUD_FORBIDDEN_PROJECT_IDS,
  RIDECLOUD_FUTURE_PROJECT_STATUS,
  RIDECLOUD_FUTURE_RPC,
  RIDECLOUD_PROJECT_CREATE_NEXT_AUTH,
  RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH,
  RIDECLOUD_PROJECT_DISPLAY_NAME,
  RIDECLOUD_VOICE_MAY_SUBMIT,
  RIDECLOUD_VOICE_SUBMIT_COUNT,
  assertRideCloudCreateBudget,
  assertRideCloudCreateIsolation,
  assertRideCloudCreatePlanIsRedactedSafe,
  assertRideCloudCreateRuntime,
  plannedRideCloudBriefFields,
  redactRideCloudId,
  rideCloudCreateCommandFingerprint,
  rideCloudDeterministicBriefId,
  rideCloudDeterministicProjectId,
} from "./ridecloud-separate-project-create-preflight";

export const RIDECLOUD_PROJECT_CREATE_APPLY_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER" as const;

export const RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_CREATED =
  "RIDECLOUD_SEPARATE_PROJECT_CREATED" as const;
export const RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_EXISTING =
  "RIDECLOUD_SEPARATE_PROJECT_EXISTING" as const;

export const RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_STORYBOARD_PACK_BIND_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_EXPECTED_MIGRATION_COUNT = 32 as const;
export const RIDECLOUD_SUPABASE_PROJECT_REF = "ejdbksxaswhdtsudnmvi" as const;
export const RIDECLOUD_SUPABASE_HOST_SUFFIX = "ejdbksxaswhdtsudnmvi.supabase.co" as const;
export const RIDECLOUD_CREATE_ACTOR_ID = "christian" as const;
export const RIDECLOUD_FINGERPRINT_PREFIX = "b266a03b66436acd" as const;
export const RIDECLOUD_PROJECT_ID_PREFIX = "ba4a6021" as const;
export const RIDECLOUD_BRIEF_ID_PREFIX = "adea092a" as const;

export type RideCloudCreateApplyDecision = "CREATE" | "EXISTING" | "REFUSE";

export type RideCloudObservedProjectRow = {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  correlationId: string;
};

export type RideCloudObservedBriefRow = {
  id: string;
  projectId: string;
  revision: number;
  artifactType: string;
};

export type RideCloudCreateLiveFacts = {
  supabaseProjectRef: string;
  supabaseHostAllowlisted: boolean;
  workspaceFound: boolean;
  migrationCount: number;
  budgetHard: number;
  budgetCommitted: number;
  budgetReserved: number;
  budgetAvailable: number;
  activeReservations: number;
  voiceSubmitCount: number;
  maySubmit: boolean;
  flagsOff: boolean;
  voiceRuntime: "OFF" | "ON";
  paidMediaRuntime: "OFF" | "ON";
  projectById: RideCloudObservedProjectRow | null;
  projectsByExactName: readonly RideCloudObservedProjectRow[];
  briefRev1: RideCloudObservedBriefRow | null;
  storyboardArtifactCount: number;
  technicalProjectIntact: boolean;
  motionProjectIntact: boolean;
};

export type RideCloudCreateIdentity = {
  projectKey: typeof RIDECLOUD_PROJECT_KEY;
  name: typeof RIDECLOUD_PROJECT_DISPLAY_NAME;
  workspaceId: typeof RIDECLOUD_CANONICAL_WORKSPACE_ID;
  projectId: string;
  briefId: string;
  fingerprint: string;
  correlationId: typeof RIDECLOUD_PROJECT_KEY;
};

export function resolveRideCloudCreateIdentity(): RideCloudCreateIdentity {
  if (RIDECLOUD_PROJECT_CREATE_NEXT_AUTH !== RIDECLOUD_PROJECT_CREATE_APPLY_AUTH) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_APPLY_AUTH_CHAIN");
  }
  const projectId = rideCloudDeterministicProjectId();
  const briefId = rideCloudDeterministicBriefId(projectId);
  const fingerprint = rideCloudCreateCommandFingerprint({ projectId, briefId });
  assertRideCloudCreateIsolation(projectId);
  assertRideCloudCreateIsolation(briefId);
  if (!projectId.startsWith(RIDECLOUD_PROJECT_ID_PREFIX)) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_PROJECT_ID");
  }
  if (!briefId.startsWith(RIDECLOUD_BRIEF_ID_PREFIX)) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_BRIEF_ID");
  }
  if (!fingerprint.startsWith(RIDECLOUD_FINGERPRINT_PREFIX)) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_FINGERPRINT");
  }
  return {
    projectKey: RIDECLOUD_PROJECT_KEY,
    name: RIDECLOUD_PROJECT_DISPLAY_NAME,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    projectId,
    briefId,
    fingerprint,
    correlationId: RIDECLOUD_PROJECT_KEY,
  };
}

export function assertRideCloudCreateHostAllowlisted(input: {
  projectRef: string;
  host: string;
}): void {
  if (input.projectRef !== RIDECLOUD_SUPABASE_PROJECT_REF) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_WRONG_SUPABASE_PROJECT");
  }
  if (!input.host.endsWith(RIDECLOUD_SUPABASE_HOST_SUFFIX)) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_HOST_NOT_ALLOWLISTED");
  }
}

export function assertRideCloudBriefStaysTextual(brief: Record<string, unknown>): void {
  assertRideCloudLocatorIsRedactedSafe(JSON.stringify(brief));
  if (brief.characterId) throw new Error("BLOCKED_RIDECLOUD_CREATE_CHARACTER_BOUND");
  if (brief.subjectDescription !== RIDECLOUD_LOCKED_CLAIM) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_CLAIM");
  }
  if (brief.callToAction !== RIDECLOUD_LOCKED_CTA) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_CTA");
  }
  const constraints = String(brief.brandConstraints ?? "");
  if (!constraints.includes("delivery_duration_sec=26")) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_DURATION");
  }
  if (!constraints.includes("storyboard_local_contract_only")) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_STORYBOARD_PERSIST");
  }
  if (Array.isArray(brief.mediaReferences) && brief.mediaReferences.length > 0) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_MEDIA_REFS");
  }
}

export function buildRideCloudCreateBriefValue(nowIso: string): Record<string, unknown> {
  const identity = resolveRideCloudCreateIdentity();
  const fields = plannedRideCloudBriefFields();
  const brief = finalizeBrief(
    {
      draftVersion: "1.0.0",
      updatedAt: nowIso,
      currentStep: 5,
      fields: { ...fields, mediaReferences: [] },
    },
    {
      id: identity.briefId,
      projectId: identity.projectId,
      createdBy: RIDECLOUD_CREATE_ACTOR_ID,
      correlationId: identity.correlationId,
      createdAt: nowIso,
      revision: 1,
    },
  );
  const value = { ...brief } as unknown as Record<string, unknown>;
  assertRideCloudBriefStaysTextual(value);
  if (BRIEF_SCHEMA_VERSION !== "1.0.0") throw new Error("BLOCKED_RIDECLOUD_CREATE_BRIEF_SCHEMA");
  return value;
}

export function decideRideCloudCreateApply(facts: RideCloudCreateLiveFacts): {
  decision: RideCloudCreateApplyDecision;
  refuseCode?: string;
  rpcCalls: 0 | 1;
} {
  const identity = resolveRideCloudCreateIdentity();
  if (!facts.supabaseHostAllowlisted || facts.supabaseProjectRef !== RIDECLOUD_SUPABASE_PROJECT_REF) {
    return { decision: "REFUSE", refuseCode: "HOST_NOT_ALLOWLISTED", rpcCalls: 0 };
  }
  if (!facts.workspaceFound) return { decision: "REFUSE", refuseCode: "WORKSPACE_MISSING", rpcCalls: 0 };
  if (facts.migrationCount !== RIDECLOUD_EXPECTED_MIGRATION_COUNT) {
    return { decision: "REFUSE", refuseCode: "MIGRATION_DRIFT", rpcCalls: 0 };
  }
  if (!facts.flagsOff || facts.voiceRuntime !== "OFF" || facts.paidMediaRuntime !== "OFF") {
    return { decision: "REFUSE", refuseCode: "RUNTIME_OR_FLAGS_ON", rpcCalls: 0 };
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
    assertPhase11CVoiceFlagsRemainOff({});
  } catch {
    return { decision: "REFUSE", refuseCode: "PRECONDITION", rpcCalls: 0 };
  }
  if (facts.activeReservations !== 0) {
    return { decision: "REFUSE", refuseCode: "ACTIVE_RESERVATION", rpcCalls: 0 };
  }
  if (facts.voiceSubmitCount !== RIDECLOUD_VOICE_SUBMIT_COUNT || facts.maySubmit !== RIDECLOUD_VOICE_MAY_SUBMIT) {
    return { decision: "REFUSE", refuseCode: "VOICE_SUBMIT_GATE", rpcCalls: 0 };
  }
  if (!facts.technicalProjectIntact || !facts.motionProjectIntact) {
    return { decision: "REFUSE", refuseCode: "TECHNICAL_PROJECT_DRIFT", rpcCalls: 0 };
  }
  if (facts.storyboardArtifactCount !== 0) {
    return { decision: "REFUSE", refuseCode: "STORYBOARD_ALREADY_PRESENT", rpcCalls: 0 };
  }
  for (const row of facts.projectsByExactName) {
    if (row.id !== identity.projectId) {
      return { decision: "REFUSE", refuseCode: "NAME_COLLISION", rpcCalls: 0 };
    }
  }
  if ((RIDECLOUD_FORBIDDEN_PROJECT_IDS as readonly string[]).includes(identity.projectId)) {
    return { decision: "REFUSE", refuseCode: "TECHNICAL_ID", rpcCalls: 0 };
  }
  if (facts.projectById) {
    if (
      facts.projectById.workspaceId !== identity.workspaceId ||
      facts.projectById.name !== identity.name ||
      facts.projectById.status !== RIDECLOUD_FUTURE_PROJECT_STATUS ||
      facts.projectById.correlationId !== identity.correlationId
    ) {
      return { decision: "REFUSE", refuseCode: "PROJECT_DIVERGED", rpcCalls: 0 };
    }
    if (!facts.briefRev1) {
      return { decision: "REFUSE", refuseCode: "PARTIAL_STATE", rpcCalls: 0 };
    }
    if (
      facts.briefRev1.id !== identity.briefId ||
      facts.briefRev1.revision !== 1 ||
      facts.briefRev1.artifactType !== "video_project_brief"
    ) {
      return { decision: "REFUSE", refuseCode: "BRIEF_DIVERGED", rpcCalls: 0 };
    }
    return { decision: "EXISTING", rpcCalls: 0 };
  }
  if (facts.briefRev1) {
    return { decision: "REFUSE", refuseCode: "ORPHAN_BRIEF", rpcCalls: 0 };
  }
  return { decision: "CREATE", rpcCalls: 1 };
}

export function evaluateRideCloudCreateReplay(facts: RideCloudCreateLiveFacts): {
  verdict: typeof RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_EXISTING;
  mayCreate: false;
  rpcCalls: 0;
} {
  const decided = decideRideCloudCreateApply(facts);
  if (decided.decision !== "EXISTING") {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_REPLAY_NOT_EXISTING");
  }
  return {
    verdict: RIDECLOUD_PROJECT_CREATE_APPLY_VERDICT_EXISTING,
    mayCreate: false,
    rpcCalls: 0,
  };
}

export function rideCloudCreateRpcName(): typeof RIDECLOUD_FUTURE_RPC {
  return RIDECLOUD_FUTURE_RPC;
}

export function redactRideCloudCreateReport(identity: RideCloudCreateIdentity) {
  const report = {
    auth: RIDECLOUD_PROJECT_CREATE_APPLY_AUTH,
    nextAuth: RIDECLOUD_PROJECT_CREATE_APPLY_NEXT_AUTH,
    projectKey: identity.projectKey,
    name: identity.name,
    workspaceIdPrefix: redactRideCloudId(identity.workspaceId),
    projectIdPrefix: redactRideCloudId(identity.projectId),
    briefIdPrefix: redactRideCloudId(identity.briefId),
    fingerprintPrefix: identity.fingerprint.slice(0, 16),
    claim: RIDECLOUD_LOCKED_CLAIM,
    signatureAuthority: RIDECLOUD_LOCKED_SIGNATURE,
    rpc: RIDECLOUD_FUTURE_RPC,
    status: RIDECLOUD_FUTURE_PROJECT_STATUS,
  };
  assertRideCloudCreatePlanIsRedactedSafe(report);
  return report;
}

export function assertRideCloudCreateApplyConsumedPreflight(): void {
  if (RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH !== "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER") {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_PREFLIGHT_AUTH");
  }
}

export { PHASE_11A_SMOKE_PROJECT_ID, MV001_MOTION_PROJECT_ID };

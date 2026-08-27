/**
 * RideCloud separate Production project create preflight.
 * Local / fake / read-only. No Supabase write, provider, media, or flag mutation.
 */
import { createHash } from "node:crypto";
import { MV001_MOTION_PROJECT_ID } from "./phase-11a-motion-isolation";
import { PHASE_11A_SMOKE_PROJECT_ID } from "./phase-11a-openai-image-allowlist";
import { PHASE_11B_WORKSPACE_ID } from "./phase-11b-i2v-allowlist";
import { PHASE_11B_POINTER_STRATEGY } from "./phase-11b-artifact-pointer-coherence";
import {
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_CTA,
  RIDECLOUD_LOCKED_LEGAL,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_PRODUCT_NAME,
  RIDECLOUD_PROJECT_KEY,
  RIDECLOUD_REJECTED_UNSAFE_SOURCES,
  assertNotRideCloudDeliverable,
  assertRideCloudLocatorIsRedactedSafe,
  assertRideCloudNoSideEffects,
  buildRideCloudCurrentManifest,
} from "./ridecloud-input-preflight";
import {
  RIDECLOUD_FIRST_AD_SHOTS,
  RIDECLOUD_STORYBOARD_DURATION_SEC,
  RIDECLOUD_STORYBOARD_NEXT_AUTH,
  RIDECLOUD_STORYBOARD_VERDICT,
  buildRideCloudFirstAdStoryboard,
} from "./ridecloud-first-ad-storyboard-preflight";

export const RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_PROJECT_CREATE_PREFLIGHT_VERDICT =
  "RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_READY" as const;

export const RIDECLOUD_PROJECT_CREATE_NEXT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_IDEMPOTENT_NO_PROVIDER" as const;

export const RIDECLOUD_PROJECT_DISPLAY_NAME = "RideCloud — First Founder Ad" as const;
export const RIDECLOUD_PROJECT_OWNER = "Christian" as const;
export const RIDECLOUD_PROJECT_CAMPAIGN = "Programme Fondateur" as const;
export const RIDECLOUD_CANONICAL_WORKSPACE_ID = PHASE_11B_WORKSPACE_ID;
export const RIDECLOUD_ID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8" as const;
export const RIDECLOUD_FUTURE_RPC = "create_director_project_with_brief" as const;
export const RIDECLOUD_FUTURE_PROJECT_STATUS = "draft" as const;
export const RIDECLOUD_POINTER_STRATEGY = PHASE_11B_POINTER_STRATEGY;
export const RIDECLOUD_VOICE_SUBMIT_COUNT = 1 as const;
export const RIDECLOUD_VOICE_MAY_SUBMIT = false as const;

export const RIDECLOUD_DOCUMENTED_BUDGET = {
  hard: 437,
  committed: 391,
  reserved: 0,
  available: 46,
} as const;

export const RIDECLOUD_FORBIDDEN_PROJECT_IDS = [
  PHASE_11A_SMOKE_PROJECT_ID,
  MV001_MOTION_PROJECT_ID,
] as const;

const SENSITIVE_LOCATOR =
  /sk-[A-Za-z0-9]{12,}|X-Amz-Signature=|eyJ[A-Za-z0-9_-]{20,}\.|data:(?:image|audio|video)\/|[A-Za-z]:\\|[?&]token=|postgres(?:ql)?:\/\//i;

export type RideCloudCreateReplayDecision =
  | "CREATE"
  | "REPLAY_NOOP"
  | "REFUSE_FINGERPRINT_MISMATCH"
  | "REFUSE_NAME_COLLISION"
  | "REFUSE_TECHNICAL_PROJECT"
  | "REFUSE_CURRENT_PROJECT_FALLBACK";

export type RideCloudObservedProject = {
  id: string;
  workspaceId: string;
  name: string;
  correlationId: string;
  fingerprint?: string;
};

export type RideCloudCreateResolver = {
  mode: "explicit_workspace_project_run_plan_output" | "current_project" | string;
};

function uuidBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

export function rideCloudUuidV5(namespaceUuid: string, name: string): string {
  const hash = createHash("sha1").update(uuidBytes(namespaceUuid)).update(name).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function rideCloudDeterministicProjectId(): string {
  return rideCloudUuidV5(
    RIDECLOUD_ID_NAMESPACE,
    `vhs.video_project.${RIDECLOUD_CANONICAL_WORKSPACE_ID}.${RIDECLOUD_PROJECT_KEY}`,
  );
}

export function rideCloudDeterministicBriefId(projectId: string): string {
  return rideCloudUuidV5(
    RIDECLOUD_ID_NAMESPACE,
    `vhs.artifact.video_project_brief.${projectId}.rev1`,
  );
}

export function redactRideCloudId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export function plannedRideCloudBriefFields() {
  return {
    projectName: RIDECLOUD_PROJECT_DISPLAY_NAME,
    subjectType: "product" as const,
    subjectName: RIDECLOUD_PRODUCT_NAME,
    subjectDescription: RIDECLOUD_LOCKED_CLAIM,
    objective: "lead_generation" as const,
    platform: "instagram" as const,
    durationSeconds: 30 as const,
    aspectRatio: "9:16" as const,
    language: "fr",
    tone: "professional" as const,
    callToAction: RIDECLOUD_LOCKED_CTA,
    audienceDescription: "LinkedIn and Instagram. Master 9:16; derived 4:5 and 1:1.",
    brandConstraints:
      "delivery_duration_sec=26; storyboard_local_contract_only; premium_lifetime_only_with_founder_program_terms; no vehicle partnership; no Play badge unless exact; crop android overlay; banner copy is not a claim",
    mediaReferences: [] as const,
  };
}

export function rideCloudCreateCommandFingerprint(input: {
  projectId: string;
  briefId: string;
}): string {
  const payload = {
    auth: RIDECLOUD_PROJECT_CREATE_NEXT_AUTH,
    projectKey: RIDECLOUD_PROJECT_KEY,
    name: RIDECLOUD_PROJECT_DISPLAY_NAME,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    projectId: input.projectId,
    briefId: input.briefId,
    rpc: RIDECLOUD_FUTURE_RPC,
    status: RIDECLOUD_FUTURE_PROJECT_STATUS,
    brief: plannedRideCloudBriefFields(),
    storyboardVerdict: RIDECLOUD_STORYBOARD_VERDICT,
    durationSec: RIDECLOUD_STORYBOARD_DURATION_SEC,
    shotCount: RIDECLOUD_FIRST_AD_SHOTS.length,
    voiceRole: "narrator_female",
    lipsync: false,
    music: false,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function assertRideCloudCreateAuthChain(): void {
  if (RIDECLOUD_STORYBOARD_NEXT_AUTH !== RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_AUTH_CHAIN");
  }
}

export function assertRideCloudCreateIdentity(): void {
  if (RIDECLOUD_PROJECT_KEY !== "ridecloud-promo-separate-v1") {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_PROJECT_KEY");
  }
  if (RIDECLOUD_PROJECT_DISPLAY_NAME !== "RideCloud — First Founder Ad") {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_PROJECT_NAME");
  }
  if (RIDECLOUD_CANONICAL_WORKSPACE_ID !== PHASE_11B_WORKSPACE_ID) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_WORKSPACE");
  }
}

export function assertRideCloudCreateIsolation(projectId: string): void {
  if ((RIDECLOUD_FORBIDDEN_PROJECT_IDS as readonly string[]).includes(projectId)) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_REUSES_TECHNICAL_PROJECT");
  }
  if (projectId === PHASE_11A_SMOKE_PROJECT_ID) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_REUSES_I2V_PROJECT");
  }
  if (projectId === MV001_MOTION_PROJECT_ID) {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_REUSES_MOTION_PROJECT");
  }
}

export function assertRideCloudCreateResolver(resolver: RideCloudCreateResolver): void {
  if (resolver.mode !== "explicit_workspace_project_run_plan_output") {
    throw new Error("BLOCKED_RIDECLOUD_CURRENT_PROJECT_FALLBACK");
  }
}

export function decideRideCloudCreateReplay(input: {
  planned: RideCloudObservedProject;
  observed: readonly RideCloudObservedProject[];
  resolver: RideCloudCreateResolver;
}): RideCloudCreateReplayDecision {
  if (input.resolver.mode === "current_project") return "REFUSE_CURRENT_PROJECT_FALLBACK";
  for (const row of input.observed) {
    if ((RIDECLOUD_FORBIDDEN_PROJECT_IDS as readonly string[]).includes(row.id)) {
      if (row.id === input.planned.id) return "REFUSE_TECHNICAL_PROJECT";
    }
    if (row.name === input.planned.name && row.id !== input.planned.id) {
      return "REFUSE_NAME_COLLISION";
    }
    if (row.id === input.planned.id) {
      if (
        row.workspaceId === input.planned.workspaceId &&
        row.name === input.planned.name &&
        row.correlationId === input.planned.correlationId &&
        row.fingerprint === input.planned.fingerprint
      ) {
        return "REPLAY_NOOP";
      }
      return "REFUSE_FINGERPRINT_MISMATCH";
    }
  }
  return "CREATE";
}

export function assertRideCloudCreateRuntime(input: {
  voiceRuntime: "OFF" | "ON";
  paidMediaRuntime: "OFF" | "ON";
  voiceSubmitCount: number;
  maySubmit: boolean;
  flagsOff: boolean;
}): void {
  if (input.voiceRuntime !== "OFF") throw new Error("BLOCKED_RIDECLOUD_VOICE_RUNTIME_ON");
  if (input.paidMediaRuntime !== "OFF") throw new Error("BLOCKED_RIDECLOUD_PAID_MEDIA_ON");
  if (!input.flagsOff) throw new Error("BLOCKED_RIDECLOUD_SENSITIVE_FLAG_ON");
  if (input.voiceSubmitCount !== RIDECLOUD_VOICE_SUBMIT_COUNT) {
    throw new Error("BLOCKED_RIDECLOUD_VOICE_SUBMIT_COUNT");
  }
  if (input.maySubmit !== RIDECLOUD_VOICE_MAY_SUBMIT) {
    throw new Error("BLOCKED_RIDECLOUD_VOICE_MAY_SUBMIT");
  }
}

export function assertRideCloudCreateBudget(input: {
  hard: number;
  committed: number;
  reserved: number;
  available: number;
}): void {
  if (
    input.hard !== RIDECLOUD_DOCUMENTED_BUDGET.hard ||
    input.committed !== RIDECLOUD_DOCUMENTED_BUDGET.committed ||
    input.reserved !== RIDECLOUD_DOCUMENTED_BUDGET.reserved ||
    input.available !== RIDECLOUD_DOCUMENTED_BUDGET.available
  ) {
    throw new Error("BLOCKED_RIDECLOUD_BUDGET_DRIFT");
  }
}

export function assertRideCloudCreatePlanIsRedactedSafe(value: unknown): void {
  const text = JSON.stringify(value);
  if (SENSITIVE_LOCATOR.test(text)) {
    throw new Error("BLOCKED_RIDECLOUD_SENSITIVE_LOCATOR");
  }
  assertRideCloudLocatorIsRedactedSafe(text);
}

export type RideCloudSeparateProjectCreatePreflight = {
  auth: typeof RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH;
  verdict: typeof RIDECLOUD_PROJECT_CREATE_PREFLIGHT_VERDICT;
  nextAuth: typeof RIDECLOUD_PROJECT_CREATE_NEXT_AUTH;
  identity: {
    projectKey: typeof RIDECLOUD_PROJECT_KEY;
    name: typeof RIDECLOUD_PROJECT_DISPLAY_NAME;
    workspaceIdPrefix: string;
    projectIdPrefix: string;
    briefIdPrefix: string;
    owner: typeof RIDECLOUD_PROJECT_OWNER;
    campaign: typeof RIDECLOUD_PROJECT_CAMPAIGN;
    channels: readonly ["linkedin", "instagram"];
    language: "fr";
    durationSec: 26;
    masterAspectRatio: "9:16";
    derivedAspectRatios: readonly ["4:5", "1:1"];
    correlationId: typeof RIDECLOUD_PROJECT_KEY;
  };
  isolation: {
    technicalProjectIdsForbidden: readonly string[];
    technicalProofsRejected: readonly string[];
    motionIsolated: true;
    pointerStrategy: typeof RIDECLOUD_POINTER_STRATEGY;
    currentProjectFallback: false;
    pointerMutations: 0;
    activations: 0;
    publications: 0;
  };
  creative: {
    shotCount: 6;
    durationSec: 26;
    voiceRole: "narrator_female";
    providerIdentityActivated: false;
    lipsync: false;
    music: false;
    bannerInTimeline: false;
    playBadge: false;
    vehicleBrandClaim: false;
    storyboardPersistedThisWrite: false;
  };
  duplicate: {
    liveSelect: "NOT_EXECUTED";
    documentaryRideCloudProjects: 0;
    localDenylistPass: true;
    dbUniqueName: false;
    compensatingControl: "deterministic_uuid_pk_plus_rpc_cas_plus_name_select";
  };
  futureWrite: {
    rpc: typeof RIDECLOUD_FUTURE_RPC;
    projectStatus: typeof RIDECLOUD_FUTURE_PROJECT_STATUS;
    artifacts: readonly ["video_project_brief"];
    fingerprintPrefix: string;
    createsRuns: false;
    createsJobs: false;
    createsAttempts: false;
    createsOutputs: false;
    uploadsStorage: false;
    reservesBudget: false;
    writesFlags: false;
    callsProvider: false;
  };
  runtime: {
    voiceRuntime: "OFF";
    paidMediaRuntime: "OFF";
    flagsConsideredOff: true;
    voiceSubmitCount: 1;
    maySubmit: false;
  };
  budget: typeof RIDECLOUD_DOCUMENTED_BUDGET;
  counters: {
    providerCalls: 0;
    ttsCalls: 0;
    signedUrlCount: 0;
    mediaReads: 0;
    mediaWrites: 0;
    storageUploads: 0;
    supabaseMutations: 0;
    productionWrites: 0;
    productionProjectsCreated: 0;
    runsCreated: 0;
    jobsCreated: 0;
    attemptsCreated: 0;
    outputsCreated: 0;
    budgetWrites: 0;
    flagsWritten: 0;
  };
};

export function buildRideCloudSeparateProjectCreatePreflight(): RideCloudSeparateProjectCreatePreflight {
  assertRideCloudCreateAuthChain();
  assertRideCloudCreateIdentity();
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
  assertRideCloudCreateRuntime({
    voiceRuntime: "OFF",
    paidMediaRuntime: "OFF",
    voiceSubmitCount: RIDECLOUD_VOICE_SUBMIT_COUNT,
    maySubmit: RIDECLOUD_VOICE_MAY_SUBMIT,
    flagsOff: true,
  });
  assertRideCloudCreateBudget(RIDECLOUD_DOCUMENTED_BUDGET);
  assertRideCloudCreateResolver({ mode: "explicit_workspace_project_run_plan_output" });

  const manifest = buildRideCloudCurrentManifest();
  if (manifest.readinessVerdict !== "READY") {
    throw new Error("BLOCKED_RIDECLOUD_INPUTS_NOT_READY");
  }
  const board = buildRideCloudFirstAdStoryboard();
  if (board.shots.length !== 6 || board.durationSec !== 26) {
    throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_NOT_LOCKED");
  }
  for (const shot of board.shots) {
    assertNotRideCloudDeliverable(shot.visualRef);
  }

  const projectId = rideCloudDeterministicProjectId();
  const briefId = rideCloudDeterministicBriefId(projectId);
  assertRideCloudCreateIsolation(projectId);
  assertRideCloudCreateIsolation(briefId);
  const fingerprint = rideCloudCreateCommandFingerprint({ projectId, briefId });
  const planned: RideCloudObservedProject = {
    id: projectId,
    workspaceId: RIDECLOUD_CANONICAL_WORKSPACE_ID,
    name: RIDECLOUD_PROJECT_DISPLAY_NAME,
    correlationId: RIDECLOUD_PROJECT_KEY,
    fingerprint,
  };
  const replay = decideRideCloudCreateReplay({
    planned,
    observed: [],
    resolver: { mode: "explicit_workspace_project_run_plan_output" },
  });
  if (replay !== "CREATE") {
    throw new Error("BLOCKED_RIDECLOUD_CREATE_LOCAL_DUPLICATE");
  }

  const plan = {
    auth: RIDECLOUD_PROJECT_CREATE_PREFLIGHT_AUTH,
    verdict: RIDECLOUD_PROJECT_CREATE_PREFLIGHT_VERDICT,
    nextAuth: RIDECLOUD_PROJECT_CREATE_NEXT_AUTH,
    identity: {
      projectKey: RIDECLOUD_PROJECT_KEY,
      name: RIDECLOUD_PROJECT_DISPLAY_NAME,
      workspaceIdPrefix: redactRideCloudId(RIDECLOUD_CANONICAL_WORKSPACE_ID),
      projectIdPrefix: redactRideCloudId(projectId),
      briefIdPrefix: redactRideCloudId(briefId),
      owner: RIDECLOUD_PROJECT_OWNER,
      campaign: RIDECLOUD_PROJECT_CAMPAIGN,
      channels: ["linkedin", "instagram"] as const,
      language: "fr" as const,
      durationSec: 26 as const,
      masterAspectRatio: "9:16" as const,
      derivedAspectRatios: ["4:5", "1:1"] as const,
      correlationId: RIDECLOUD_PROJECT_KEY,
    },
    isolation: {
      technicalProjectIdsForbidden: RIDECLOUD_FORBIDDEN_PROJECT_IDS.map(redactRideCloudId),
      technicalProofsRejected: RIDECLOUD_REJECTED_UNSAFE_SOURCES,
      motionIsolated: true as const,
      pointerStrategy: RIDECLOUD_POINTER_STRATEGY,
      currentProjectFallback: false as const,
      pointerMutations: 0 as const,
      activations: 0 as const,
      publications: 0 as const,
    },
    creative: {
      shotCount: 6 as const,
      durationSec: 26 as const,
      voiceRole: "narrator_female" as const,
      providerIdentityActivated: false as const,
      lipsync: false as const,
      music: false as const,
      bannerInTimeline: false as const,
      playBadge: false as const,
      vehicleBrandClaim: false as const,
      storyboardPersistedThisWrite: false as const,
    },
    duplicate: {
      liveSelect: "NOT_EXECUTED" as const,
      documentaryRideCloudProjects: 0 as const,
      localDenylistPass: true as const,
      dbUniqueName: false as const,
      compensatingControl: "deterministic_uuid_pk_plus_rpc_cas_plus_name_select" as const,
    },
    futureWrite: {
      rpc: RIDECLOUD_FUTURE_RPC,
      projectStatus: RIDECLOUD_FUTURE_PROJECT_STATUS,
      artifacts: ["video_project_brief"] as const,
      fingerprintPrefix: fingerprint.slice(0, 16),
      createsRuns: false as const,
      createsJobs: false as const,
      createsAttempts: false as const,
      createsOutputs: false as const,
      uploadsStorage: false as const,
      reservesBudget: false as const,
      writesFlags: false as const,
      callsProvider: false as const,
    },
    runtime: {
      voiceRuntime: "OFF" as const,
      paidMediaRuntime: "OFF" as const,
      flagsConsideredOff: true as const,
      voiceSubmitCount: 1 as const,
      maySubmit: false as const,
    },
    budget: RIDECLOUD_DOCUMENTED_BUDGET,
    counters: {
      providerCalls: 0 as const,
      ttsCalls: 0 as const,
      signedUrlCount: 0 as const,
      mediaReads: 0 as const,
      mediaWrites: 0 as const,
      storageUploads: 0 as const,
      supabaseMutations: 0 as const,
      productionWrites: 0 as const,
      productionProjectsCreated: 0 as const,
      runsCreated: 0 as const,
      jobsCreated: 0 as const,
      attemptsCreated: 0 as const,
      outputsCreated: 0 as const,
      budgetWrites: 0 as const,
      flagsWritten: 0 as const,
    },
  } satisfies RideCloudSeparateProjectCreatePreflight;

  assertRideCloudCreatePlanIsRedactedSafe(plan);
  void RIDECLOUD_LOCKED_SIGNATURE;
  return plan;
}

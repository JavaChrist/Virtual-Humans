/**
 * RideCloud separate-project input collection preflight.
 * No provider, no media I/O, no Production create/upload.
 */
import { PHASE_11C_NEXT_AUTH } from "./phase-11c-close-and-next-gate-audit";

export const RIDECLOUD_INPUT_PREFLIGHT_AUTH = PHASE_11C_NEXT_AUTH;

export const RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY = "READY" as const;
export const RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED = "BLOCKED_INPUTS_REQUIRED" as const;

export type RideCloudInputPreflightVerdict =
  | typeof RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY
  | typeof RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED;

export const RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED =
  "AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER" as const;

export const RIDECLOUD_PROJECT_KEY = "ridecloud-promo-separate-v1" as const;
export const RIDECLOUD_PRODUCT_NAME = "RideCloud" as const;

export type RideCloudInputStatus =
  | "AVAILABLE_VERIFIED"
  | "AVAILABLE_UNVERIFIED"
  | "MISSING_REQUIRED"
  | "OPTIONAL"
  | "REJECTED_UNSAFE";

export type RideCloudInputKey =
  | "productBrief"
  | "campaignGoal"
  | "audience"
  | "logoBrand"
  | "screenshots"
  | "screenRecordings"
  | "approvedClaims"
  | "valueProposition"
  | "cta"
  | "durationFormats"
  | "language"
  | "voiceRole"
  | "musicRights"
  | "legalConstraints";

export const RIDECLOUD_ALWAYS_REQUIRED_KEYS = [
  "productBrief",
  "campaignGoal",
  "audience",
  "logoBrand",
  "approvedClaims",
  "valueProposition",
  "cta",
  "durationFormats",
  "language",
  "voiceRole",
  "musicRights",
  "legalConstraints",
] as const satisfies readonly RideCloudInputKey[];

export const RIDECLOUD_VISUAL_SOURCE_KEYS = [
  "screenshots",
  "screenRecordings",
] as const satisfies readonly RideCloudInputKey[];

export type RideCloudOpaqueRef = `ref:${string}`;

export type RideCloudInputRecord = {
  key: RideCloudInputKey;
  status: RideCloudInputStatus;
  note: string;
  references: readonly RideCloudOpaqueRef[];
};

export type RideCloudInputManifest = {
  projectKey: typeof RIDECLOUD_PROJECT_KEY;
  productName: typeof RIDECLOUD_PRODUCT_NAME;
  campaignGoal: string | null;
  audience: string | null;
  targetPlatforms: readonly string[];
  aspectRatios: readonly string[];
  targetDuration: string | null;
  language: string | null;
  voiceRole: string | null;
  brandAssetReferences: readonly RideCloudOpaqueRef[];
  captureReferences: readonly RideCloudOpaqueRef[];
  recordingReferences: readonly RideCloudOpaqueRef[];
  approvedClaims: readonly string[];
  CTA: string | null;
  musicRightsStatus: RideCloudInputStatus;
  legalConstraints: readonly string[];
  missingRequiredInputs: readonly RideCloudInputKey[];
  readinessVerdict: RideCloudInputPreflightVerdict;
};

export const RIDECLOUD_REJECTED_UNSAFE_SOURCES = [
  "ref:vhs-11a-image-technical-proof",
  "ref:vhs-11b-i2v-technical-proof",
  "ref:vhs-11c-voice-technical-proof",
  "ref:vhs-10x-director-text-artifacts",
  "ref:vhs-studio-icon",
  "ref:vhs-studio-dashboard-screenshots",
  "ref:character-sdk-product-memory",
  "ref:e2e-ridecloud-fixtures",
] as const satisfies readonly RideCloudOpaqueRef[];

export const RIDECLOUD_EXPECTED_CONSTRAINTS = {
  logo: {
    kinds: ["svg", "png"] as const,
    provenance: "ridecloud_owned_or_licensed",
    gitPolicy: "opaque_reference_only",
  },
  screenshots: {
    kinds: ["png", "webp"] as const,
    source: "real_ridecloud_ui",
    pii: "forbidden",
  },
  recordings: {
    kinds: ["mp4"] as const,
    source: "real_ridecloud_ui",
    pii: "forbidden",
  },
  claims: {
    approval: "christian_written",
    improvisation: "forbidden",
  },
  cta: {
    count: 1,
    languageLocked: true,
  },
  durationWindowSec: [15, 30] as const,
  suggestedAspectRatios: ["9:16", "1:1", "16:9"] as const,
  voice: {
    recommendedRole: "narrator_female",
    lipsync: false,
  },
  music: {
    licenseProof: "required_for_recommended_first_ad",
  },
} as const;

export const RIDECLOUD_FIRST_AD_CONCEPT =
  "captures_or_recordings -> animated_montage -> narrator_female -> texts_cta -> licensed_music -> private_export -> human_review" as const;

const SENSITIVE_LOCATOR =
  /sk-[A-Za-z0-9]{12,}|X-Amz-Signature=|eyJ[A-Za-z0-9_-]{20,}\.|data:(?:image|audio|video)\/|[A-Za-z]:\\|[?&]token=/i;

export function assertRideCloudLocatorIsRedactedSafe(value: string): void {
  if (SENSITIVE_LOCATOR.test(value)) {
    throw new Error("BLOCKED_RIDECLOUD_SENSITIVE_LOCATOR");
  }
}

export function assertNotRideCloudDeliverable(source: string): void {
  if ((RIDECLOUD_REJECTED_UNSAFE_SOURCES as readonly string[]).includes(source)) {
    throw new Error("BLOCKED_RIDECLOUD_TECHNICAL_PROOF_NOT_DELIVERABLE");
  }
}

export function assertRideCloudNoSideEffects(input: {
  providerCalls: number;
  elevenLabsCalls: number;
  falCalls: number;
  signedUrlCount: number;
  mediaReads: number;
  mediaWrites: number;
  storageUploads: number;
  productionWrites: number;
  supabaseMutations: number;
  flagWrites: number;
  deploymentsTriggered: number;
  productionProjectsCreated: number;
  humanReviewWrites: number;
}): void {
  if (Object.values(input).some((n) => n !== 0)) {
    throw new Error("BLOCKED_RIDECLOUD_SIDE_EFFECT");
  }
}

export function missingRequiredRideCloudInputs(
  inventory: Readonly<Record<RideCloudInputKey, RideCloudInputStatus>>,
): RideCloudInputKey[] {
  const missing: RideCloudInputKey[] = [];
  for (const key of RIDECLOUD_ALWAYS_REQUIRED_KEYS) {
    if (inventory[key] !== "AVAILABLE_VERIFIED") {
      missing.push(key);
    }
  }
  const hasVerifiedVisual = RIDECLOUD_VISUAL_SOURCE_KEYS.some(
    (key) => inventory[key] === "AVAILABLE_VERIFIED",
  );
  if (!hasVerifiedVisual) {
    for (const key of RIDECLOUD_VISUAL_SOURCE_KEYS) {
      if (!missing.includes(key)) missing.push(key);
    }
  }
  return missing;
}

export function evaluateRideCloudInputReadiness(
  inventory: Readonly<Record<RideCloudInputKey, RideCloudInputStatus>>,
): RideCloudInputPreflightVerdict {
  return missingRequiredRideCloudInputs(inventory).length === 0
    ? RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY
    : RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED;
}

export function chooseRideCloudNextAuth(
  verdict: RideCloudInputPreflightVerdict,
): typeof RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED {
  if (verdict !== RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED) {
    throw new Error("BLOCKED_RIDECLOUD_NEXT_AUTH_NOT_FOR_READY");
  }
  return RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED;
}

/** Observed workspace facts. No invented campaign copy. */
export const RIDECLOUD_OBSERVED_INVENTORY = {
  productBrief: "MISSING_REQUIRED",
  campaignGoal: "AVAILABLE_UNVERIFIED",
  audience: "AVAILABLE_VERIFIED",
  logoBrand: "MISSING_REQUIRED",
  screenshots: "MISSING_REQUIRED",
  screenRecordings: "MISSING_REQUIRED",
  approvedClaims: "MISSING_REQUIRED",
  valueProposition: "MISSING_REQUIRED",
  cta: "MISSING_REQUIRED",
  durationFormats: "MISSING_REQUIRED",
  language: "AVAILABLE_UNVERIFIED",
  voiceRole: "AVAILABLE_UNVERIFIED",
  musicRights: "MISSING_REQUIRED",
  legalConstraints: "MISSING_REQUIRED",
} as const satisfies Record<RideCloudInputKey, RideCloudInputStatus>;

export const RIDECLOUD_OBSERVED_INPUT_NOTES: Record<RideCloudInputKey, string> = {
  productBrief: "No RideCloud product brief was supplied for this separate promo project.",
  campaignGoal: "Christian stated promo videos for testers; the exact ad objective is not locked.",
  audience: "Google Play test + JavaChrist Beta Club Discord, stated in this Auth.",
  logoBrand: "No RideCloud logo or brand charter was supplied. VHS icon is rejected.",
  screenshots: "No RideCloud UI captures were supplied. VHS dashboard shots are rejected.",
  screenRecordings: "No RideCloud screen recordings were supplied.",
  approvedClaims: "No Christian-approved commercial claims were supplied. SDK memory is rejected.",
  valueProposition: "No authorized RideCloud value proposition was supplied.",
  cta: "No campaign CTA was supplied. VHS overlay CTA is rejected.",
  durationFormats: "No target duration, aspect ratio, or platform format was locked.",
  language: "Workspace is French; campaign language is not locked.",
  voiceRole: "narrator_female is recommended for the first ad; not a locked delivery order.",
  musicRights: "No licensed music or license proof was supplied.",
  legalConstraints: "No Play/Discord/brand legal mentions were supplied.",
};

export function buildRideCloudObservedRecords(): RideCloudInputRecord[] {
  return (Object.keys(RIDECLOUD_OBSERVED_INVENTORY) as RideCloudInputKey[]).map((key) => ({
    key,
    status: RIDECLOUD_OBSERVED_INVENTORY[key],
    note: RIDECLOUD_OBSERVED_INPUT_NOTES[key],
    references: [],
  }));
}

export function buildRideCloudObservedManifest(): RideCloudInputManifest {
  const missing = missingRequiredRideCloudInputs(RIDECLOUD_OBSERVED_INVENTORY);
  const verdict = evaluateRideCloudInputReadiness(RIDECLOUD_OBSERVED_INVENTORY);
  for (const source of RIDECLOUD_REJECTED_UNSAFE_SOURCES) {
    assertRideCloudLocatorIsRedactedSafe(source);
  }
  return {
    projectKey: RIDECLOUD_PROJECT_KEY,
    productName: RIDECLOUD_PRODUCT_NAME,
    campaignGoal: null,
    audience: "google_play_test+javachrist_beta_club_discord",
    targetPlatforms: [],
    aspectRatios: [],
    targetDuration: null,
    language: null,
    voiceRole: null,
    brandAssetReferences: [],
    captureReferences: [],
    recordingReferences: [],
    approvedClaims: [],
    CTA: null,
    musicRightsStatus: RIDECLOUD_OBSERVED_INVENTORY.musicRights,
    legalConstraints: [],
    missingRequiredInputs: missing,
    readinessVerdict: verdict,
  };
}

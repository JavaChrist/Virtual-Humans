/**
 * RideCloud separate-project input collection preflight.
 * No provider, no Git media, no Production create/upload.
 */
import { PHASE_11C_NEXT_AUTH } from "./phase-11c-close-and-next-gate-audit";

export const RIDECLOUD_INPUT_PREFLIGHT_AUTH = PHASE_11C_NEXT_AUTH;

export const RIDECLOUD_SUPPLY_AUTH =
  "AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER" as const;

export const RIDECLOUD_HIGH_RES_ADDENDUM_AUTH =
  "AUTH_RIDECLOUD_PACK_HIGH_RES_VARIANTS_ADDENDUM_NO_PROVIDER" as const;

export const RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY = "READY" as const;
export const RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED = "BLOCKED_INPUTS_REQUIRED" as const;

export type RideCloudInputPreflightVerdict =
  | typeof RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY
  | typeof RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED;

export const RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED = RIDECLOUD_SUPPLY_AUTH;

export const RIDECLOUD_NEXT_AUTH_WHEN_READY =
  "AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_PROJECT_KEY = "ridecloud-promo-separate-v1" as const;
export const RIDECLOUD_PRODUCT_NAME = "RideCloud" as const;
export const RIDECLOUD_INTEGRITY_PREFIX_LENGTH = 12 as const;

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
  brandVariantReferences: readonly RideCloudOpaqueRef[];
  captureReferences: readonly RideCloudOpaqueRef[];
  captureVariantReferences: readonly RideCloudOpaqueRef[];
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

export const RIDECLOUD_LOCKED_CLAIM =
  "Le carnet d’entretien intelligent de tous vos véhicules." as const;
export const RIDECLOUD_LOCKED_SIGNATURE = "Centralisez, anticipez, valorisez." as const;
export const RIDECLOUD_LOCKED_CTA =
  "Rejoignez le Programme Fondateur, testez RideCloud, remplissez le questionnaire et bénéficiez de Premium à vie." as const;

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
    androidOverlay: "crop_before_deliverable",
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
  durationWindowSec: [20, 30] as const,
  suggestedAspectRatios: ["9:16", "4:5", "1:1"] as const,
  voice: {
    recommendedRole: "narrator_female",
    lipsync: false,
  },
  music: {
    licenseProof: "waived_until_license",
  },
} as const;

export const RIDECLOUD_FIRST_AD_CONCEPT =
  "captures -> animated_montage -> narrator_female -> texts_cta -> no_music -> private_export -> human_review" as const;

export const RIDECLOUD_LOGO_REF = "ref:ridecloud-logo-512x512#5b3b85a3d8a5" as const;
export const RIDECLOUD_BANNER_REF = "ref:ridecloud-banner-1024x500#d26a04137ca0" as const;
export const RIDECLOUD_BANNER_VARIANT_REF = "ref:ridecloud-banner-1794x876#804bca9d9832" as const;

export const RIDECLOUD_CAPTURE_REFS = [
  "ref:ridecloud-capture-720x1604-01#eed8f55e672a",
  "ref:ridecloud-capture-720x1604-02#06de5cced6e7",
  "ref:ridecloud-capture-720x1604-03#df2d97b1bfec",
  "ref:ridecloud-capture-720x1604-04#4b01c163a06e",
  "ref:ridecloud-capture-720x1604-05#81bcc97236e1",
  "ref:ridecloud-capture-720x1604-06#6d2886fc7aa3",
  "ref:ridecloud-capture-720x1604-07#0aabc4c4e109",
  "ref:ridecloud-capture-720x1604-08#ffc111b59fe9",
  "ref:ridecloud-capture-720x1604-09#314f7face28d",
  "ref:ridecloud-capture-720x1604-10#e6523b986d67",
] as const satisfies readonly RideCloudOpaqueRef[];

export const RIDECLOUD_CAPTURE_VARIANT_REFS = [
  "ref:ridecloud-capture-1080x2424-01#b0eb965287e6",
  "ref:ridecloud-capture-1080x2424-02#031e72c27384",
  "ref:ridecloud-capture-1080x2424-03#fba239a8de97",
  "ref:ridecloud-capture-1080x2424-04#ea898663643e",
] as const satisfies readonly RideCloudOpaqueRef[];

export const RIDECLOUD_VARIANT_PREFERENCE = {
  captures1080pExport: "prefer_1080x2424_variants_keep_720x1604",
  banner: "prefer_1794x876_variant_keep_1024x500",
} as const;

const SENSITIVE_LOCATOR =
  /sk-[A-Za-z0-9]{12,}|X-Amz-Signature=|eyJ[A-Za-z0-9_-]{20,}\.|data:(?:image|audio|video)\/|[A-Za-z]:\\|[?&]token=/i;

export function assertRideCloudLocatorIsRedactedSafe(value: string): void {
  if (SENSITIVE_LOCATOR.test(value)) {
    throw new Error("BLOCKED_RIDECLOUD_SENSITIVE_LOCATOR");
  }
}

export function assertRideCloudIntegrityPrefix(prefix: string): void {
  if (!/^[0-9a-f]{12}$/.test(prefix)) {
    throw new Error("BLOCKED_RIDECLOUD_INTEGRITY_PREFIX");
  }
}

export function rideCloudRefIntegrityPrefix(ref: RideCloudOpaqueRef): string {
  const hash = ref.split("#")[1] ?? "";
  assertRideCloudIntegrityPrefix(hash);
  return hash;
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

function isSatisfiedRequired(key: RideCloudInputKey, status: RideCloudInputStatus): boolean {
  if (status === "AVAILABLE_VERIFIED") return true;
  if (key === "musicRights" && status === "OPTIONAL") return true;
  return false;
}

export function missingRequiredRideCloudInputs(
  inventory: Readonly<Record<RideCloudInputKey, RideCloudInputStatus>>,
): RideCloudInputKey[] {
  const missing: RideCloudInputKey[] = [];
  for (const key of RIDECLOUD_ALWAYS_REQUIRED_KEYS) {
    if (!isSatisfiedRequired(key, inventory[key])) {
      missing.push(key);
    }
  }
  if (inventory.musicRights !== "AVAILABLE_VERIFIED" && inventory.musicRights !== "OPTIONAL") {
    missing.push("musicRights");
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
): typeof RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED | typeof RIDECLOUD_NEXT_AUTH_WHEN_READY {
  if (verdict === RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED) {
    return RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED;
  }
  return RIDECLOUD_NEXT_AUTH_WHEN_READY;
}

/** Snapshot 157_ — empty pack before this Auth. */
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
  audience: "Google Play test + JavaChrist Beta Club Discord, stated in the 157_ Auth.",
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

/** Current pack after AUTH_RIDECLOUD_SUPPLY_MISSING_REQUIRED_INPUTS_NO_PROVIDER. */
export const RIDECLOUD_CURRENT_INVENTORY = {
  productBrief: "AVAILABLE_VERIFIED",
  campaignGoal: "AVAILABLE_VERIFIED",
  audience: "AVAILABLE_VERIFIED",
  logoBrand: "AVAILABLE_VERIFIED",
  screenshots: "AVAILABLE_VERIFIED",
  screenRecordings: "OPTIONAL",
  approvedClaims: "AVAILABLE_VERIFIED",
  valueProposition: "AVAILABLE_VERIFIED",
  cta: "AVAILABLE_VERIFIED",
  durationFormats: "AVAILABLE_VERIFIED",
  language: "AVAILABLE_VERIFIED",
  voiceRole: "AVAILABLE_VERIFIED",
  musicRights: "OPTIONAL",
  legalConstraints: "AVAILABLE_VERIFIED",
} as const satisfies Record<RideCloudInputKey, RideCloudInputStatus>;

export const RIDECLOUD_CURRENT_INPUT_NOTES: Record<RideCloudInputKey, string> = {
  productBrief: "Locked from Christian claim + signature. No extra brief invented.",
  campaignGoal: "20–30s founder-program ad for LinkedIn and Instagram.",
  audience: "LinkedIn and Instagram, locked by this Auth.",
  logoBrand: "512×512 logo verified locally. 1024×500 banner locked. 1794×876 banner is a variant only.",
  screenshots: "10 captures 720×1604 locked. 4 captures 1080×2424 added as official variants. Android overlay crop later.",
  screenRecordings: "None supplied. Screenshots satisfy the visual-source rule.",
  approvedClaims: "One locked claim. No improvisation.",
  valueProposition: "Locked signature: Centralisez, anticipez, valorisez.",
  cta: "One locked CTA. Premium à vie stays tied to Programme Fondateur.",
  durationFormats: "20–30s. Future ratios 9:16, 4:5, optional 1:1.",
  language: "French, locked by the approved copy.",
  voiceRole: "narrator_female locked. Lipsync false.",
  musicRights: "Explicitly none until a license is supplied.",
  legalConstraints: "Founder terms, no vehicle partnership, Play badge only if exact.",
};

export const RIDECLOUD_LOCKED_LEGAL = [
  "premium_lifetime_only_with_founder_program_terms",
  "vehicle_brands_must_not_imply_partnership",
  "google_play_badge_only_if_distribution_claim_is_exact",
  "android_system_overlay_must_be_cropped_before_deliverable",
  "no_personal_data_in_sources",
  "banner_image_copy_is_not_an_authorized_claim",
] as const;

export function rideCloudOfficialRefs(): readonly RideCloudOpaqueRef[] {
  return [
    RIDECLOUD_LOGO_REF,
    RIDECLOUD_BANNER_REF,
    RIDECLOUD_BANNER_VARIANT_REF,
    ...RIDECLOUD_CAPTURE_REFS,
    ...RIDECLOUD_CAPTURE_VARIANT_REFS,
  ];
}

export function assertRideCloudLockedRefsUnreplaced(manifest: RideCloudInputManifest): void {
  if (manifest.brandAssetReferences.length !== 2) {
    throw new Error("BLOCKED_RIDECLOUD_LOCKED_BRAND_REPLACED");
  }
  if (manifest.brandAssetReferences[0] !== RIDECLOUD_LOGO_REF) {
    throw new Error("BLOCKED_RIDECLOUD_LOCKED_BRAND_REPLACED");
  }
  if (manifest.brandAssetReferences[1] !== RIDECLOUD_BANNER_REF) {
    throw new Error("BLOCKED_RIDECLOUD_LOCKED_BRAND_REPLACED");
  }
  if (manifest.captureReferences.length !== RIDECLOUD_CAPTURE_REFS.length) {
    throw new Error("BLOCKED_RIDECLOUD_LOCKED_CAPTURE_REPLACED");
  }
  for (const [index, ref] of RIDECLOUD_CAPTURE_REFS.entries()) {
    if (manifest.captureReferences[index] !== ref) {
      throw new Error("BLOCKED_RIDECLOUD_LOCKED_CAPTURE_REPLACED");
    }
  }
  if (manifest.brandAssetReferences.includes(RIDECLOUD_BANNER_VARIANT_REF)) {
    throw new Error("BLOCKED_RIDECLOUD_VARIANT_COLLAPSED_INTO_LOCKED");
  }
  for (const ref of RIDECLOUD_CAPTURE_VARIANT_REFS) {
    if (manifest.captureReferences.includes(ref)) {
      throw new Error("BLOCKED_RIDECLOUD_VARIANT_COLLAPSED_INTO_LOCKED");
    }
  }
}

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
    brandVariantReferences: [],
    captureReferences: [],
    captureVariantReferences: [],
    recordingReferences: [],
    approvedClaims: [],
    CTA: null,
    musicRightsStatus: RIDECLOUD_OBSERVED_INVENTORY.musicRights,
    legalConstraints: [],
    missingRequiredInputs: missing,
    readinessVerdict: evaluateRideCloudInputReadiness(RIDECLOUD_OBSERVED_INVENTORY),
  };
}

export function buildRideCloudCurrentRecords(): RideCloudInputRecord[] {
  return (Object.keys(RIDECLOUD_CURRENT_INVENTORY) as RideCloudInputKey[]).map((key) => ({
    key,
    status: RIDECLOUD_CURRENT_INVENTORY[key],
    note: RIDECLOUD_CURRENT_INPUT_NOTES[key],
    references:
      key === "logoBrand"
        ? [RIDECLOUD_LOGO_REF]
        : key === "screenshots"
          ? RIDECLOUD_CAPTURE_REFS
          : [],
  }));
}

export function buildRideCloudCurrentManifest(): RideCloudInputManifest {
  for (const ref of rideCloudOfficialRefs()) {
    assertRideCloudLocatorIsRedactedSafe(ref);
    rideCloudRefIntegrityPrefix(ref);
    assertNotRideCloudDeliverable(ref);
  }
  const missing = missingRequiredRideCloudInputs(RIDECLOUD_CURRENT_INVENTORY);
  const manifest = {
    projectKey: RIDECLOUD_PROJECT_KEY,
    productName: RIDECLOUD_PRODUCT_NAME,
    campaignGoal: "founder_program_ad_20_30s_linkedin_instagram",
    audience: "linkedin+instagram",
    targetPlatforms: ["linkedin", "instagram"],
    aspectRatios: ["9:16", "4:5", "1:1"],
    targetDuration: "20-30s",
    language: "fr",
    voiceRole: "narrator_female",
    brandAssetReferences: [RIDECLOUD_LOGO_REF, RIDECLOUD_BANNER_REF],
    brandVariantReferences: [RIDECLOUD_BANNER_VARIANT_REF],
    captureReferences: RIDECLOUD_CAPTURE_REFS,
    captureVariantReferences: RIDECLOUD_CAPTURE_VARIANT_REFS,
    recordingReferences: [],
    approvedClaims: [RIDECLOUD_LOCKED_CLAIM, RIDECLOUD_LOCKED_SIGNATURE],
    CTA: RIDECLOUD_LOCKED_CTA,
    musicRightsStatus: RIDECLOUD_CURRENT_INVENTORY.musicRights,
    legalConstraints: RIDECLOUD_LOCKED_LEGAL,
    missingRequiredInputs: missing,
    readinessVerdict: evaluateRideCloudInputReadiness(RIDECLOUD_CURRENT_INVENTORY),
  } satisfies RideCloudInputManifest;
  assertRideCloudLockedRefsUnreplaced(manifest);
  return manifest;
}

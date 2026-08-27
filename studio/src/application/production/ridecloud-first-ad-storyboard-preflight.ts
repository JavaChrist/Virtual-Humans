/**
 * RideCloud first-ad storyboard preflight.
 * Deterministic plan only. No provider, TTS, Generation, Production, or Git media.
 */
import {
  RIDECLOUD_BANNER_REF,
  RIDECLOUD_BANNER_VARIANT_REF,
  RIDECLOUD_CAPTURE_REFS,
  RIDECLOUD_CAPTURE_VARIANT_REFS,
  RIDECLOUD_EXPECTED_CONSTRAINTS,
  RIDECLOUD_FIRST_AD_CONCEPT,
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_CTA,
  RIDECLOUD_LOCKED_LEGAL,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_LOGO_REF,
  RIDECLOUD_NEXT_AUTH_WHEN_READY,
  RIDECLOUD_PRODUCT_NAME,
  RIDECLOUD_PROJECT_KEY,
  assertNotRideCloudDeliverable,
  assertRideCloudLocatorIsRedactedSafe,
  assertRideCloudNoSideEffects,
  rideCloudOfficialRefs,
  rideCloudRefIntegrityPrefix,
  type RideCloudOpaqueRef,
} from "./ridecloud-input-preflight";

export const RIDECLOUD_STORYBOARD_AUTH = RIDECLOUD_NEXT_AUTH_WHEN_READY;

export const RIDECLOUD_STORYBOARD_HARDENING_AUTH =
  "AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_AUDIO_CONTINUITY_HARDENING_NO_PROVIDER" as const;

export const RIDECLOUD_STORYBOARD_COPY_POLISH_AUTH =
  "AUTH_RIDECLOUD_STORYBOARD_VO_COPY_POLISH_AND_SYNC_NO_PROVIDER" as const;

export const RIDECLOUD_STORYBOARD_VERDICT =
  "RIDECLOUD_FIRST_AD_STORYBOARD_VO_COPY_POLISHED" as const;

export const RIDECLOUD_NATURAL_FRENCH_WPM_MAX = 165 as const;

export const RIDECLOUD_STORYBOARD_NEXT_AUTH =
  "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER" as const;

export const RIDECLOUD_STORYBOARD_DURATION_SEC = 26 as const;

export const RIDECLOUD_LOCKED_FOLLOW_NARRATION =
  "Suivez vos entretiens, vos échéances et vos documents en un seul endroit." as const;
export const RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION =
  "Voiture, moto, scooter ou utilitaire : tout votre garage est réuni." as const;
export const RIDECLOUD_LOCKED_CTA_INVITE =
  "Rejoignez le Programme Fondateur, testez RideCloud et remplissez le questionnaire." as const;
export const RIDECLOUD_LOCKED_CTA_PREMIUM = "Bénéficiez de Premium à vie." as const;

export const RIDECLOUD_ALLOWED_NARRATION = [
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_LOCKED_FOLLOW_NARRATION,
  RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION,
  RIDECLOUD_LOCKED_CTA_INVITE,
  RIDECLOUD_LOCKED_CTA_PREMIUM,
] as const;

export const RIDECLOUD_ALLOWED_ON_SCREEN_TEXT = [
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_LOCKED_CTA_INVITE,
  RIDECLOUD_LOCKED_CTA_PREMIUM,
  RIDECLOUD_PRODUCT_NAME,
] as const;

export type RideCloudStoryboardMotion = "hold" | "slow_push_in";
export type RideCloudStoryboardTransition = "cut" | "dissolve";

export type RideCloudStoryboardShot = {
  id: string;
  startSec: number;
  endSec: number;
  visualRef: RideCloudOpaqueRef;
  visualRole: string;
  motion: RideCloudStoryboardMotion;
  transitionOut: RideCloudStoryboardTransition;
  onScreenText: readonly string[];
  narration: string | null;
  cropRules: readonly string[];
};

export type RideCloudFirstAdStoryboard = {
  projectKey: typeof RIDECLOUD_PROJECT_KEY;
  productName: typeof RIDECLOUD_PRODUCT_NAME;
  durationSec: typeof RIDECLOUD_STORYBOARD_DURATION_SEC;
  durationWindowSec: readonly [20, 30];
  platforms: readonly ["linkedin", "instagram"];
  masterAspectRatio: "9:16";
  derivedAspectRatios: readonly ["4:5", "1:1"];
  language: "fr";
  voiceRole: "narrator_female";
  lipsync: false;
  music: false;
  concept: typeof RIDECLOUD_FIRST_AD_CONCEPT;
  shots: readonly RideCloudStoryboardShot[];
  unusedOfficialRefs: readonly RideCloudOpaqueRef[];
  legalConstraints: readonly string[];
  readinessVerdict: typeof RIDECLOUD_STORYBOARD_VERDICT;
  nextAuth: typeof RIDECLOUD_STORYBOARD_NEXT_AUTH;
};

const LANDING_REF = RIDECLOUD_CAPTURE_REFS[0];
const CATEGORIES_HD_REF = RIDECLOUD_CAPTURE_VARIANT_REFS[0];
const DETAILS_HD_REF = RIDECLOUD_CAPTURE_VARIANT_REFS[1];
const FOUNDER_HD_REF = RIDECLOUD_CAPTURE_VARIANT_REFS[2];
const TYPES_HD_REF = RIDECLOUD_CAPTURE_VARIANT_REFS[3];

const CROP_STATUS_BAR = "crop_device_status_bar";
const CROP_ANDROID_OVERLAY = "crop_android_system_overlay";
const CROP_SAFE_CENTER = "keep_center_safe_for_4_5_and_1_1";
const CROP_NO_PLAY_BADGE = "do_not_show_google_play_badge";
const CROP_NO_UNAPPROVED_UI_COPY = "do_not_promote_unapproved_ui_copy_as_overlay";

export const RIDECLOUD_FIRST_AD_SHOTS = [
  {
    id: "s01_hook",
    startSec: 0,
    endSec: 4,
    visualRef: LANDING_REF,
    visualRole: "landing_hook",
    motion: "slow_push_in",
    transitionOut: "dissolve",
    onScreenText: [RIDECLOUD_LOCKED_CLAIM],
    narration: RIDECLOUD_LOCKED_CLAIM,
    cropRules: [CROP_STATUS_BAR, CROP_ANDROID_OVERLAY, CROP_SAFE_CENTER],
  },
  {
    id: "s02_centralize",
    startSec: 4,
    endSec: 9,
    visualRef: CATEGORIES_HD_REF,
    visualRole: "garage_categories_preferred_1080",
    motion: "slow_push_in",
    transitionOut: "dissolve",
    onScreenText: [RIDECLOUD_LOCKED_SIGNATURE],
    narration: RIDECLOUD_LOCKED_SIGNATURE,
    cropRules: [CROP_STATUS_BAR, CROP_SAFE_CENTER, CROP_NO_UNAPPROVED_UI_COPY],
  },
  {
    id: "s03_anticipate",
    startSec: 9,
    endSec: 14,
    visualRef: DETAILS_HD_REF,
    visualRole: "vehicle_detail_deadline_preferred_1080",
    motion: "hold",
    transitionOut: "dissolve",
    onScreenText: [],
    narration: RIDECLOUD_LOCKED_FOLLOW_NARRATION,
    cropRules: [CROP_STATUS_BAR, CROP_SAFE_CENTER, CROP_NO_UNAPPROVED_UI_COPY],
  },
  {
    id: "s04_vehicle_types",
    startSec: 14,
    endSec: 18,
    visualRef: TYPES_HD_REF,
    visualRole: "multi_vehicle_types_preferred_1080",
    motion: "hold",
    transitionOut: "dissolve",
    onScreenText: [],
    narration: RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION,
    cropRules: [CROP_STATUS_BAR, CROP_SAFE_CENTER],
  },
  {
    id: "s05_cta",
    startSec: 18,
    endSec: 23,
    visualRef: FOUNDER_HD_REF,
    visualRole: "founder_program_visual_preferred_1080",
    motion: "slow_push_in",
    transitionOut: "dissolve",
    onScreenText: [RIDECLOUD_LOCKED_CTA_INVITE],
    narration: RIDECLOUD_LOCKED_CTA_INVITE,
    cropRules: [CROP_STATUS_BAR, CROP_SAFE_CENTER, CROP_NO_UNAPPROVED_UI_COPY],
  },
  {
    id: "s06_endcard",
    startSec: 23,
    endSec: 26,
    visualRef: RIDECLOUD_LOGO_REF,
    visualRole: "logo_endcard",
    motion: "hold",
    transitionOut: "cut",
    onScreenText: [RIDECLOUD_PRODUCT_NAME, RIDECLOUD_LOCKED_CTA_PREMIUM],
    narration: RIDECLOUD_LOCKED_CTA_PREMIUM,
    cropRules: [CROP_SAFE_CENTER, CROP_NO_PLAY_BADGE, "founder_program_terms_off_video"],
  },
] as const satisfies readonly RideCloudStoryboardShot[];

export function assertRideCloudOnScreenTextIsLocked(text: string): void {
  if (!(RIDECLOUD_ALLOWED_ON_SCREEN_TEXT as readonly string[]).includes(text)) {
    throw new Error("BLOCKED_RIDECLOUD_UNAPPROVED_ON_SCREEN_TEXT");
  }
}

export function rideCloudNarrationWordCount(text: string): number {
  return text
    .replace(/[«»":,.;!?]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function rideCloudNarrationWpm(text: string, windowSec: number): number {
  if (windowSec <= 0) throw new Error("BLOCKED_RIDECLOUD_NARRATION_WINDOW");
  return (rideCloudNarrationWordCount(text) / windowSec) * 60;
}

export function assertRideCloudNarrationFitsWindow(text: string, windowSec: number): void {
  const wpm = rideCloudNarrationWpm(text, windowSec);
  if (wpm > RIDECLOUD_NATURAL_FRENCH_WPM_MAX) {
    throw new Error("BLOCKED_RIDECLOUD_NARRATION_TOO_DENSE");
  }
}

export function assertRideCloudNarrationIsLocked(text: string | null): void {
  if (text === null) throw new Error("BLOCKED_RIDECLOUD_SILENT_SHOT");
  if (!(RIDECLOUD_ALLOWED_NARRATION as readonly string[]).includes(text)) {
    throw new Error("BLOCKED_RIDECLOUD_UNAPPROVED_NARRATION");
  }
}

export function assertRideCloudStoryboardAudioContinuity(
  shots: readonly RideCloudStoryboardShot[],
): void {
  for (const shot of shots) {
    assertRideCloudNarrationIsLocked(shot.narration);
    if (shot.narration) {
      assertRideCloudNarrationFitsWindow(shot.narration, shot.endSec - shot.startSec);
    }
    if (shot.onScreenText.includes(RIDECLOUD_LOCKED_CTA)) {
      throw new Error("BLOCKED_RIDECLOUD_FULL_CTA_TOO_DENSE");
    }
  }
}

export function assertRideCloudStoryboardTiming(shots: readonly RideCloudStoryboardShot[]): void {
  if (shots.length === 0) throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_EMPTY");
  if (shots[0]!.startSec !== 0) throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_TIMING");
  let cursor = 0;
  for (const shot of shots) {
    if (shot.startSec !== cursor) throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_TIMING");
    if (shot.endSec <= shot.startSec) throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_TIMING");
    cursor = shot.endSec;
  }
  if (cursor < RIDECLOUD_EXPECTED_CONSTRAINTS.durationWindowSec[0]) {
    throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_TOO_SHORT");
  }
  if (cursor > RIDECLOUD_EXPECTED_CONSTRAINTS.durationWindowSec[1]) {
    throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_TOO_LONG");
  }
}

export function assertRideCloudStoryboardVisuals(shots: readonly RideCloudStoryboardShot[]): void {
  const official = new Set<string>(rideCloudOfficialRefs());
  for (const shot of shots) {
    assertNotRideCloudDeliverable(shot.visualRef);
    assertRideCloudLocatorIsRedactedSafe(shot.visualRef);
    rideCloudRefIntegrityPrefix(shot.visualRef);
    if (!official.has(shot.visualRef)) {
      throw new Error("BLOCKED_RIDECLOUD_STORYBOARD_UNKNOWN_REF");
    }
    if (shot.visualRef === RIDECLOUD_BANNER_REF || shot.visualRef === RIDECLOUD_BANNER_VARIANT_REF) {
      throw new Error("BLOCKED_RIDECLOUD_BANNER_COPY_NOT_A_CLAIM");
    }
    for (const text of shot.onScreenText) assertRideCloudOnScreenTextIsLocked(text);
    assertRideCloudNarrationIsLocked(shot.narration);
  }
}

export function unusedOfficialRideCloudRefs(
  shots: readonly RideCloudStoryboardShot[],
): RideCloudOpaqueRef[] {
  const used = new Set(shots.map((shot) => shot.visualRef));
  return rideCloudOfficialRefs().filter((ref) => !used.has(ref));
}

export function buildRideCloudFirstAdStoryboard(): RideCloudFirstAdStoryboard {
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
  assertRideCloudStoryboardTiming(RIDECLOUD_FIRST_AD_SHOTS);
  assertRideCloudStoryboardVisuals(RIDECLOUD_FIRST_AD_SHOTS);
  assertRideCloudStoryboardAudioContinuity(RIDECLOUD_FIRST_AD_SHOTS);
  return {
    projectKey: RIDECLOUD_PROJECT_KEY,
    productName: RIDECLOUD_PRODUCT_NAME,
    durationSec: RIDECLOUD_STORYBOARD_DURATION_SEC,
    durationWindowSec: RIDECLOUD_EXPECTED_CONSTRAINTS.durationWindowSec,
    platforms: ["linkedin", "instagram"],
    masterAspectRatio: "9:16",
    derivedAspectRatios: ["4:5", "1:1"],
    language: "fr",
    voiceRole: "narrator_female",
    lipsync: false,
    music: false,
    concept: RIDECLOUD_FIRST_AD_CONCEPT,
    shots: RIDECLOUD_FIRST_AD_SHOTS,
    unusedOfficialRefs: unusedOfficialRideCloudRefs(RIDECLOUD_FIRST_AD_SHOTS),
    legalConstraints: RIDECLOUD_LOCKED_LEGAL,
    readinessVerdict: RIDECLOUD_STORYBOARD_VERDICT,
    nextAuth: RIDECLOUD_STORYBOARD_NEXT_AUTH,
  };
}

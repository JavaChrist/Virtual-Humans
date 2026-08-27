/**
 * RideCloud first-ad storyboard — no provider, no Git media, no Production write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RIDECLOUD_BANNER_VARIANT_REF,
  RIDECLOUD_CAPTURE_REFS,
  RIDECLOUD_CAPTURE_VARIANT_REFS,
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_CTA,
  RIDECLOUD_LOCKED_SIGNATURE,
  RIDECLOUD_LOGO_REF,
  RIDECLOUD_NEXT_AUTH_WHEN_READY,
} from "../ridecloud-input-preflight";
import {
  RIDECLOUD_ALLOWED_ON_SCREEN_TEXT,
  RIDECLOUD_FIRST_AD_SHOTS,
  RIDECLOUD_LOCKED_CTA_INVITE,
  RIDECLOUD_LOCKED_CTA_PREMIUM,
  RIDECLOUD_LOCKED_FOLLOW_NARRATION,
  RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION,
  RIDECLOUD_STORYBOARD_AUTH,
  RIDECLOUD_STORYBOARD_COPY_POLISH_AUTH,
  RIDECLOUD_STORYBOARD_DURATION_SEC,
  RIDECLOUD_STORYBOARD_HARDENING_AUTH,
  RIDECLOUD_STORYBOARD_NEXT_AUTH,
  RIDECLOUD_STORYBOARD_VERDICT,
  assertRideCloudNarrationFitsWindow,
  rideCloudNarrationWpm,
  assertRideCloudNarrationIsLocked,
  assertRideCloudOnScreenTextIsLocked,
  assertRideCloudStoryboardAudioContinuity,
  assertRideCloudStoryboardTiming,
  assertRideCloudStoryboardVisuals,
  buildRideCloudFirstAdStoryboard,
  unusedOfficialRideCloudRefs,
} from "../ridecloud-first-ad-storyboard-preflight";

test("RIDECLOUD-STORYBOARD — locked Auth and 26s window", () => {
  assert.equal(RIDECLOUD_STORYBOARD_AUTH, RIDECLOUD_NEXT_AUTH_WHEN_READY);
  assert.equal(RIDECLOUD_STORYBOARD_AUTH, "AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_PREFLIGHT_NO_PROVIDER");
  assert.equal(RIDECLOUD_STORYBOARD_DURATION_SEC, 26);
  assert.equal(
    RIDECLOUD_STORYBOARD_HARDENING_AUTH,
    "AUTH_RIDECLOUD_FIRST_AD_STORYBOARD_AUDIO_CONTINUITY_HARDENING_NO_PROVIDER",
  );
  assert.equal(
    RIDECLOUD_STORYBOARD_COPY_POLISH_AUTH,
    "AUTH_RIDECLOUD_STORYBOARD_VO_COPY_POLISH_AND_SYNC_NO_PROVIDER",
  );
  assert.equal(
    RIDECLOUD_STORYBOARD_NEXT_AUTH,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_CREATE_PREFLIGHT_NO_PROVIDER",
  );
});

test("RIDECLOUD-STORYBOARD — built plan is READY without provider work", () => {
  const board = buildRideCloudFirstAdStoryboard();
  assert.equal(board.readinessVerdict, RIDECLOUD_STORYBOARD_VERDICT);
  assert.equal(board.durationSec, 26);
  assert.deepEqual([...board.durationWindowSec], [20, 30]);
  assert.deepEqual([...board.platforms], ["linkedin", "instagram"]);
  assert.equal(board.masterAspectRatio, "9:16");
  assert.deepEqual([...board.derivedAspectRatios], ["4:5", "1:1"]);
  assert.equal(board.voiceRole, "narrator_female");
  assert.equal(board.lipsync, false);
  assert.equal(board.music, false);
  assert.equal(board.shots.length, 6);
  assert.equal(board.nextAuth, RIDECLOUD_STORYBOARD_NEXT_AUTH);
});

test("RIDECLOUD-STORYBOARD — prefers HD variants and keeps landing plus logo", () => {
  const board = buildRideCloudFirstAdStoryboard();
  const refs = board.shots.map((shot) => shot.visualRef);
  assert.equal(refs[0], RIDECLOUD_CAPTURE_REFS[0]);
  assert.equal(refs[1], RIDECLOUD_CAPTURE_VARIANT_REFS[0]);
  assert.equal(refs[2], RIDECLOUD_CAPTURE_VARIANT_REFS[1]);
  assert.equal(refs[3], RIDECLOUD_CAPTURE_VARIANT_REFS[3]);
  assert.equal(refs[4], RIDECLOUD_CAPTURE_VARIANT_REFS[2]);
  assert.equal(refs[5], RIDECLOUD_LOGO_REF);
  assert.equal(refs.includes(RIDECLOUD_BANNER_VARIANT_REF), false);
});

test("RIDECLOUD-STORYBOARD — on-screen and VO stay inside locked copy", () => {
  const board = buildRideCloudFirstAdStoryboard();
  const spoken = board.shots.map((shot) => shot.narration);
  assert.deepEqual(spoken, [
    RIDECLOUD_LOCKED_CLAIM,
    RIDECLOUD_LOCKED_SIGNATURE,
    RIDECLOUD_LOCKED_FOLLOW_NARRATION,
    RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION,
    RIDECLOUD_LOCKED_CTA_INVITE,
    RIDECLOUD_LOCKED_CTA_PREMIUM,
  ]);
  for (const shot of board.shots) {
    for (const text of shot.onScreenText) {
      assert.equal((RIDECLOUD_ALLOWED_ON_SCREEN_TEXT as readonly string[]).includes(text), true);
      assert.equal(text === RIDECLOUD_LOCKED_CTA, false);
    }
  }
  assert.throws(() => assertRideCloudOnScreenTextIsLocked("L’entretien automobile simplifié"), /UNAPPROVED/);
  assert.throws(() => assertRideCloudNarrationIsLocked("Premium à vie sans conditions"), /UNAPPROVED/);
  assert.throws(() => assertRideCloudOnScreenTextIsLocked(RIDECLOUD_LOCKED_CTA), /UNAPPROVED/);
});

test("RIDECLOUD-STORYBOARD — every shot has VO and the full CTA stays off-screen", () => {
  assertRideCloudStoryboardAudioContinuity(RIDECLOUD_FIRST_AD_SHOTS);
  assert.equal(RIDECLOUD_FIRST_AD_SHOTS.every((shot) => shot.narration !== null), true);
  assert.equal(RIDECLOUD_FIRST_AD_SHOTS[5]!.onScreenText.includes(RIDECLOUD_LOCKED_CTA_PREMIUM), true);
  assert.equal(RIDECLOUD_FIRST_AD_SHOTS[5]!.cropRules.includes("founder_program_terms_off_video"), true);
  const silent = [{ ...RIDECLOUD_FIRST_AD_SHOTS[2], narration: null }];
  assert.throws(() => assertRideCloudStoryboardAudioContinuity(silent), /SILENT_SHOT/);
});

test("RIDECLOUD-STORYBOARD — timing is contiguous and crop rules stay fail-closed", () => {
  assertRideCloudStoryboardTiming(RIDECLOUD_FIRST_AD_SHOTS);
  assertRideCloudStoryboardVisuals(RIDECLOUD_FIRST_AD_SHOTS);
  assert.equal(RIDECLOUD_FIRST_AD_SHOTS[0]!.cropRules.includes("crop_android_system_overlay"), true);
  assert.equal(RIDECLOUD_FIRST_AD_SHOTS[5]!.cropRules.includes("do_not_show_google_play_badge"), true);
  const broken = [{ ...RIDECLOUD_FIRST_AD_SHOTS[0], startSec: 1, endSec: 4 }];
  assert.throws(() => assertRideCloudStoryboardTiming(broken), /TIMING/);
});

test("RIDECLOUD-STORYBOARD — polished s03/s04 lines fit their windows", () => {
  assert.equal(
    RIDECLOUD_LOCKED_FOLLOW_NARRATION,
    "Suivez vos entretiens, vos échéances et vos documents en un seul endroit.",
  );
  assert.equal(
    RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION,
    "Voiture, moto, scooter ou utilitaire : tout votre garage est réuni.",
  );
  const s03Wpm = rideCloudNarrationWpm(RIDECLOUD_LOCKED_FOLLOW_NARRATION, 5);
  const s04Wpm = rideCloudNarrationWpm(RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION, 4);
  assert.equal(s03Wpm <= 165, true);
  assert.equal(s04Wpm <= 165, true);
  assertRideCloudNarrationFitsWindow(RIDECLOUD_LOCKED_FOLLOW_NARRATION, 5);
  assertRideCloudNarrationFitsWindow(RIDECLOUD_LOCKED_VEHICLE_TYPES_NARRATION, 4);
  assert.throws(
    () => assertRideCloudNarrationFitsWindow("a b c d e f g h i j k l m n o p q r s t u", 2),
    /TOO_DENSE/,
  );
});

test("RIDECLOUD-STORYBOARD — unused official refs stay documented and unused banners stay out", () => {
  const unused = unusedOfficialRideCloudRefs(RIDECLOUD_FIRST_AD_SHOTS);
  assert.equal(unused.includes(RIDECLOUD_BANNER_VARIANT_REF), true);
  assert.equal(unused.includes(RIDECLOUD_CAPTURE_REFS[1]), true);
  assert.equal(unused.includes(RIDECLOUD_LOGO_REF), false);
});

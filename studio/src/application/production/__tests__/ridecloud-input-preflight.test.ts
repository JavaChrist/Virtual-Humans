/**
 * RideCloud input preflight — no provider, no Git media, no Production write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_11C_NEXT_AUTH } from "../phase-11c-close-and-next-gate-audit";
import {
  RIDECLOUD_ALWAYS_REQUIRED_KEYS,
  RIDECLOUD_BANNER_REF,
  RIDECLOUD_CAPTURE_REFS,
  RIDECLOUD_CURRENT_INVENTORY,
  RIDECLOUD_EXPECTED_CONSTRAINTS,
  RIDECLOUD_FIRST_AD_CONCEPT,
  RIDECLOUD_INPUT_PREFLIGHT_AUTH,
  RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED,
  RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY,
  RIDECLOUD_LOCKED_CLAIM,
  RIDECLOUD_LOCKED_CTA,
  RIDECLOUD_LOGO_REF,
  RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED,
  RIDECLOUD_NEXT_AUTH_WHEN_READY,
  RIDECLOUD_OBSERVED_INVENTORY,
  RIDECLOUD_PRODUCT_NAME,
  RIDECLOUD_PROJECT_KEY,
  RIDECLOUD_REJECTED_UNSAFE_SOURCES,
  RIDECLOUD_SUPPLY_AUTH,
  assertNotRideCloudDeliverable,
  assertRideCloudLocatorIsRedactedSafe,
  assertRideCloudNoSideEffects,
  buildRideCloudCurrentManifest,
  buildRideCloudObservedManifest,
  chooseRideCloudNextAuth,
  evaluateRideCloudInputReadiness,
  missingRequiredRideCloudInputs,
  rideCloudRefIntegrityPrefix,
  type RideCloudInputKey,
  type RideCloudInputStatus,
} from "../ridecloud-input-preflight";

function allVerified(): Record<RideCloudInputKey, RideCloudInputStatus> {
  const inventory = { ...RIDECLOUD_OBSERVED_INVENTORY } as Record<
    RideCloudInputKey,
    RideCloudInputStatus
  >;
  for (const key of Object.keys(inventory) as RideCloudInputKey[]) {
    inventory[key] = "AVAILABLE_VERIFIED";
  }
  return inventory;
}

test("RIDECLOUD-PREFLIGHT — 157 empty snapshot stays blocked", () => {
  assert.equal(
    RIDECLOUD_INPUT_PREFLIGHT_AUTH,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT_NO_PROVIDER",
  );
  assert.equal(RIDECLOUD_INPUT_PREFLIGHT_AUTH, PHASE_11C_NEXT_AUTH);
  assert.equal(RIDECLOUD_SUPPLY_AUTH, RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED);
  assert.equal(RIDECLOUD_PROJECT_KEY, "ridecloud-promo-separate-v1");
  assert.equal(RIDECLOUD_PRODUCT_NAME, "RideCloud");
  const manifest = buildRideCloudObservedManifest();
  assert.equal(manifest.readinessVerdict, RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED);
  assert.equal(manifest.CTA, null);
  assert.deepEqual(missingRequiredRideCloudInputs(RIDECLOUD_OBSERVED_INVENTORY), [
    "productBrief",
    "campaignGoal",
    "logoBrand",
    "approvedClaims",
    "valueProposition",
    "cta",
    "durationFormats",
    "language",
    "voiceRole",
    "legalConstraints",
    "musicRights",
    "screenshots",
    "screenRecordings",
  ]);
});

test("RIDECLOUD-PREFLIGHT — supplied pack is READY without music or recordings", () => {
  assert.equal(RIDECLOUD_CURRENT_INVENTORY.musicRights, "OPTIONAL");
  assert.equal(RIDECLOUD_CURRENT_INVENTORY.screenRecordings, "OPTIONAL");
  assert.equal(RIDECLOUD_CURRENT_INVENTORY.screenshots, "AVAILABLE_VERIFIED");
  assert.equal(
    evaluateRideCloudInputReadiness(RIDECLOUD_CURRENT_INVENTORY),
    RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY,
  );
  assert.deepEqual(missingRequiredRideCloudInputs(RIDECLOUD_CURRENT_INVENTORY), []);
  const manifest = buildRideCloudCurrentManifest();
  assert.equal(manifest.readinessVerdict, RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY);
  assert.equal(manifest.language, "fr");
  assert.equal(manifest.voiceRole, "narrator_female");
  assert.equal(manifest.targetDuration, "20-30s");
  assert.equal(manifest.CTA, RIDECLOUD_LOCKED_CTA);
  assert.equal(manifest.approvedClaims.includes(RIDECLOUD_LOCKED_CLAIM), true);
  assert.equal(manifest.captureReferences.length, 10);
  assert.equal(manifest.brandAssetReferences.includes(RIDECLOUD_LOGO_REF), true);
  assert.equal(manifest.brandAssetReferences.includes(RIDECLOUD_BANNER_REF), true);
  assert.equal(manifest.recordingReferences.length, 0);
  assert.equal(manifest.missingRequiredInputs.length, 0);
});

test("RIDECLOUD-PREFLIGHT — READY only when every required input is verified", () => {
  assert.equal(evaluateRideCloudInputReadiness(allVerified()), RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY);
  assert.deepEqual(missingRequiredRideCloudInputs(allVerified()), []);
});

test("RIDECLOUD-PREFLIGHT — unverified campaignGoal stays blocked", () => {
  const inventory = allVerified();
  inventory.campaignGoal = "AVAILABLE_UNVERIFIED";
  assert.equal(evaluateRideCloudInputReadiness(inventory), RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED);
  assert.deepEqual(missingRequiredRideCloudInputs(inventory), ["campaignGoal"]);
});

test("RIDECLOUD-PREFLIGHT — screenshots or recordings can satisfy the visual source", () => {
  const withShots = allVerified();
  withShots.screenRecordings = "MISSING_REQUIRED";
  assert.equal(evaluateRideCloudInputReadiness(withShots), RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY);
  const withRecs = allVerified();
  withRecs.screenshots = "MISSING_REQUIRED";
  assert.equal(evaluateRideCloudInputReadiness(withRecs), RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY);
  const neither = allVerified();
  neither.screenshots = "MISSING_REQUIRED";
  neither.screenRecordings = "MISSING_REQUIRED";
  assert.equal(evaluateRideCloudInputReadiness(neither), RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED);
  assert.deepEqual(missingRequiredRideCloudInputs(neither), ["screenshots", "screenRecordings"]);
});

test("RIDECLOUD-PREFLIGHT — waived music is OPTIONAL and does not block", () => {
  const inventory = allVerified();
  inventory.musicRights = "OPTIONAL";
  assert.equal(evaluateRideCloudInputReadiness(inventory), RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY);
  inventory.musicRights = "MISSING_REQUIRED";
  assert.equal(evaluateRideCloudInputReadiness(inventory), RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED);
});

test("RIDECLOUD-PREFLIGHT — 11A/11B/11C and SDK memory are not deliverables", () => {
  for (const source of RIDECLOUD_REJECTED_UNSAFE_SOURCES) {
    assert.throws(() => assertNotRideCloudDeliverable(source), /NOT_DELIVERABLE/);
    assertRideCloudLocatorIsRedactedSafe(source);
  }
  assert.throws(
    () => assertRideCloudLocatorIsRedactedSafe("C:\\\\Users\\\\secret\\\\ridecloud.mp4"),
    /SENSITIVE_LOCATOR/,
  );
  assert.throws(
    () => assertRideCloudLocatorIsRedactedSafe("https://example.com/file?token=supersecrettokenvalue"),
    /SENSITIVE_LOCATOR/,
  );
});

test("RIDECLOUD-PREFLIGHT — opaque refs expose prefixes only", () => {
  for (const ref of [RIDECLOUD_LOGO_REF, RIDECLOUD_BANNER_REF, ...RIDECLOUD_CAPTURE_REFS]) {
    assertRideCloudLocatorIsRedactedSafe(ref);
    const prefix = rideCloudRefIntegrityPrefix(ref);
    assert.equal(prefix.length, 12);
    assert.equal(ref.includes("C:"), false);
    assert.equal(/[0-9a-f]{64}/.test(ref), false);
  }
  assert.equal(RIDECLOUD_CAPTURE_REFS.length, 10);
});

test("RIDECLOUD-PREFLIGHT — no side effects and next Auth follows verdict", () => {
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
  assert.equal(
    chooseRideCloudNextAuth(RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED),
    RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED,
  );
  assert.equal(
    chooseRideCloudNextAuth(RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY),
    RIDECLOUD_NEXT_AUTH_WHEN_READY,
  );
});

test("RIDECLOUD-PREFLIGHT — first-ad concept stays lipsync-free and silent until license", () => {
  assert.match(RIDECLOUD_FIRST_AD_CONCEPT, /narrator_female/);
  assert.match(RIDECLOUD_FIRST_AD_CONCEPT, /no_music/);
  assert.equal(RIDECLOUD_FIRST_AD_CONCEPT.includes("lipsync"), false);
  assert.equal(RIDECLOUD_EXPECTED_CONSTRAINTS.voice.lipsync, false);
  assert.equal(RIDECLOUD_EXPECTED_CONSTRAINTS.music.licenseProof, "waived_until_license");
  assert.equal(RIDECLOUD_ALWAYS_REQUIRED_KEYS.includes("productBrief"), true);
});

/**
 * RideCloud input preflight — no provider, no media, no Production write.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_11C_NEXT_AUTH } from "../phase-11c-close-and-next-gate-audit";
import {
  RIDECLOUD_ALWAYS_REQUIRED_KEYS,
  RIDECLOUD_EXPECTED_CONSTRAINTS,
  RIDECLOUD_FIRST_AD_CONCEPT,
  RIDECLOUD_INPUT_PREFLIGHT_AUTH,
  RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED,
  RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY,
  RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED,
  RIDECLOUD_OBSERVED_INVENTORY,
  RIDECLOUD_PRODUCT_NAME,
  RIDECLOUD_PROJECT_KEY,
  RIDECLOUD_REJECTED_UNSAFE_SOURCES,
  assertNotRideCloudDeliverable,
  assertRideCloudLocatorIsRedactedSafe,
  assertRideCloudNoSideEffects,
  buildRideCloudObservedManifest,
  chooseRideCloudNextAuth,
  evaluateRideCloudInputReadiness,
  missingRequiredRideCloudInputs,
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

test("RIDECLOUD-PREFLIGHT — auth matches 11C next and observed is blocked", () => {
  assert.equal(
    RIDECLOUD_INPUT_PREFLIGHT_AUTH,
    "AUTH_RIDECLOUD_SEPARATE_PROJECT_INPUT_COLLECTION_PREFLIGHT_NO_PROVIDER",
  );
  assert.equal(RIDECLOUD_INPUT_PREFLIGHT_AUTH, PHASE_11C_NEXT_AUTH);
  assert.equal(RIDECLOUD_PROJECT_KEY, "ridecloud-promo-separate-v1");
  assert.equal(RIDECLOUD_PRODUCT_NAME, "RideCloud");
  const manifest = buildRideCloudObservedManifest();
  assert.equal(manifest.readinessVerdict, RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED);
  assert.equal(manifest.campaignGoal, null);
  assert.equal(manifest.CTA, null);
  assert.equal(manifest.approvedClaims.length, 0);
  assert.equal(manifest.brandAssetReferences.length, 0);
  assert.equal(manifest.captureReferences.length, 0);
  assert.equal(manifest.recordingReferences.length, 0);
  assert.ok(manifest.missingRequiredInputs.includes("productBrief"));
  assert.ok(manifest.missingRequiredInputs.includes("screenshots"));
  assert.ok(manifest.missingRequiredInputs.includes("cta"));
  assert.equal(RIDECLOUD_OBSERVED_INVENTORY.audience, "AVAILABLE_VERIFIED");
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

test("RIDECLOUD-PREFLIGHT — no side effects and blocked next Auth", () => {
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
  assert.throws(
    () =>
      assertRideCloudNoSideEffects({
        providerCalls: 1,
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
      }),
    /SIDE_EFFECT/,
  );
  assert.equal(
    chooseRideCloudNextAuth(RIDECLOUD_INPUT_PREFLIGHT_VERDICT_BLOCKED),
    RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED,
  );
  assert.throws(
    () => chooseRideCloudNextAuth(RIDECLOUD_INPUT_PREFLIGHT_VERDICT_READY),
    /NOT_FOR_READY/,
  );
});

test("RIDECLOUD-PREFLIGHT — first-ad concept stays lipsync-free and constraints are explicit", () => {
  assert.match(RIDECLOUD_FIRST_AD_CONCEPT, /narrator_female/);
  assert.match(RIDECLOUD_FIRST_AD_CONCEPT, /private_export/);
  assert.equal(RIDECLOUD_FIRST_AD_CONCEPT.includes("lipsync"), false);
  assert.equal(RIDECLOUD_EXPECTED_CONSTRAINTS.voice.lipsync, false);
  assert.equal(RIDECLOUD_EXPECTED_CONSTRAINTS.voice.recommendedRole, "narrator_female");
  assert.equal(RIDECLOUD_ALWAYS_REQUIRED_KEYS.includes("productBrief"), true);
});

test("RIDECLOUD-PREFLIGHT — observed missing list is exact and deterministic", () => {
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
    "musicRights",
    "legalConstraints",
    "screenshots",
    "screenRecordings",
  ]);
});

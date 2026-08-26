#!/usr/bin/env node
/**
 * RideCloud input preflight — local contract only.
 * No provider, no Storage, no Supabase, no media I/O.
 */
import {
  RIDECLOUD_FIRST_AD_CONCEPT,
  RIDECLOUD_INPUT_PREFLIGHT_AUTH,
  RIDECLOUD_NEXT_AUTH_WHEN_BLOCKED,
  RIDECLOUD_REJECTED_UNSAFE_SOURCES,
  assertRideCloudNoSideEffects,
  buildRideCloudObservedManifest,
  buildRideCloudObservedRecords,
  chooseRideCloudNextAuth,
} from "@/application/production/ridecloud-input-preflight";

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

const manifest = buildRideCloudObservedManifest();
const nextAuth = chooseRideCloudNextAuth(manifest.readinessVerdict);

console.log(
  JSON.stringify(
    {
      auth: RIDECLOUD_INPUT_PREFLIGHT_AUTH,
      ok: true,
      verdict: manifest.readinessVerdict,
      nextAuth,
      firstAdConcept: RIDECLOUD_FIRST_AD_CONCEPT,
      rejectedUnsafe: RIDECLOUD_REJECTED_UNSAFE_SOURCES,
      inventory: buildRideCloudObservedRecords().map((row) => ({
        key: row.key,
        status: row.status,
      })),
      missingRequiredInputs: manifest.missingRequiredInputs,
      manifest,
    },
    null,
    2,
  ),
);

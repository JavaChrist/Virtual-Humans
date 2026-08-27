#!/usr/bin/env node
/**
 * RideCloud input preflight — local contract only.
 * No provider, no Storage, no Supabase, no Git media write.
 */
import {
  RIDECLOUD_FIRST_AD_CONCEPT,
  RIDECLOUD_HIGH_RES_ADDENDUM_AUTH,
  RIDECLOUD_INPUT_PREFLIGHT_AUTH,
  RIDECLOUD_SUPPLY_AUTH,
  assertRideCloudNoSideEffects,
  buildRideCloudCurrentManifest,
  buildRideCloudCurrentRecords,
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

const manifest = buildRideCloudCurrentManifest();
const nextAuth = chooseRideCloudNextAuth(manifest.readinessVerdict);

console.log(
  JSON.stringify(
    {
      collectionAuth: RIDECLOUD_INPUT_PREFLIGHT_AUTH,
      supplyAuth: RIDECLOUD_SUPPLY_AUTH,
      highResAddendumAuth: RIDECLOUD_HIGH_RES_ADDENDUM_AUTH,
      ok: true,
      verdict: manifest.readinessVerdict,
      nextAuth,
      firstAdConcept: RIDECLOUD_FIRST_AD_CONCEPT,
      inventory: buildRideCloudCurrentRecords().map((row) => ({
        key: row.key,
        status: row.status,
      })),
      missingRequiredInputs: manifest.missingRequiredInputs,
      captureCount: manifest.captureReferences.length,
      captureVariantCount: manifest.captureVariantReferences.length,
      brandRefCount: manifest.brandAssetReferences.length,
      brandVariantCount: manifest.brandVariantReferences.length,
      manifest,
    },
    null,
    2,
  ),
);

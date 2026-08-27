#!/usr/bin/env node
/**
 * RideCloud separate project create preflight — local contract only.
 * No provider, Storage, Supabase, or Git media write.
 */
import { buildRideCloudSeparateProjectCreatePreflight } from "@/application/production/ridecloud-separate-project-create-preflight";

const plan = buildRideCloudSeparateProjectCreatePreflight();

console.log(
  JSON.stringify(
    {
      ok: true,
      auth: plan.auth,
      verdict: plan.verdict,
      nextAuth: plan.nextAuth,
      identity: plan.identity,
      isolation: plan.isolation,
      duplicate: plan.duplicate,
      futureWrite: plan.futureWrite,
      runtime: plan.runtime,
      budget: plan.budget,
      counters: plan.counters,
    },
    null,
    2,
  ),
);

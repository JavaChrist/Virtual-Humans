#!/usr/bin/env node
/**
 * RideCloud bind kind schema preflight — local contract only.
 * Does not apply the migration remotely.
 */
import { buildRideCloudBindKindSchemaPreflight } from "@/application/production/ridecloud-bind-kind-schema-preflight";

const plan = buildRideCloudBindKindSchemaPreflight();
console.log(JSON.stringify({ ok: true, ...plan }, null, 2));

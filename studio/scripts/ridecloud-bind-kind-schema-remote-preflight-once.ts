#!/usr/bin/env node
/**
 * RideCloud bind kind schema remote preflight — recorded read-only facts.
 * Does not apply the migration.
 */
import { buildRideCloudBindKindSchemaRemotePreflight } from "@/application/production/ridecloud-bind-kind-schema-remote-preflight";

const plan = buildRideCloudBindKindSchemaRemotePreflight();
console.log(JSON.stringify({ ok: true, ...plan }, null, 2));

#!/usr/bin/env node
/**
 * RideCloud storyboard/pack bind preflight — local contract only.
 * No provider, Storage, Supabase write, or Git media.
 */
import { buildRideCloudSeparateProjectBindPreflight } from "@/application/production/ridecloud-separate-project-bind-preflight";

const plan = buildRideCloudSeparateProjectBindPreflight();

console.log(JSON.stringify({ ok: true, ...plan }, null, 2));

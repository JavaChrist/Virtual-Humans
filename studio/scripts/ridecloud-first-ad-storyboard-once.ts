#!/usr/bin/env node
/**
 * RideCloud first-ad storyboard — local contract only.
 * No provider, no Storage, no Supabase, no Git media write.
 */
import { buildRideCloudFirstAdStoryboard } from "@/application/production/ridecloud-first-ad-storyboard-preflight";

const board = buildRideCloudFirstAdStoryboard();

console.log(
  JSON.stringify(
    {
      ok: true,
      verdict: board.readinessVerdict,
      durationSec: board.durationSec,
      shotCount: board.shots.length,
      nextAuth: board.nextAuth,
      lipsync: board.lipsync,
      music: board.music,
      shots: board.shots.map((shot) => ({
        id: shot.id,
        startSec: shot.startSec,
        endSec: shot.endSec,
        visualRef: shot.visualRef,
        visualRole: shot.visualRole,
      })),
    },
    null,
    2,
  ),
);

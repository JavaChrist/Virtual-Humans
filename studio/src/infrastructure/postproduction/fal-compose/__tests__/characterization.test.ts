/**
 * Characterization tests — historical /api/generate/merge payload behavior.
 * Expectations come from the pre-extraction route logic, not an ideal future.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFalComposePayload,
  falComposePayloadDurationSeconds,
  resolveHistoricalComposeDurations,
} from "../payload";

/** Inline replica of the historical mapping (pre-helper) for A/B equality. */
function historicalBuild(input: {
  videoUrls: string[];
  durationsSec: number[];
  preserveAudio: boolean;
}) {
  let tMs = 0;
  const keyframes = input.videoUrls.map((url, i) => {
    const durationMs = Math.max(500, Math.round(input.durationsSec[i]! * 1000));
    const kf = { url, timestamp: tMs, duration: durationMs };
    tMs += durationMs;
    return kf;
  });
  const tracks: { id: string; type: string; keyframes: typeof keyframes }[] = [
    { id: "video", type: "video", keyframes },
  ];
  if (input.preserveAudio) {
    tracks.push({
      id: "audio",
      type: "audio",
      keyframes: keyframes.map((k) => ({ ...k })),
    });
  }
  return { tracks, tMs };
}

test("caractérisation — deux vidéos + preserveAudio défaut (true)", () => {
  const urls = ["https://a.example/1.mp4", "https://a.example/2.mp4"];
  const durations = resolveHistoricalComposeDurations({
    clipCount: 2,
    durationsIn: [5, 5],
    totalSeconds: 10,
  });
  assert.deepEqual(durations, [5, 5]);
  const hist = historicalBuild({ videoUrls: urls, durationsSec: durations, preserveAudio: true });
  const next = buildFalComposePayload({
    clips: urls.map((sourceUrl, i) => ({ sourceUrl, durationSeconds: durations[i]! })),
    preserveEmbeddedAudio: true,
  });
  assert.deepEqual(next.tracks, hist.tracks);
  assert.equal(next.tracks.length, 2);
  assert.equal(next.tracks[0]!.id, "video");
  assert.equal(next.tracks[1]!.id, "audio");
});

test("caractérisation — plusieurs vidéos + timestamps cumulés", () => {
  const urls = ["u1", "u2", "u3"];
  const durations = [2, 3, 4];
  const hist = historicalBuild({ videoUrls: urls, durationsSec: durations, preserveAudio: true });
  const next = buildFalComposePayload({
    clips: urls.map((sourceUrl, i) => ({ sourceUrl, durationSeconds: durations[i]! })),
    preserveEmbeddedAudio: true,
  });
  assert.deepEqual(next.tracks[0]!.keyframes.map((k) => k.timestamp), [0, 2000, 5000]);
  assert.deepEqual(next.tracks[0]!.keyframes.map((k) => k.duration), [2000, 3000, 4000]);
  assert.deepEqual(next, { tracks: hist.tracks });
});

test("caractérisation — durations explicites vs totalSeconds sans durations", () => {
  const explicit = resolveHistoricalComposeDurations({
    clipCount: 2,
    durationsIn: [1.5, 2.5],
    totalSeconds: 99,
  });
  assert.deepEqual(explicit, [1.5, 2.5]);

  const fallback = resolveHistoricalComposeDurations({
    clipCount: 2,
    durationsIn: [],
    totalSeconds: 10,
  });
  assert.deepEqual(fallback, [5, 5]);

  const zeroTotal = resolveHistoricalComposeDurations({
    clipCount: 2,
    durationsIn: [],
    totalSeconds: 0,
  });
  // max(1, 0/2) = 1
  assert.deepEqual(zeroTotal, [1, 1]);
});

test("caractérisation — durée invalide → fallback ; minimum 500ms", () => {
  const d = resolveHistoricalComposeDurations({
    clipCount: 2,
    durationsIn: [NaN, -1],
    totalSeconds: 8,
  });
  assert.deepEqual(d, [4, 4]);
  const payload = buildFalComposePayload({
    clips: [
      { sourceUrl: "a", durationSeconds: 0.1 },
      { sourceUrl: "b", durationSeconds: 0.2 },
    ],
    preserveEmbeddedAudio: false,
  });
  // max(500, round(100)) = 500 ; max(500, round(200)) = 500
  assert.deepEqual(
    payload.tracks[0]!.keyframes.map((k) => k.duration),
    [500, 500]
  );
});

test("caractérisation — preserveAudio false / true / décimales", () => {
  const clips = [
    { sourceUrl: "https://x/a.mp4", durationSeconds: 1.234 },
    { sourceUrl: "https://x/b.mp4", durationSeconds: 2.5 },
  ];
  const off = buildFalComposePayload({ clips, preserveEmbeddedAudio: false });
  assert.equal(off.tracks.length, 1);
  assert.equal(off.tracks[0]!.keyframes[0]!.duration, Math.max(500, Math.round(1.234 * 1000)));

  const on = buildFalComposePayload({ clips, preserveEmbeddedAudio: true });
  assert.equal(on.tracks.length, 2);
  assert.deepEqual(on.tracks[1]!.keyframes, on.tracks[0]!.keyframes.map((k) => ({ ...k })));
});

test("caractérisation — ordre des pistes et durée totale estimate", () => {
  const payload = buildFalComposePayload({
    clips: [
      { sourceUrl: "a", durationSeconds: 5 },
      { sourceUrl: "b", durationSeconds: 5 },
    ],
    preserveEmbeddedAudio: true,
  });
  assert.deepEqual(
    payload.tracks.map((t) => t.type),
    ["video", "audio"]
  );
  assert.equal(falComposePayloadDurationSeconds(payload), 10);
});

test("caractérisation — entrée non mutée + déterminisme", () => {
  const clips = [
    { sourceUrl: "a", durationSeconds: 3 },
    { sourceUrl: "b", durationSeconds: 4 },
  ];
  const snap = JSON.stringify(clips);
  const a = buildFalComposePayload({ clips, preserveEmbeddedAudio: true });
  const b = buildFalComposePayload({ clips, preserveEmbeddedAudio: true });
  assert.equal(JSON.stringify(clips), snap);
  assert.deepEqual(a, b);
});

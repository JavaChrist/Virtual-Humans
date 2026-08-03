/**
 * Pure fal-ai/ffmpeg-api/compose payload builder (VHS-111B).
 * Characterizes historical /api/generate/merge mapping — no I/O, no env.
 */

export type FalComposeClip = {
  sourceUrl: string;
  durationSeconds: number;
};

export type FalComposeInput = {
  clips: FalComposeClip[];
  preserveEmbeddedAudio: boolean;
};

export type FalComposeKeyframe = {
  url: string;
  /** Milliseconds from timeline start (historical). */
  timestamp: number;
  /** Duration in milliseconds (historical). */
  duration: number;
};

export type FalComposeTrack = {
  id: string;
  type: "video" | "audio";
  keyframes: FalComposeKeyframe[];
};

export type FalComposePayload = {
  tracks: FalComposeTrack[];
};

/**
 * Historical duration resolution from the merge route:
 * - fallbackSec = max(1, totalSeconds / n)
 * - per index: finite & > 0 duration wins, else fallback
 */
export function resolveHistoricalComposeDurations(input: {
  clipCount: number;
  durationsIn: number[];
  totalSeconds: number;
}): number[] {
  const n = input.clipCount;
  const fallbackSec = Math.max(1, input.totalSeconds / n);
  return Array.from({ length: n }, (_, i) => {
    const d = input.durationsIn[i];
    return Number.isFinite(d) && d! > 0 ? d! : fallbackSec;
  });
}

/**
 * Exact historical keyframe mapping:
 * durationMs = max(500, round(durationSeconds * 1000))
 * timestamps accumulate in ms.
 */
export function buildFalComposePayload(input: FalComposeInput): FalComposePayload {
  let tMs = 0;
  const keyframes: FalComposeKeyframe[] = input.clips.map((clip) => {
    const durationMs = Math.max(500, Math.round(clip.durationSeconds * 1000));
    const kf: FalComposeKeyframe = {
      url: clip.sourceUrl,
      timestamp: tMs,
      duration: durationMs,
    };
    tMs += durationMs;
    return kf;
  });

  const tracks: FalComposeTrack[] = [
    { id: "video", type: "video", keyframes },
  ];
  if (input.preserveEmbeddedAudio) {
    tracks.push({
      id: "audio",
      type: "audio",
      keyframes: keyframes.map((k) => ({ ...k })),
    });
  }

  return { tracks };
}

/** Total timeline seconds from built payload (ms sum / 1000) — used by estimateMerge fallback. */
export function falComposePayloadDurationSeconds(payload: FalComposePayload): number {
  const video = payload.tracks.find((t) => t.type === "video");
  if (!video) return 0;
  const last = video.keyframes[video.keyframes.length - 1];
  if (!last) return 0;
  return (last.timestamp + last.duration) / 1000;
}

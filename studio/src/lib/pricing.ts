/**
 * Approximate provider pricing used for pre-generation budget estimates.
 *
 * These are indicative public prices (USD) and can drift over time or depend on
 * your plan / region. Override any value with the matching environment variable.
 * Always confirm real costs on the provider's pricing page.
 */

function num(env: string | undefined, fallback: number): number {
  const n = env ? Number(env) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Image — OpenAI gpt-image-1 (USD per generated image, by size + quality)
// ---------------------------------------------------------------------------
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
export type ImageQuality = "low" | "medium" | "high";

export const IMAGE_SIZES: ImageSize[] = ["1024x1024", "1024x1536", "1536x1024"];
export const IMAGE_QUALITIES: ImageQuality[] = ["low", "medium", "high"];

const IMAGE_PRICE: Record<ImageSize, Record<ImageQuality, number>> = {
  "1024x1024": { low: 0.011, medium: 0.042, high: 0.167 },
  "1024x1536": { low: 0.016, medium: 0.063, high: 0.25 },
  "1536x1024": { low: 0.016, medium: 0.063, high: 0.25 },
};

export function estimateImage(size: ImageSize, quality: ImageQuality, n = 1): number {
  const unit = IMAGE_PRICE[size]?.[quality] ?? 0.042;
  return +(unit * Math.max(1, n)).toFixed(4);
}

// ---------------------------------------------------------------------------
// Voice — ElevenLabs TTS (billed in credits ~= characters; USD is plan-based)
// ---------------------------------------------------------------------------
export const ELEVENLABS_USD_PER_1K_CHARS = num(process.env.ELEVENLABS_USD_PER_1K_CHARS, 0.15);

export function estimateVoice(chars: number): { credits: number; usd: number } {
  const credits = Math.max(0, Math.round(chars));
  return { credits, usd: +((credits / 1000) * ELEVENLABS_USD_PER_1K_CHARS).toFixed(4) };
}

// ---------------------------------------------------------------------------
// Video — fal.ai models (USD per second, indicative)
// ---------------------------------------------------------------------------
export interface VideoModel {
  id: string; // fal model id
  label: string;
  engine: string; // maps to the SDK video engine docs
  mode: "text-to-video" | "image-to-video";
  audio: "native" | "silent";
  usdPerSecond: number;
  defaultSeconds: number;
  seconds: number[];
}

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: "fal-ai/veo3/fast",
    label: "Veo 3 Fast — voix + lèvres natives",
    engine: "veo",
    mode: "text-to-video",
    audio: "native",
    usdPerSecond: num(process.env.FAL_VEO_USD_PER_SEC, 0.4),
    defaultSeconds: 8,
    seconds: [8],
  },
  {
    id: "fal-ai/runway-gen3/turbo/image-to-video",
    label: "Runway Gen-3 Turbo (image→vidéo)",
    engine: "runway",
    mode: "image-to-video",
    audio: "silent",
    usdPerSecond: num(process.env.FAL_RUNWAY_USD_PER_SEC, 0.05),
    defaultSeconds: 5,
    seconds: [5, 10],
  },
  {
    id: "fal-ai/kling-video/v2/master/text-to-video",
    label: "Kling 2 Master (text→vidéo)",
    engine: "kling",
    mode: "text-to-video",
    audio: "silent",
    usdPerSecond: num(process.env.FAL_KLING_USD_PER_SEC, 0.28),
    defaultSeconds: 5,
    seconds: [5, 10],
  },
  {
    id: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    label: "MiniMax Hailuo 02 (text→vidéo)",
    engine: "minimax",
    mode: "text-to-video",
    audio: "silent",
    usdPerSecond: num(process.env.FAL_MINIMAX_USD_PER_SEC, 0.05),
    defaultSeconds: 6,
    seconds: [6, 10],
  },
];

export function getVideoModel(id: string): VideoModel | undefined {
  return VIDEO_MODELS.find((m) => m.id === id);
}

export function estimateVideo(modelId: string, seconds: number): number {
  const m = getVideoModel(modelId);
  if (!m) return 0;
  return +(m.usdPerSecond * seconds).toFixed(4);
}

// ---------------------------------------------------------------------------
// Lip-sync — fal models (USD per minute of output video)
// ---------------------------------------------------------------------------
export interface LipsyncModel {
  id: string;
  label: string;
  usdPerMinute: number;
}

export const LIPSYNC_MODELS: LipsyncModel[] = [
  {
    id: "veed/lipsync",
    label: "VEED Lipsync (économique)",
    usdPerMinute: num(process.env.FAL_VEED_LIPSYNC_USD_PER_MIN, 0.4),
  },
  {
    id: "fal-ai/sync-lipsync/v3",
    label: "Sync v3 (haute fidélité)",
    usdPerMinute: num(process.env.FAL_SYNC_LIPSYNC_USD_PER_MIN, 8),
  },
];

export function getLipsyncModel(id: string): LipsyncModel | undefined {
  return LIPSYNC_MODELS.find((m) => m.id === id);
}

export function estimateLipsync(modelId: string, seconds: number): number {
  const m = getLipsyncModel(modelId);
  if (!m) return 0;
  return +((m.usdPerMinute / 60) * seconds).toFixed(4);
}

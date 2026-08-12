#!/usr/bin/env node
/**
 * MT-013G2 — Prepare local MV-001 8s 720p derivative (no upload / no Git copy).
 *
 * Env (absolute paths OUTSIDE the repo — never committed):
 *   SOURCE_VIDEO_PATH
 *   OUTPUT_VIDEO_PATH
 *   FFMPEG_PATH (optional)
 *   FFPROBE_PATH (optional)
 *
 * Interval: 00:07.000 → 00:15.000 (exactly 8s)
 * Scale: 640×360 → 1280×720 · H.264 yuv420p · 25 fps · no audio · strip metadata
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { probeLocalVideoFile } from "../src/application/motion/mv001/mv001-local-media-probe";
import {
  MV001_DURATION_SECONDS,
  MV001_RESERVATION_MINOR,
  MV001_SHORTFALL_MINOR,
  buildMv001BenchmarkProfile,
} from "../src/application/motion/mv001/mv001-benchmark-profile";

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, "..");
const outDir = join(studioRoot, ".tmp");
mkdirSync(outDir, { recursive: true });

function isPlaceholder(v: string | undefined): boolean {
  return !v || v.trim() === "" || v.trim() === "..." || v.trim() === "…";
}

const source = process.env.SOURCE_VIDEO_PATH;
const output = process.env.OUTPUT_VIDEO_PATH;
if (isPlaceholder(source) || isPlaceholder(output)) {
  console.log(
    JSON.stringify({
      ok: false,
      verdict: "BLOCKED_SOURCE_PATHS_REQUIRED",
      note: "Set SOURCE_VIDEO_PATH and OUTPUT_VIDEO_PATH outside the repo.",
    }),
  );
  process.exit(2);
}

if (!existsSync(source!)) {
  console.log(JSON.stringify({ ok: false, verdict: "SOURCE_ABSENT" }));
  process.exit(1);
}

const defaultFf = join(
  studioRoot,
  ".tmp/ffmpeg-tools/node_modules/ffmpeg-static/ffmpeg.exe",
);
const defaultFp = join(
  studioRoot,
  ".tmp/ffmpeg-tools/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe",
);
const ffmpeg = process.env.FFMPEG_PATH ?? (existsSync(defaultFf) ? defaultFf : "ffmpeg");
const ffprobe = process.env.FFPROBE_PATH ?? (existsSync(defaultFp) ? defaultFp : "ffprobe");

const args = [
  "-y",
  "-i",
  source!,
  "-ss",
  "00:00:07.000",
  "-t",
  "00:00:08.000",
  "-vf",
  "scale=1280:720:flags=bicubic",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-r",
  "25",
  "-fps_mode",
  "cfr",
  "-an",
  "-map_metadata",
  "-1",
  "-movflags",
  "+faststart",
  output!,
];

const run = spawnSync(ffmpeg, args, { encoding: "utf8" });
if (run.status !== 0) {
  console.log(
    JSON.stringify({
      ok: false,
      verdict: "FFMPEG_FAILED",
      status: run.status,
      stderrTail: (run.stderr ?? "").split(/\r?\n/).slice(-8),
    }),
  );
  process.exit(1);
}

const probed = probeLocalVideoFile(output!);
const buf = readFileSync(output!);
const sha = createHash("sha256").update(buf).digest("hex");
const profile = buildMv001BenchmarkProfile();

const probeJson = spawnSync(
  ffprobe,
  [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate,codec_name,pix_fmt",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    output!,
  ],
  { encoding: "utf8" },
);

const audioCheck = spawnSync(
  ffprobe,
  ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", output!],
  { encoding: "utf8" },
);

const result = {
  ok:
    Math.abs(probed.durationSeconds - MV001_DURATION_SECONDS) <= 0.25 &&
    probed.width === 1280 &&
    probed.height === 720 &&
    probed.mimeType === "video/mp4",
  verdict:
    Math.abs(probed.durationSeconds - MV001_DURATION_SECONDS) <= 0.25 &&
    probed.width === 1280 &&
    probed.height === 720
      ? "MEDIA_PREPARED_8S_720P"
      : "MEDIA_PREPARE_INVALID",
  pathRefs: {
    source: "env:SOURCE_VIDEO_PATH",
    output: "env:OUTPUT_VIDEO_PATH",
  },
  probed: {
    mimeType: probed.mimeType,
    width: probed.width,
    height: probed.height,
    durationSeconds: probed.durationSeconds,
    fps: probed.fps,
    sizeBytes: probed.sizeBytes,
    checksumSha256: sha,
    localRelativePath: "mv001/source.mp4",
  },
  ffprobe: probeJson.status === 0 ? JSON.parse(probeJson.stdout || "{}") : null,
  audioStreams: (audioCheck.stdout ?? "").trim().length > 0,
  originalUntouched: true,
  profile: {
    durationSeconds: profile.durationSeconds,
    estimateMinor: profile.estimateMinor,
    reservationMinor: MV001_RESERVATION_MINOR,
    absoluteCapMinor: profile.absoluteCapMinor,
    shortfallMinor: MV001_SHORTFALL_MINOR,
  },
  network: false,
  upload: false,
  providerCalled: false,
};

writeFileSync(join(outDir, "mt013g2-prepare-8s.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, out: ".tmp/mt013g2-prepare-8s.json" }, null, 2));
process.exit(result.ok ? 0 : 1);

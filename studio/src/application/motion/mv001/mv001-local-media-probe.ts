/**
 * MT-013G — Offline local media probes (no network, no ffprobe dependency).
 * Parses container/image headers only; never logs absolute user paths.
 */

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

export type ProbedImage = {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
  checksumSha256: string;
};

export type ProbedVideo = {
  mimeType: "video/mp4";
  width: number;
  height: number;
  durationSeconds: number;
  fps: number | null;
  sizeBytes: number;
  checksumSha256: string;
};

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function readU32BE(buf: Buffer, offset: number): number {
  return buf.readUInt32BE(offset);
}

function readU32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

type BoxHit = { type: string; payload: Buffer; start: number; end: number };

/** Collect top-level / nested boxes of interest (ISO-BMFF). */
function collectBoxes(
  buf: Buffer,
  start: number,
  end: number,
  types: ReadonlySet<string>,
  into: BoxHit[],
): void {
  let offset = start;
  while (offset + 8 <= end) {
    let size = readU32BE(buf, offset);
    const boxType = buf.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) return;
      size = Number(buf.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) return;
    const payloadStart = offset + header;
    const payloadEnd = offset + size;
    if (types.has(boxType)) {
      into.push({
        type: boxType,
        payload: buf.subarray(payloadStart, payloadEnd),
        start: offset,
        end: payloadEnd,
      });
    }
    if (
      boxType === "moov" ||
      boxType === "trak" ||
      boxType === "mdia" ||
      boxType === "minf" ||
      boxType === "stbl" ||
      boxType === "edts"
    ) {
      collectBoxes(buf, payloadStart, payloadEnd, types, into);
    }
    offset += size;
  }
}

function findFirst(
  boxes: readonly BoxHit[],
  type: string,
  rangeStart: number,
  rangeEnd: number,
): BoxHit | null {
  for (const b of boxes) {
    if (b.type === type && b.start >= rangeStart && b.end <= rangeEnd) return b;
  }
  return null;
}

function parseMvhd(payload: Buffer): { timescale: number; durationSeconds: number } {
  const version = payload[0] ?? 0;
  const timescale =
    version === 1 ? readU32BE(payload, 20) : readU32BE(payload, 12);
  const duration =
    version === 1
      ? Number(payload.readBigUInt64BE(24))
      : readU32BE(payload, 16);
  if (!(timescale > 0) || !(duration >= 0)) throw new Error("mp4_duration_invalid");
  return { timescale, durationSeconds: duration / timescale };
}

function parseTkhdDimensions(payload: Buffer): { width: number; height: number } {
  const v = payload[0] ?? 0;
  const whOffset = v === 1 ? 88 : 76;
  if (payload.length < whOffset + 8) return { width: 0, height: 0 };
  return {
    width: Math.round(readU32BE(payload, whOffset) / 65536),
    height: Math.round(readU32BE(payload, whOffset + 4) / 65536),
  };
}

function parseMdhd(payload: Buffer): { timescale: number; durationSeconds: number } {
  const v = payload[0] ?? 0;
  const timescale = v === 1 ? readU32BE(payload, 20) : readU32BE(payload, 12);
  const duration =
    v === 1 ? Number(payload.readBigUInt64BE(24)) : readU32BE(payload, 16);
  if (!(timescale > 0)) throw new Error("mp4_mdhd_invalid");
  return { timescale, durationSeconds: duration / timescale };
}

function parseStsdVisualDims(payload: Buffer): { width: number; height: number } {
  if (payload.length < 16) return { width: 0, height: 0 };
  const entryCount = readU32BE(payload, 4);
  let e = 8;
  for (let i = 0; i < entryCount && e + 16 <= payload.length; i++) {
    const esize = readU32BE(payload, e);
    const fmt = payload.toString("ascii", e + 4, e + 8);
    const body = payload.subarray(e + 8, e + esize);
    // Visual sample entries (avc1/hvc1/mp4v/…) carry width/height at +24/+26
    if (
      (fmt === "avc1" ||
        fmt === "avc3" ||
        fmt === "hvc1" ||
        fmt === "hev1" ||
        fmt === "mp4v" ||
        fmt === "encv") &&
      body.length >= 28
    ) {
      const width = body.readUInt16BE(24);
      const height = body.readUInt16BE(26);
      if (width > 0 && height > 0) return { width, height };
    }
    e += esize;
  }
  return { width: 0, height: 0 };
}

function parseSttsFps(payload: Buffer, mediaTimescale: number): number | null {
  if (payload.length < 16) return null;
  const entryCount = readU32BE(payload, 4);
  if (entryCount < 1) return null;
  // Prefer dominant (first/largest) constant-delta entry
  let bestCount = 0;
  let bestDelta = 0;
  for (let i = 0; i < entryCount; i++) {
    const base = 8 + i * 8;
    if (base + 8 > payload.length) break;
    const sampleCount = readU32BE(payload, base);
    const sampleDelta = readU32BE(payload, base + 4);
    if (sampleDelta > 0 && sampleCount >= bestCount) {
      bestCount = sampleCount;
      bestDelta = sampleDelta;
    }
  }
  if (!(bestDelta > 0) || !(mediaTimescale > 0)) return null;
  return Math.round((mediaTimescale / bestDelta) * 1000) / 1000;
}

function probeMp4(buf: Buffer): Omit<ProbedVideo, "sizeBytes" | "checksumSha256"> {
  if (buf.length < 16) throw new Error("mp4_too_small");
  const types = new Set([
    "ftyp",
    "moov",
    "mvhd",
    "trak",
    "tkhd",
    "mdia",
    "mdhd",
    "hdlr",
    "stsd",
    "stts",
  ]);
  const boxes: BoxHit[] = [];
  collectBoxes(buf, 0, buf.length, types, boxes);
  if (!boxes.some((b) => b.type === "ftyp")) throw new Error("mp4_ftyp_missing");

  const mvhd = boxes.find((b) => b.type === "mvhd");
  if (!mvhd) throw new Error("mp4_mvhd_missing");
  const movie = parseMvhd(mvhd.payload);

  const traks = boxes.filter((b) => b.type === "trak");
  let width = 0;
  let height = 0;
  let fps: number | null = null;
  let trackDuration = movie.durationSeconds;

  for (const trak of traks) {
    const hdlr = findFirst(boxes, "hdlr", trak.start, trak.end);
    if (!hdlr || hdlr.payload.length < 12) continue;
    const handler = hdlr.payload.toString("ascii", 8, 12);
    if (handler !== "vide") continue;

    const tkhd = findFirst(boxes, "tkhd", trak.start, trak.end);
    const mdhd = findFirst(boxes, "mdhd", trak.start, trak.end);
    const stsd = findFirst(boxes, "stsd", trak.start, trak.end);
    const stts = findFirst(boxes, "stts", trak.start, trak.end);

    if (tkhd) {
      const d = parseTkhdDimensions(tkhd.payload);
      width = d.width;
      height = d.height;
    }
    if (stsd) {
      const d = parseStsdVisualDims(stsd.payload);
      if (d.width > 0 && d.height > 0) {
        width = d.width;
        height = d.height;
      }
    }
    if (mdhd) {
      const m = parseMdhd(mdhd.payload);
      trackDuration = m.durationSeconds;
      if (stts) fps = parseSttsFps(stts.payload, m.timescale);
    }
    break;
  }

  if (!(width > 0) || !(height > 0)) throw new Error("mp4_dimensions_missing");

  return {
    mimeType: "video/mp4",
    width,
    height,
    durationSeconds: trackDuration > 0 ? trackDuration : movie.durationSeconds,
    fps,
  };
}

function probePng(buf: Buffer): Omit<ProbedImage, "sizeBytes" | "checksumSha256"> {
  if (buf.length < 24) throw new Error("png_too_small");
  if (buf.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error("png_signature");
  const width = readU32BE(buf, 16);
  const height = readU32BE(buf, 20);
  if (!(width > 0) || !(height > 0)) throw new Error("png_dimensions_invalid");
  return { mimeType: "image/png", width, height };
}

function probeJpeg(buf: Buffer): Omit<ProbedImage, "sizeBytes" | "checksumSha256"> {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error("jpeg_signature");
  }
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(offset + 2);
    if (len < 2) throw new Error("jpeg_segment_invalid");
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      if (!(width > 0) || !(height > 0)) throw new Error("jpeg_dimensions_invalid");
      return { mimeType: "image/jpeg", width, height };
    }
    offset += 2 + len;
  }
  throw new Error("jpeg_sof_missing");
}

function probeWebp(buf: Buffer): Omit<ProbedImage, "sizeBytes" | "checksumSha256"> {
  if (buf.length < 30) throw new Error("webp_too_small");
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("webp_signature");
  }
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8X" && buf.length >= 30) {
    const w = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
    const h = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16));
    if (!(w > 0) || !(h > 0)) throw new Error("webp_dimensions_invalid");
    return { mimeType: "image/webp", width: w, height: h };
  }
  if (fourcc === "VP8 " && buf.length >= 30) {
    const w = buf.readUInt16LE(26) & 0x3fff;
    const h = buf.readUInt16LE(28) & 0x3fff;
    if (!(w > 0) || !(h > 0)) throw new Error("webp_dimensions_invalid");
    return { mimeType: "image/webp", width: w, height: h };
  }
  if (fourcc === "VP8L" && buf.length >= 25) {
    const bits = readU32LE(buf, 21);
    const w = (bits & 0x3fff) + 1;
    const h = ((bits >> 14) & 0x3fff) + 1;
    return { mimeType: "image/webp", width: w, height: h };
  }
  throw new Error("webp_unsupported_chunk");
}

export function probeLocalImageFile(absolutePath: string): ProbedImage {
  const st = statSync(absolutePath);
  if (!st.isFile() || st.size <= 0) throw new Error("image_unreadable");
  const buf = readFileSync(absolutePath);
  const head = buf.subarray(0, 16);
  let meta: Omit<ProbedImage, "sizeBytes" | "checksumSha256">;
  if (head[0] === 0x89 && head.toString("ascii", 1, 4) === "PNG") {
    meta = probePng(buf);
  } else if (head[0] === 0xff && head[1] === 0xd8) {
    meta = probeJpeg(buf);
  } else if (head.toString("ascii", 0, 4) === "RIFF") {
    meta = probeWebp(buf);
  } else {
    throw new Error("image_mime_unsupported");
  }
  return {
    ...meta,
    sizeBytes: st.size,
    checksumSha256: sha256(buf),
  };
}

export function probeLocalVideoFile(absolutePath: string): ProbedVideo {
  const st = statSync(absolutePath);
  if (!st.isFile() || st.size <= 0) throw new Error("video_unreadable");
  const buf = readFileSync(absolutePath);
  const meta = probeMp4(buf);
  return {
    ...meta,
    sizeBytes: st.size,
    checksumSha256: sha256(buf),
  };
}

/** Redact absolute paths to opaque role-relative placeholders. */
export function redactPathToRelativeRole(
  role: "motion_source_video" | "motion_identity_reference",
  mimeType: string,
): string {
  const ext =
    mimeType === "video/mp4"
      ? "mp4"
      : mimeType === "image/png"
        ? "png"
        : mimeType === "image/jpeg"
          ? "jpg"
          : mimeType === "image/webp"
            ? "webp"
            : "bin";
  return role === "motion_source_video"
    ? `mv001/source.${ext}`
    : `mv001/identity.${ext}`;
}

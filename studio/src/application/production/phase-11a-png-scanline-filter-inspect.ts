/**
 * Read-only scanline filter inspection for Phase 11A.
 * Does not change decodeRgbPng. Never returns pixels.
 */
import { inflateSync } from "node:zlib";
import {
  PHASE_11A_PNG_BYTES_PER_PIXEL,
  PHASE_11A_PNG_MAX_ENCODED_BYTES,
  PHASE_11A_PNG_MAX_INFLATED_BYTES,
  Phase11APngError,
  readPhase11APngIhdr,
} from "./phase-11a-png-rgb";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function readChunkAt(
  bytes: Uint8Array,
  offset: number,
): { type: string; data: Uint8Array; next: number } {
  if (offset + 12 > bytes.length) throw new Phase11APngError("truncated");
  const len = readU32(bytes, offset);
  if (len > PHASE_11A_PNG_MAX_ENCODED_BYTES) {
    throw new Phase11APngError("encoded_too_large");
  }
  const next = offset + 12 + len;
  if (next > bytes.length || next < offset) throw new Phase11APngError("truncated");
  const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString("ascii");
  const data = bytes.subarray(offset + 8, offset + 8 + len);
  const storedCrc = readU32(bytes, offset + 8 + len);
  const crcInput = bytes.subarray(offset + 4, offset + 8 + len);
  if (crc32(crcInput) !== storedCrc) throw new Phase11APngError("invalid_crc");
  return { type, data, next };
}

/** Unique PNG scanline filter types (0–4). Numeric only. */
export function inspectPhase11APngScanlineFilters(bytes: Uint8Array): number[] {
  const ihdr = readPhase11APngIhdr(bytes);
  const stride = ihdr.width * PHASE_11A_PNG_BYTES_PER_PIXEL + 1;
  const expected = stride * ihdr.height;
  if (expected > PHASE_11A_PNG_MAX_INFLATED_BYTES) {
    throw new Phase11APngError("decompression_bomb");
  }

  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < bytes.length) {
    const parsed = readChunkAt(bytes, offset);
    offset = parsed.next;
    if (parsed.type === "IDAT") idat.push(Buffer.from(parsed.data));
    if (parsed.type === "IEND") break;
  }
  if (idat.length === 0) throw new Phase11APngError("missing_idat");

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch {
    throw new Phase11APngError("idat_truncated");
  }
  if (inflated.length !== expected) {
    throw new Phase11APngError("inflated_size_mismatch");
  }

  const seen = new Set<number>();
  for (let y = 0; y < ihdr.height; y++) {
    const filter = inflated[y * stride] ?? 0;
    if (filter > 4) {
      throw new Phase11APngError("unknown_filter", "png: unsupported filter");
    }
    seen.add(filter);
  }
  return [...seen].sort((a, b) => a - b);
}

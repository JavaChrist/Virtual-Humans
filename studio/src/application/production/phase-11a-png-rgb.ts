/**
 * Deterministic RGB8 PNG encode/decode (no sharp, no network, no native addon).
 * Used by the Phase 11A overlay compositor and synthetic tests.
 *
 * Decode supports PNG filters 0–4 (None/Sub/Up/Average/Paeth) after IDAT inflate.
 * Encode always writes filter 0 + zlib level 9 + no variable metadata.
 * Contract: 8-bit truecolor RGB, non-interlaced only. RGBA/gray/indexed/Adam7 rejected.
 */

import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const PHASE_11A_PNG_SUPPORTED_FILTERS = [0, 1, 2, 3, 4] as const;
export const PHASE_11A_PNG_BYTES_PER_PIXEL = 3 as const;
export const PHASE_11A_PNG_BIT_DEPTH = 8 as const;
export const PHASE_11A_PNG_COLOR_TYPE_RGB = 2 as const;
export const PHASE_11A_PNG_MAX_ENCODED_BYTES = 8 * 1024 * 1024;
export const PHASE_11A_PNG_MAX_WIDTH = 1024;
export const PHASE_11A_PNG_MAX_HEIGHT = 1024;
export const PHASE_11A_PNG_MAX_PIXELS = 1024 * 1024;
export const PHASE_11A_PNG_MAX_INFLATED_BYTES = (1024 * 3 + 1) * 1024;
export const PHASE_11A_PNG_MAX_INFLATE_RATIO = 1_048_576;

export type Phase11APngErrorCode =
  | "truncated"
  | "bad_signature"
  | "encoded_too_large"
  | "bad_ihdr"
  | "invalid_crc"
  | "unknown_critical_chunk"
  | "unsupported_bit_depth"
  | "grayscale_unsupported"
  | "indexed_unsupported"
  | "rgba_unsupported"
  | "unsupported_color_type"
  | "unsupported_compression"
  | "unsupported_filter_method"
  | "interlaced_unsupported"
  | "invalid_dimensions"
  | "overflow"
  | "missing_ihdr"
  | "missing_idat"
  | "idat_truncated"
  | "inflated_size_mismatch"
  | "scanline_length"
  | "unknown_filter"
  | "decompression_bomb"
  | "rgb_length_mismatch";

export class Phase11APngError extends Error {
  readonly code: Phase11APngErrorCode;
  constructor(code: Phase11APngErrorCode, message?: string) {
    super(message ?? `png: ${code}`);
    this.name = "Phase11APngError";
    this.code = code;
  }
}

export function isPhase11APngError(err: unknown): err is Phase11APngError {
  return err instanceof Phase11APngError;
}

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

function u32(n: number): Uint8Array {
  return Uint8Array.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
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

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = u32(crc32(crcInput));
  return Buffer.concat([u32(data.length), typeBytes, data, crc]);
}

function isCriticalChunk(type: string): boolean {
  const code = type.charCodeAt(0);
  return type.length === 4 && code >= 65 && code <= 90;
}

function checkedMul(a: number, b: number, code: Phase11APngErrorCode = "overflow"): number {
  if (a < 0 || b < 0 || !Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Phase11APngError(code);
  }
  const product = a * b;
  if (!Number.isSafeInteger(product)) throw new Phase11APngError("overflow");
  return product;
}

function assertRgbDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Phase11APngError("invalid_dimensions");
  }
  if (width > PHASE_11A_PNG_MAX_WIDTH || height > PHASE_11A_PNG_MAX_HEIGHT) {
    throw new Phase11APngError("invalid_dimensions");
  }
  const pixels = checkedMul(width, height);
  if (pixels > PHASE_11A_PNG_MAX_PIXELS) throw new Phase11APngError("overflow");
}

function scanlineStride(width: number): number {
  return checkedMul(width, PHASE_11A_PNG_BYTES_PER_PIXEL) + 1;
}

function expectedInflatedBytes(width: number, height: number): number {
  return checkedMul(scanlineStride(width), height);
}

/** PNG spec Paeth predictor: a=left, b=up, c=up-left. */
export function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function reconstructByte(
  filter: number,
  raw: number,
  left: number,
  up: number,
  upLeft: number,
): number {
  switch (filter) {
    case 0:
      return raw & 0xff;
    case 1:
      return (raw + left) & 0xff;
    case 2:
      return (raw + up) & 0xff;
    case 3:
      return (raw + ((left + up) >> 1)) & 0xff;
    case 4:
      return (raw + paethPredictor(left, up, upLeft)) & 0xff;
    default:
      throw new Phase11APngError("unknown_filter", "png: unsupported filter");
  }
}

function filterByte(
  filter: number,
  orig: number,
  left: number,
  up: number,
  upLeft: number,
): number {
  switch (filter) {
    case 0:
      return orig & 0xff;
    case 1:
      return (orig - left) & 0xff;
    case 2:
      return (orig - up) & 0xff;
    case 3:
      return (orig - ((left + up) >> 1)) & 0xff;
    case 4:
      return (orig - paethPredictor(left, up, upLeft)) & 0xff;
    default:
      throw new Phase11APngError("unknown_filter", "png: unsupported filter");
  }
}

function applyRowFilter(
  filter: number,
  rgbRow: Uint8Array,
  prevRgbRow: Uint8Array | null,
  out: Uint8Array,
  outOffset: number,
): void {
  const bpp = PHASE_11A_PNG_BYTES_PER_PIXEL;
  out[outOffset] = filter;
  for (let i = 0; i < rgbRow.length; i++) {
    const left = i >= bpp ? (rgbRow[i - bpp] ?? 0) : 0;
    const up = prevRgbRow ? (prevRgbRow[i] ?? 0) : 0;
    const upLeft = prevRgbRow && i >= bpp ? (prevRgbRow[i - bpp] ?? 0) : 0;
    out[outOffset + 1 + i] = filterByte(filter, rgbRow[i] ?? 0, left, up, upLeft);
  }
}

function unfilterRows(inflated: Uint8Array, width: number, height: number): Uint8Array {
  const bpp = PHASE_11A_PNG_BYTES_PER_PIXEL;
  const stride = scanlineStride(width);
  const rowBytes = checkedMul(width, bpp);
  if (inflated.length !== checkedMul(stride, height)) {
    throw new Phase11APngError("scanline_length");
  }
  const rgb = new Uint8Array(checkedMul(rowBytes, height));
  let prev: Uint8Array | null = null;
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    const filter = inflated[rowStart] ?? 0;
    if (filter > 4) {
      throw new Phase11APngError("unknown_filter", "png: unsupported filter");
    }
    const recon = rgb.subarray(y * rowBytes, (y + 1) * rowBytes);
    for (let i = 0; i < rowBytes; i++) {
      const raw = inflated[rowStart + 1 + i];
      if (raw === undefined) throw new Phase11APngError("scanline_length");
      const left = i >= bpp ? (recon[i - bpp] ?? 0) : 0;
      const up = prev ? (prev[i] ?? 0) : 0;
      const upLeft = prev && i >= bpp ? (prev[i - bpp] ?? 0) : 0;
      recon[i] = reconstructByte(filter, raw, left, up, upLeft);
    }
    prev = recon;
  }
  return rgb;
}

export type RgbPng = {
  width: number;
  height: number;
  rgb: Uint8Array;
};

export type Phase11APngIhdr = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  compression: number;
  filterMethod: number;
  interlace: number;
};

function writeIhdr(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = PHASE_11A_PNG_BIT_DEPTH;
  ihdr[9] = PHASE_11A_PNG_COLOR_TYPE_RGB;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return ihdr;
}

function wrapPng(width: number, height: number, raw: Uint8Array): Uint8Array {
  const compressed = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", writeIhdr(width, height)),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

export function encodeRgbPng(input: RgbPng): Uint8Array {
  const { width, height, rgb } = input;
  assertRgbDimensions(width, height);
  const expected = checkedMul(checkedMul(width, height), PHASE_11A_PNG_BYTES_PER_PIXEL);
  if (rgb.byteLength !== expected) throw new Phase11APngError("rgb_length_mismatch");
  const stride = scanlineStride(width);
  const raw = Buffer.alloc(checkedMul(stride, height));
  for (let y = 0; y < height; y++) {
    applyRowFilter(
      0,
      rgb.subarray(y * width * 3, (y + 1) * width * 3),
      null,
      raw,
      y * stride,
    );
  }
  return wrapPng(width, height, raw);
}

/**
 * Test/fixture helper: encode RGB8 with explicit per-row PNG filters (0–4).
 * Production compositor output still uses encodeRgbPng (filter 0 only).
 */
export function encodeRgbPngWithRowFilters(input: RgbPng, filters: readonly number[]): Uint8Array {
  const { width, height, rgb } = input;
  assertRgbDimensions(width, height);
  if (filters.length !== height) throw new Phase11APngError("scanline_length");
  const expected = checkedMul(checkedMul(width, height), PHASE_11A_PNG_BYTES_PER_PIXEL);
  if (rgb.byteLength !== expected) throw new Phase11APngError("rgb_length_mismatch");
  const stride = scanlineStride(width);
  const raw = Buffer.alloc(checkedMul(stride, height));
  let prev: Uint8Array | null = null;
  for (let y = 0; y < height; y++) {
    const filter = filters[y] ?? 0;
    if (filter > 4) throw new Phase11APngError("unknown_filter", "png: unsupported filter");
    const row = rgb.subarray(y * width * 3, (y + 1) * width * 3);
    applyRowFilter(filter, row, prev, raw, y * stride);
    prev = row;
  }
  return wrapPng(width, height, raw);
}

function rejectColorType(colorType: number): never {
  if (colorType === 0 || colorType === 4) {
    throw new Phase11APngError("grayscale_unsupported");
  }
  if (colorType === 3) throw new Phase11APngError("indexed_unsupported");
  if (colorType === 6) throw new Phase11APngError("rgba_unsupported");
  throw new Phase11APngError("unsupported_color_type");
}

function parseIhdr(data: Uint8Array): Phase11APngIhdr {
  if (data.length !== 13) throw new Phase11APngError("bad_ihdr");
  const width = readU32(data, 0);
  const height = readU32(data, 4);
  const bitDepth = data[8] ?? 0;
  const colorType = data[9] ?? 0;
  const compression = data[10] ?? 0;
  const filterMethod = data[11] ?? 0;
  const interlace = data[12] ?? 0;
  return { width, height, bitDepth, colorType, compression, filterMethod, interlace };
}

function assertSupportedIhdr(ihdr: Phase11APngIhdr): void {
  assertRgbDimensions(ihdr.width, ihdr.height);
  if (ihdr.bitDepth !== PHASE_11A_PNG_BIT_DEPTH) {
    throw new Phase11APngError("unsupported_bit_depth");
  }
  if (ihdr.colorType !== PHASE_11A_PNG_COLOR_TYPE_RGB) rejectColorType(ihdr.colorType);
  if (ihdr.compression !== 0) throw new Phase11APngError("unsupported_compression");
  if (ihdr.filterMethod !== 0) throw new Phase11APngError("unsupported_filter_method");
  if (ihdr.interlace !== 0) throw new Phase11APngError("interlaced_unsupported");
}

export function readPhase11APngIhdr(bytes: Uint8Array): Phase11APngIhdr {
  if (bytes.length > PHASE_11A_PNG_MAX_ENCODED_BYTES) {
    throw new Phase11APngError("encoded_too_large");
  }
  if (bytes.length < 33) throw new Phase11APngError("truncated");
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) throw new Phase11APngError("bad_signature");
  }
  const first = readChunkAt(bytes, 8);
  if (first.type !== "IHDR") throw new Phase11APngError("missing_ihdr");
  return parseIhdr(first.data);
}

function readChunkAt(
  bytes: Uint8Array,
  offset: number,
): { type: string; data: Uint8Array; next: number } {
  if (offset + 12 > bytes.length) throw new Phase11APngError("truncated");
  const len = readU32(bytes, offset);
  if (len > PHASE_11A_PNG_MAX_ENCODED_BYTES) throw new Phase11APngError("encoded_too_large");
  const next = offset + 12 + len;
  if (next > bytes.length || next < offset) throw new Phase11APngError("truncated");
  const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString("ascii");
  if (type.length !== 4 || !/^[A-Za-z]{4}$/.test(type)) {
    throw new Phase11APngError("unknown_critical_chunk");
  }
  const data = bytes.subarray(offset + 8, offset + 8 + len);
  const storedCrc = readU32(bytes, offset + 8 + len);
  const crcInput = bytes.subarray(offset + 4, offset + 8 + len);
  if (crc32(crcInput) !== storedCrc) throw new Phase11APngError("invalid_crc");
  return { type, data, next };
}

export function decodeRgbPng(bytes: Uint8Array): RgbPng {
  if (bytes.length > PHASE_11A_PNG_MAX_ENCODED_BYTES) {
    throw new Phase11APngError("encoded_too_large");
  }
  if (bytes.length < 33) throw new Phase11APngError("truncated");
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) throw new Phase11APngError("bad_signature");
  }

  let offset = 8;
  let ihdr: Phase11APngIhdr | null = null;
  const idat: Buffer[] = [];
  let sawIend = false;

  while (offset < bytes.length) {
    const parsed = readChunkAt(bytes, offset);
    offset = parsed.next;
    if (!ihdr) {
      if (parsed.type !== "IHDR") throw new Phase11APngError("missing_ihdr");
      ihdr = parseIhdr(parsed.data);
      assertSupportedIhdr(ihdr);
      continue;
    }
    if (parsed.type === "IHDR") throw new Phase11APngError("bad_ihdr");
    if (parsed.type === "IDAT") {
      idat.push(Buffer.from(parsed.data));
      continue;
    }
    if (parsed.type === "IEND") {
      if (parsed.data.length !== 0) throw new Phase11APngError("bad_ihdr");
      sawIend = true;
      break;
    }
    if (parsed.type === "PLTE") {
      continue;
    }
    if (isCriticalChunk(parsed.type)) {
      throw new Phase11APngError("unknown_critical_chunk");
    }
  }

  if (!ihdr) throw new Phase11APngError("missing_ihdr");
  if (!sawIend) throw new Phase11APngError("truncated");
  if (idat.length === 0) throw new Phase11APngError("missing_idat");

  const expected = expectedInflatedBytes(ihdr.width, ihdr.height);
  if (expected > PHASE_11A_PNG_MAX_INFLATED_BYTES) {
    throw new Phase11APngError("decompression_bomb");
  }
  const encodedIdat = idat.reduce((n, part) => n + part.byteLength, 0);
  if (encodedIdat === 0) throw new Phase11APngError("idat_truncated");
  if (expected > encodedIdat * PHASE_11A_PNG_MAX_INFLATE_RATIO) {
    throw new Phase11APngError("decompression_bomb");
  }

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: expected });
  } catch {
    throw new Phase11APngError("idat_truncated");
  }
  if (inflated.length !== expected) {
    throw new Phase11APngError("inflated_size_mismatch");
  }

  const rgb = unfilterRows(inflated, ihdr.width, ihdr.height);
  return { width: ihdr.width, height: ihdr.height, rgb };
}

export function solidRgbPng(input: {
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
}): Uint8Array {
  const rgb = new Uint8Array(checkedMul(checkedMul(input.width, input.height), 3));
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = input.r;
    rgb[i + 1] = input.g;
    rgb[i + 2] = input.b;
  }
  return encodeRgbPng({ width: input.width, height: input.height, rgb });
}

/**
 * Deterministic RGB8 PNG encode/decode (no sharp, no network).
 * Used by the Phase 11A overlay compositor and synthetic tests.
 */

import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = u32(crc32(crcInput));
  return Buffer.concat([u32(data.length), typeBytes, data, crc]);
}

export type RgbPng = {
  width: number;
  height: number;
  rgb: Uint8Array;
};

export function encodeRgbPng(input: RgbPng): Uint8Array {
  const { width, height, rgb } = input;
  if (width <= 0 || height <= 0) throw new Error("png: invalid dimensions");
  if (rgb.byteLength !== width * height * 3) throw new Error("png: rgb length mismatch");
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), rowStart + 1);
  }
  const compressed = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

export function decodeRgbPng(bytes: Uint8Array): RgbPng {
  if (bytes.length < 33) throw new Error("png: truncated");
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) throw new Error("png: bad signature");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const len =
      ((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0);
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + len);
    offset += 12 + len;
    if (type === "IHDR") {
      if (data.length < 13) throw new Error("png: bad IHDR");
      width =
        ((data[0] ?? 0) << 24) |
        ((data[1] ?? 0) << 16) |
        ((data[2] ?? 0) << 8) |
        (data[3] ?? 0);
      height =
        ((data[4] ?? 0) << 24) |
        ((data[5] ?? 0) << 16) |
        ((data[6] ?? 0) << 8) |
        (data[7] ?? 0);
      if (data[8] !== 8 || data[9] !== 2 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        throw new Error("png: only 8-bit RGB non-interlaced is supported");
      }
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
  }
  if (width <= 0 || height <= 0) throw new Error("png: missing IHDR");
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 3 + 1;
  if (inflated.length !== stride * height) throw new Error("png: inflated size mismatch");
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    if (inflated[y * stride] !== 0) throw new Error("png: unsupported filter");
    rgb.set(inflated.subarray(y * stride + 1, y * stride + 1 + width * 3), y * width * 3);
  }
  return { width, height, rgb };
}

export function solidRgbPng(input: {
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
}): Uint8Array {
  const rgb = new Uint8Array(input.width * input.height * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = input.r;
    rgb[i + 1] = input.g;
    rgb[i + 2] = input.b;
  }
  return encodeRgbPng({ width: input.width, height: input.height, rgb });
}

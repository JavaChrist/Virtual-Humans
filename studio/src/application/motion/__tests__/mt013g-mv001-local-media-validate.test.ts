/**
 * MT-013G — local media validation guards (zero network, no upload).
 * Synthetic media only under os.tmpdir() — never committed.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import { deflateSync } from "node:zlib";
import {
  probeLocalImageFile,
  probeLocalVideoFile,
  redactPathToRelativeRole,
  validateMv001LocalMedia,
} from "../mv001";

const NOW = "2026-08-11T22:30:00.000Z";
const tmpRoot = mkdtempSync(join(tmpdir(), "mt013g-mv001-"));

after(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function box(type: string, payload: Buffer): Buffer {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(8 + payload.length, 0);
  return Buffer.concat([size, Buffer.from(type, "ascii"), payload]);
}

/** Minimal MP4: ftyp + moov with mvhd/tkhd/mdhd/stsd/stts for 8s @ 25fps 1280x720. */
function buildMinimalMp4(opts?: {
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
}): Buffer {
  const durationSeconds = opts?.durationSeconds ?? 8;
  const width = opts?.width ?? 1280;
  const height = opts?.height ?? 720;
  const fps = opts?.fps ?? 25;
  const timescale = 1000;
  const duration = Math.round(durationSeconds * timescale);
  const mediaTimescale = fps;
  const mediaDuration = Math.round(durationSeconds * mediaTimescale);

  const mvhd = Buffer.alloc(100);
  mvhd[0] = 0; // version
  mvhd.writeUInt32BE(timescale, 12);
  mvhd.writeUInt32BE(duration, 16);
  mvhd.writeUInt32BE(0x00010000, 20); // rate 1.0
  mvhd.writeUInt16BE(0x0100, 24); // volume
  // matrix identity + next_track_id
  mvhd.writeUInt32BE(0x00010000, 36);
  mvhd.writeUInt32BE(0x00010000, 52);
  mvhd.writeUInt32BE(0x40000000, 68);
  mvhd.writeUInt32BE(2, 96);

  const tkhd = Buffer.alloc(84);
  tkhd[0] = 0;
  tkhd.writeUInt32BE(1, 12); // track_id
  tkhd.writeUInt32BE(duration, 20);
  tkhd.writeUInt32BE(width << 16, 76);
  tkhd.writeUInt32BE(height << 16, 80);

  const mdhd = Buffer.alloc(24);
  mdhd[0] = 0;
  mdhd.writeUInt32BE(mediaTimescale, 12);
  mdhd.writeUInt32BE(mediaDuration, 16);

  const hdlr = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("\0\0\0\0vide", "binary"),
    Buffer.alloc(12),
    Buffer.from("VideoHandler\0", "ascii"),
  ]);

  // stsd: one VisualSampleEntry-like avc1
  const sampleEntryBody = Buffer.alloc(78);
  // format handled by outer box type; payload after size+type starts at reserved
  sampleEntryBody.fill(0);
  sampleEntryBody.writeUInt16BE(1, 6); // data_reference_index
  sampleEntryBody.writeUInt16BE(width, 24);
  sampleEntryBody.writeUInt16BE(height, 26);
  const stsdEntry = box("avc1", sampleEntryBody);
  const stsdPayload = Buffer.concat([
    Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]),
    stsdEntry,
  ]);

  const sttsPayload = Buffer.alloc(16);
  sttsPayload.writeUInt32BE(1, 4); // entry_count
  sttsPayload.writeUInt32BE(mediaDuration, 8); // sample_count
  sttsPayload.writeUInt32BE(1, 12); // sample_delta

  const stbl = box(
    "stbl",
    Buffer.concat([box("stsd", stsdPayload), box("stts", sttsPayload)]),
  );
  const minf = box("minf", stbl);
  const mdia = box(
    "mdia",
    Buffer.concat([box("mdhd", mdhd), box("hdlr", hdlr), minf]),
  );
  const trak = box("trak", Buffer.concat([box("tkhd", tkhd), mdia]));
  const moov = box("moov", Buffer.concat([box("mvhd", mvhd), trak]));
  const ftypPayload = Buffer.concat([
    Buffer.from("isom", "ascii"),
    Buffer.from([0, 0, 0, 1]),
    Buffer.from("isom", "ascii"),
    Buffer.from("iso2", "ascii"),
    Buffer.from("mp41", "ascii"),
  ]);
  return Buffer.concat([box("ftyp", ftypPayload), moov]);
}

function buildPng(width: number, height: number): Buffer {
  // Minimal valid PNG via IHDR + empty IDAT + IEND is complex for arbitrary size;
  // use a fixed 1x1 and rewrite IHDR dimensions (decoder reads IHDR only).
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  const ihdr = chunk("IHDR", ihdrData);
  // Minimal IDAT (dimensions read from IHDR only)
  const raw = Buffer.from([0, 0, 0, 0]);
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}

function pngCrc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

describe("MT-013G local media validate", () => {
  test("placeholder paths → BLOCKED_SOURCE_PATHS_REQUIRED", () => {
    const r = validateMv001LocalMedia({
      sourceVideoPath: "...",
      identityImagePath: "...",
      nowIso: NOW,
    });
    assert.equal(r.verdict, "BLOCKED_SOURCE_PATHS_REQUIRED");
    assert.equal(r.mediaRead, false);
    assert.equal(r.mediaValidated, false);
    assert.equal(r.network, false);
    assert.equal(r.upload, false);
    assert.equal(r.providerCalled, false);
  });

  test("probe PNG + MP4 + validated manifest redacted", () => {
    const videoPath = join(tmpRoot, "source.mp4");
    const imagePath = join(tmpRoot, "identity.png");
    writeFileSync(videoPath, buildMinimalMp4());
    writeFileSync(imagePath, buildPng(512, 512));

    const v = probeLocalVideoFile(videoPath);
    assert.equal(v.mimeType, "video/mp4");
    assert.equal(v.width, 1280);
    assert.equal(v.height, 720);
    assert.ok(Math.abs(v.durationSeconds - 8) < 0.05);
    assert.ok(v.fps != null && Math.abs(v.fps - 25) <= 1);
    assert.match(v.checksumSha256, /^[a-f0-9]{64}$/);

    const img = probeLocalImageFile(imagePath);
    assert.equal(img.mimeType, "image/png");
    assert.equal(img.width, 512);
    assert.equal(img.height, 512);

    const r = validateMv001LocalMedia({
      sourceVideoPath: videoPath,
      identityImagePath: imagePath,
      nowIso: NOW,
    });
    assert.equal(r.verdict, "MEDIA_VALIDATED");
    assert.equal(r.mediaValidated, true);
    assert.ok(r.manifest);
    assert.equal(r.manifest!.entries[0]!.localRelativePath, "mv001/source.mp4");
    assert.equal(r.manifest!.entries[1]!.localRelativePath, "mv001/identity.png");
    const json = JSON.stringify(r.manifest);
    assert.equal(json.includes(tmpRoot), false);
    assert.equal(json.includes("Users"), false);
    assert.ok(r.framing?.video.meetsMin720p);
    assert.equal(r.framing?.video.fullBodySemantic, "requires_human_attestation");
  });

  test("duration out of tolerance → MEDIA_INVALID", () => {
    const videoPath = join(tmpRoot, "bad-duration.mp4");
    const imagePath = join(tmpRoot, "identity-ok.png");
    writeFileSync(videoPath, buildMinimalMp4({ durationSeconds: 3 }));
    writeFileSync(imagePath, buildPng(512, 512));
    const r = validateMv001LocalMedia({
      sourceVideoPath: videoPath,
      identityImagePath: imagePath,
      nowIso: NOW,
    });
    assert.equal(r.verdict, "MEDIA_INVALID");
    assert.ok(r.issues.some((i) => i.startsWith("source_duration_out_of_tolerance")));
  });

  test("resolution below 720p → MEDIA_INVALID", () => {
    const videoPath = join(tmpRoot, "lowres.mp4");
    const imagePath = join(tmpRoot, "identity2.png");
    writeFileSync(
      videoPath,
      buildMinimalMp4({ width: 640, height: 360 }),
    );
    writeFileSync(imagePath, buildPng(512, 512));
    const r = validateMv001LocalMedia({
      sourceVideoPath: videoPath,
      identityImagePath: imagePath,
      nowIso: NOW,
    });
    assert.equal(r.verdict, "MEDIA_INVALID");
    assert.ok(r.issues.some((i) => i.startsWith("source_resolution_below_720p")));
  });

  test("redactPath never returns absolute path", () => {
    assert.equal(
      redactPathToRelativeRole("motion_source_video", "video/mp4"),
      "mv001/source.mp4",
    );
    assert.equal(
      redactPathToRelativeRole("motion_identity_reference", "image/jpeg"),
      "mv001/identity.jpg",
    );
  });
});

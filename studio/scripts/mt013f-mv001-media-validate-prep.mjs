#!/usr/bin/env node
/**
 * MT-013F — Offline MV-001 media validation prep (no upload, no network).
 * Does not read real media unless MV001_PRIVATE_MEDIA_ROOT + manifest path are set.
 * Default: metadata skeleton only → MEDIA_VALIDATED=NO.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", ".tmp");
mkdirSync(outDir, { recursive: true });

const result = {
  ticket: "MT-013F",
  script: "mt013f-mv001-media-validate-prep",
  mediaRead: false,
  mediaValidated: false,
  network: false,
  upload: false,
  note: "Skeleton only — supply private root + Auth before real validate.",
  rolesRequired: ["motion_source_video", "motion_identity_reference"],
  durationTargetSeconds: 3,
  durationToleranceSeconds: 0.25,
  allowedVideoMime: ["video/mp4"],
  allowedImageMime: ["image/png", "image/jpeg", "image/webp"],
};

const out = join(outDir, "mt013f-media-validate-prep.json");
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ok: true, out, ...result }, null, 2));

#!/usr/bin/env node
/**
 * MT-013G — Local MV-001 media validation (no network / no upload).
 *
 *   SOURCE_VIDEO_PATH=... IDENTITY_IMAGE_PATH=... npm exec -- tsx scripts/mt013g-mv001-local-media-validate.ts
 *
 * Writes redacted JSON under studio/.tmp/ (gitignored). Never copies media.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateMv001LocalMedia } from "../src/application/motion/mv001/mv001-local-media-validate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", ".tmp");
mkdirSync(outDir, { recursive: true });

const result = validateMv001LocalMedia({
  sourceVideoPath: process.env.SOURCE_VIDEO_PATH ?? "...",
  identityImagePath: process.env.IDENTITY_IMAGE_PATH ?? "...",
  nowIso: new Date().toISOString(),
});

const outPath = join(outDir, "mt013g-local-media-validate.json");
writeFileSync(outPath, JSON.stringify(result, null, 2));

console.log(
  JSON.stringify(
    {
      ok: result.mediaValidated,
      verdict: result.verdict,
      mediaRead: result.mediaRead,
      mediaValidated: result.mediaValidated,
      issues: result.issues,
      out: ".tmp/mt013g-local-media-validate.json",
      pathRefs: result.pathRefs,
      framing: result.framing,
      checksums: result.manifest
        ? result.manifest.entries.map((e) => ({
            role: e.role,
            sha256: e.checksumSha256,
            mimeType: e.mimeType,
            width: e.width,
            height: e.height,
            durationSeconds: e.durationSeconds,
            fps: e.fps,
            sizeBytes: e.sizeBytes,
            localRelativePath: e.localRelativePath,
            validationStatus: e.validationStatus,
          }))
        : null,
    },
    null,
    2,
  ),
);

if (result.verdict === "BLOCKED_SOURCE_PATHS_REQUIRED") process.exit(2);
if (!result.mediaValidated) process.exit(1);

/**
 * Safe Content-Disposition filename for final media download (VHS-125 fix).
 */

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Strip path traversal / control chars; bound length; align extension with MIME. */
export function buildSafeDownloadFilename(input: {
  projectId: string;
  assetId: string;
  mimeType: string;
}): string {
  const ext = EXT_BY_MIME[input.mimeType] ?? "bin";
  const projectPart = input.projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 8) || "project";
  const assetPart = input.assetId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "asset";
  const name = `vh-final-${projectPart}-${assetPart}.${ext}`;
  // Final guard: no separators / traversal leftovers.
  return name.replace(/[/\\]/g, "").slice(0, 80);
}

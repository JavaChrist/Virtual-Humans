/**
 * generate-file-index.ts
 *
 * Contract (not implemented yet):
 * - Generate a file index of the repository (for example into `generated/indexes/`).
 * - Must not create any file on a simple import: generation only runs when
 *   explicitly invoked.
 * - Must never overwrite authoritative source files.
 *
 * The full implementation is intentionally left as a TODO.
 */

export interface FileIndexEntry {
  path: string;
  type: "file" | "directory";
}

export function generateFileIndex(): FileIndexEntry[] {
  // TODO: implement file index generation.
  return [];
}

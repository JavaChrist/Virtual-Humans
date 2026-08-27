/**
 * Server-only SDK_VERSION reader for GET /api/version.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "@/lib/sdk";

export function readSdkVersionFile(root: string = REPO_ROOT): string | null {
  try {
    const raw = readFileSync(path.join(root, "SDK_VERSION"), "utf8").trim();
    return raw || null;
  } catch {
    return null;
  }
}

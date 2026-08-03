/**
 * Strip internal Storage paths from Director delivery payloads returned to clients.
 * Server-side DB artifacts keep the real path; only API / public JSON is redacted.
 */

const REDACTED = "[redacted]" as const;

function isStoragePathKey(key: string): boolean {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "") === "storagepath";
}

/**
 * Deep-clone JSON-like values and replace every `storagePath` string with `[redacted]`.
 * Never mutates the input.
 */
export function redactDirectorStoragePathsForClient(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactDirectorStoragePathsForClient(item));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isStoragePathKey(key) && typeof child === "string") {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactDirectorStoragePathsForClient(child);
  }
  return out;
}

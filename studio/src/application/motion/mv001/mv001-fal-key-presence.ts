/**
 * MT-013F — FAL_KEY presence check without exposing the value.
 * Never return, log, or stringify the secret.
 */

export type FalKeyPresence = {
  present: boolean;
  /** Always redacted — never the secret. */
  redacted: "[REDACTED]";
};

/**
 * Returns whether FAL_KEY is non-empty. Does not return the value.
 */
export function checkFalKeyPresent(
  env: Record<string, string | undefined> = {},
): FalKeyPresence {
  const raw = env.FAL_KEY;
  const present = typeof raw === "string" && raw.trim().length > 0;
  return { present, redacted: "[REDACTED]" };
}

/** For tests — inject presence without touching process.env.FAL_KEY. */
export function falKeyPresentFromFlag(present: boolean): FalKeyPresence {
  return { present, redacted: "[REDACTED]" };
}

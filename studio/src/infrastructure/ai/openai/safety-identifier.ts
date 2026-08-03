/**
 * Derive a stable, privacy-preserving safety_identifier (VHS-117A).
 * Never use password, email, or raw workspace UUID as the identifier value.
 */

import { createHmac } from "node:crypto";

/**
 * HMAC-SHA256(workspaceId) truncated — stable, non-reversible without secret.
 * Returns undefined when salt or workspace missing (field omitted from request).
 */
export function deriveSafetyIdentifier(input: {
  workspaceId: string | undefined;
  secret: string | undefined;
  purpose?: string;
}): string | undefined {
  const workspaceId = input.workspaceId?.trim();
  const secret = input.secret?.trim();
  if (!workspaceId || !secret) return undefined;
  if (secret.length < 8) return undefined;
  const purpose = input.purpose ?? "vhs-marketing-analyzer";
  return createHmac("sha256", secret)
    .update(`${purpose}:${workspaceId}`)
    .digest("hex")
    .slice(0, 64);
}

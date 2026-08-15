/**
 * Phase 11C — call-time voice locator. Never returns or persists a raw voiceId.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const PHASE_11C_VOICE_SECRET_LOCATOR = "env:ELEVENLABS_VOICE_ID" as const;
export type Phase11CVoiceSecretLocator = typeof PHASE_11C_VOICE_SECRET_LOCATOR;

export function hashVoiceSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function redactVoiceSecret(value: string): string {
  return value
    .replace(/data:[^;\s]+;base64,[A-Za-z0-9+/=]+/gi, "data:[redacted]")
    .replace(/xi-api-key\s*[:=]\s*\S+/gi, "xi-api-key:[redacted]")
    .replace(/[0-9a-zA-Z]{16,}/g, "[redacted-voice]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]");
}

export function readLocatorValue(
  locator: Phase11CVoiceSecretLocator,
  env: Record<string, string | undefined>,
): string {
  if (locator !== PHASE_11C_VOICE_SECRET_LOCATOR) {
    throw new Error("Phase 11C voice locator: unsupported locator.");
  }
  return String(env.ELEVENLABS_VOICE_ID ?? "").trim();
}

export function verifyConfiguredVoiceFingerprint(input: {
  locator: Phase11CVoiceSecretLocator;
  env: Record<string, string | undefined>;
  expectedFingerprint?: string;
}): {
  present: boolean;
  matches: boolean | null;
  fingerprintPrefix: string | null;
  valueExposed: false;
} {
  const raw = readLocatorValue(input.locator, input.env);
  if (!raw) {
    return { present: false, matches: false, fingerprintPrefix: null, valueExposed: false };
  }
  const fingerprint = hashVoiceSecret(raw);
  return {
    present: true,
    matches: input.expectedFingerprint ? fingerprint === input.expectedFingerprint : null,
    fingerprintPrefix: fingerprint.slice(0, 12),
    valueExposed: false,
  };
}

export function fingerprintCharacterSdkVoices(repoRoot: string): {
  tom: string | null;
  mei: string | null;
} {
  const readId = (relative: string): string | null => {
    const path = join(repoRoot, relative);
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { voiceId?: string };
    const id = String(parsed.voiceId ?? "").trim();
    return id ? hashVoiceSecret(id) : null;
  };
  return {
    tom: readId(join("characters", "Tom SDK v1.0.0", "voice", "config.json")),
    mei: readId(join("characters", "Mei SDK v1.0.0", "voice", "config.json")),
  };
}

export function detectCharacterVoiceCollision(
  fingerprint: string,
  characters: { tom?: string | null; mei?: string | null },
): "tom" | "mei" | null {
  if (characters.tom && fingerprint === characters.tom) return "tom";
  if (characters.mei && fingerprint === characters.mei) return "mei";
  return null;
}

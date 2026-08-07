/**
 * Shared Brief.characterId → CharacterCapabilitiesSnapshot resolution.
 * Uses the unique Runtime CharacterRegistry — no parallel catalog.
 *
 * Brief may store UI/legacy folder names (e.g. "Tom SDK v1.0.0"); the snapshot
 * always carries the canonical technical characterId ("tom").
 */

import { createHash } from "node:crypto";
import type { VideoProjectBrief } from "@/domain/brief";
import type { CharacterCapabilitiesSnapshot } from "@/domain/art";
import { CharacterNotFoundError, CharacterRuntimeError } from "@/runtime/errors";
import { characterRegistry } from "@/runtime/character";
import {
  buildCharacterCapabilitiesSnapshot,
  type RuntimeCharacterCapabilitySource,
} from "./character-capabilities";

/**
 * Minimal lookup surface (injectable for unit tests).
 * Production default: Runtime CharacterRegistry — the single character source of truth.
 *
 * Future consumers (Storyboard / Prompt / Production directors) should reuse this
 * helper rather than wiring a second registry or hardcoding Tom/Mei.
 */
export type CharacterPackageLookup = {
  getCharacter(requestedId: string): RuntimeCharacterCapabilitySource;
};

export type ResolvedCharacterCapabilities = {
  /** Brief with characterId normalized to the canonical technical id. */
  brief: VideoProjectBrief;
  snapshot: CharacterCapabilitiesSnapshot;
  /** Stable fingerprint for Art idempotency (character + capability identity). */
  identityFingerprint: string;
};

export type ResolveCharacterCapabilitiesResult =
  | { status: "none" }
  | { status: "resolved"; value: ResolvedCharacterCapabilities }
  | {
      status: "not_found";
      requestedId: string;
      publicMessage: string;
    }
  | {
      status: "invalid";
      requestedId: string;
      publicMessage: string;
      code: string;
    };

/**
 * Deterministic fingerprint of a capability snapshot for run identity.
 * Changes when character id, version, or available asset ids change.
 */
export function characterCapabilitiesIdentityFingerprint(
  snapshot: CharacterCapabilitiesSnapshot,
): string {
  const assetIds = [
    ...snapshot.availableOutfits.map((a) => `o:${a.id}`),
    ...snapshot.availableExpressions.map((a) => `e:${a.id}`),
    ...snapshot.availablePoses.map((a) => `p:${a.id}`),
    ...snapshot.availableReferences.map((a) => `r:${a.id}`),
  ]
    .sort()
    .join(",");
  const raw = [
    snapshot.characterId,
    snapshot.snapshotVersion,
    snapshot.supportsVoiceReference ? "voice:1" : "voice:0",
    assetIds,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Resolve optional Brief.characterId against the Runtime CharacterRegistry.
 * Fail-closed: unknown ids never fall back to Tom/Mei/default.
 */
export function resolveCharacterCapabilitiesForBrief(
  brief: VideoProjectBrief,
  lookup: CharacterPackageLookup = characterRegistry,
): ResolveCharacterCapabilitiesResult {
  const requested = brief.characterId?.trim();
  if (!requested) return { status: "none" };

  let pkg: RuntimeCharacterCapabilitySource;
  try {
    pkg = lookup.getCharacter(requested);
  } catch (error) {
    if (error instanceof CharacterNotFoundError) {
      return {
        status: "not_found",
        requestedId: requested,
        publicMessage: `Personnage introuvable pour « ${requested} ».`,
      };
    }
    if (error instanceof CharacterRuntimeError) {
      return {
        status: "invalid",
        requestedId: requested,
        publicMessage: `Package personnage invalide pour « ${requested} ».`,
        code: error.code,
      };
    }
    throw error;
  }

  const snapshot = buildCharacterCapabilitiesSnapshot(pkg);
  // Readiness compares snapshot.characterId === brief.characterId strictly.
  const normalizedBrief: VideoProjectBrief = {
    ...brief,
    characterId: pkg.characterId,
  };

  return {
    status: "resolved",
    value: {
      brief: normalizedBrief,
      snapshot,
      identityFingerprint: characterCapabilitiesIdentityFingerprint(snapshot),
    },
  };
}

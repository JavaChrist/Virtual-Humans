/**
 * Pure adapter: Runtime character package → domain CharacterCapabilitiesSnapshot.
 * No disk I/O, no fetch, no React. Does not mutate the Runtime SDK.
 */

import {
  CHARACTER_CAPABILITIES_SNAPSHOT_VERSION,
  type CharacterCapabilitiesSnapshot,
  type RuntimeAssetCapability,
  type RuntimeReferenceCapability,
} from "@/domain/art";

/** Minimal Runtime surface required to build a snapshot (paths ignored). */
export type RuntimeCharacterCapabilitySource = {
  characterId: string;
  characterVersion?: string | null;
  outfits: Array<{
    id: string;
    name: string;
    style?: string[];
    locations?: string[];
    bestFor?: string[];
  }>;
  expressions: Array<{ name: string }>;
  poses: Array<{ name: string }>;
  identityReferences: Array<{ name: string }>;
  voice: { present: boolean };
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function dedupeAssets(items: RuntimeAssetCapability[]): RuntimeAssetCapability[] {
  const seen = new Set<string>();
  const out: RuntimeAssetCapability[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({
      id: item.id,
      label: item.label.trim() || item.id,
      tags: [...new Set(item.tags.map((t) => t.trim()).filter(Boolean))],
    });
  }
  return out;
}

function fromNamed(name: string, prefix: string): RuntimeAssetCapability {
  const id = `${prefix}:${slugify(name) || "unnamed"}`;
  return { id, label: name.trim() || id, tags: [] };
}

/**
 * Build a serializable, domain-safe capability snapshot from an in-memory Runtime package.
 * Relies only on exposed ids/names/tags — never copies relPath, lookPath, thumbPath, or voice secrets.
 */
export function buildCharacterCapabilitiesSnapshot(
  runtimeCharacter: RuntimeCharacterCapabilitySource,
): CharacterCapabilitiesSnapshot {
  const outfits = dedupeAssets(
    runtimeCharacter.outfits.map((o) => ({
      id: o.id.trim(),
      label: o.name.trim() || o.id.trim(),
      tags: [
        ...(o.style ?? []),
        ...(o.locations ?? []),
        ...(o.bestFor ?? []),
      ]
        .map((t) => String(t).trim())
        .filter(Boolean),
    })),
  );

  const expressions = dedupeAssets(
    runtimeCharacter.expressions.map((e) => fromNamed(e.name, "expression")),
  );
  const poses = dedupeAssets(runtimeCharacter.poses.map((p) => fromNamed(p.name, "pose")));
  const availableReferences: RuntimeReferenceCapability[] = dedupeAssets(
    runtimeCharacter.identityReferences.map((r) => fromNamed(r.name, "reference")),
  );

  const snapshot: CharacterCapabilitiesSnapshot = {
    characterId: runtimeCharacter.characterId.trim(),
    snapshotVersion:
      runtimeCharacter.characterVersion?.trim() || CHARACTER_CAPABILITIES_SNAPSHOT_VERSION,
    availableOutfits: outfits,
    availableExpressions: expressions,
    availablePoses: poses,
    availableReferences,
    supportsVoiceReference: Boolean(runtimeCharacter.voice?.present),
  };

  return JSON.parse(JSON.stringify(snapshot)) as CharacterCapabilitiesSnapshot;
}

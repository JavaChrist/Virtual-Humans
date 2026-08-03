/**
 * Canonical Runtime capability snapshot for Art Director (domain-safe).
 * No disk paths, signed URLs, binaries, or provider voice params.
 */

export const CHARACTER_CAPABILITIES_SNAPSHOT_VERSION = "1.0.0" as const;

export type RuntimeAssetCapability = {
  id: string;
  label: string;
  tags: string[];
};

export type RuntimeReferenceCapability = {
  id: string;
  label: string;
  tags: string[];
};

export type CharacterCapabilitiesSnapshot = {
  characterId: string;
  snapshotVersion: string;
  availableOutfits: RuntimeAssetCapability[];
  availableExpressions: RuntimeAssetCapability[];
  availablePoses: RuntimeAssetCapability[];
  availableReferences: RuntimeReferenceCapability[];
  supportsVoiceReference: boolean;
};

export type CharacterDirection = {
  characterId: string;
  outfitId?: string;
  expressionId?: string;
  poseId?: string;
  referenceId?: string;
  framingIntent: string;
};

export function findAsset(
  list: RuntimeAssetCapability[],
  id: string | undefined,
): RuntimeAssetCapability | undefined {
  if (!id) return undefined;
  return list.find((a) => a.id === id);
}

export function assertAssetAvailable(
  list: RuntimeAssetCapability[],
  id: string | undefined,
  kind: string,
): string | undefined {
  if (!id) return undefined;
  if (!list.some((a) => a.id === id)) {
    return `Asset ${kind} introuvable dans le snapshot: ${id}`;
  }
  return undefined;
}

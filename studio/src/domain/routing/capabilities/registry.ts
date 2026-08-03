/**
 * Capability registry snapshot (VHS-107).
 * Immutable after build; lookups never mutate.
 */

import type { CapabilityProfile } from "@/domain/prompt";
import { isExpired } from "./availability";
import { CapabilityDomainError } from "./errors";
import {
  canonicalModelKey,
  supportsCapabilityProfile,
  type ModelCapabilities,
  type ModelId,
} from "./model";
import type { ProviderDefinition, ProviderId } from "./provider";
import { validateRegistrySnapshot, assertSerializable } from "./validation";

export const CAPABILITY_REGISTRY_SCHEMA_VERSION = "1.0.0" as const;

export type RegistryVersion = string;

export type CapabilityRegistrySnapshot = {
  schemaVersion: string;
  registryVersion: RegistryVersion;
  createdAt: string;
  expiresAt?: string;
  providers: ProviderDefinition[];
  models: ModelCapabilities[];
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) {
      deepFreeze(v);
    }
  }
  return value;
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type BuildRegistrySnapshotInput = {
  providers: ProviderDefinition[];
  models: ModelCapabilities[];
  createdAt: string;
  registryVersion: string;
  expiresAt?: string;
  schemaVersion?: string;
};

/**
 * Build an immutable, ordered, validated registry snapshot.
 * Does not read env, probe providers, or invent availability.
 */
export function buildRegistrySnapshot(
  input: BuildRegistrySnapshotInput,
): CapabilityRegistrySnapshot {
  const providers = [...input.providers].sort((a, b) => compareId(a.id, b.id));
  const models = [...input.models].sort((a, b) => {
    const c = compareId(a.providerId, b.providerId);
    return c !== 0 ? c : compareId(a.modelId, b.modelId);
  });

  const raw: CapabilityRegistrySnapshot = {
    schemaVersion: input.schemaVersion ?? CAPABILITY_REGISTRY_SCHEMA_VERSION,
    registryVersion: input.registryVersion,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    providers,
    models,
  };

  assertSerializable(raw);
  const validated = validateRegistrySnapshot(raw);
  return deepFreeze(structuredClone(validated));
}

export function findProvider(
  snapshot: CapabilityRegistrySnapshot,
  providerId: ProviderId,
): ProviderDefinition | undefined {
  return snapshot.providers.find((p) => p.id === providerId);
}

export function findModel(
  snapshot: CapabilityRegistrySnapshot,
  providerId: ProviderId,
  modelId: ModelId,
): ModelCapabilities | undefined {
  const key = canonicalModelKey(providerId, modelId);
  return snapshot.models.find(
    (m) => canonicalModelKey(m.providerId, m.modelId) === key,
  );
}

export function listModelsForProfile(
  snapshot: CapabilityRegistrySnapshot,
  profile: CapabilityProfile,
): ModelCapabilities[] {
  return snapshot.models.filter((m) => supportsCapabilityProfile(m, profile));
}

export function assertSnapshotFresh(
  snapshot: CapabilityRegistrySnapshot,
  at: string,
): void {
  if (isExpired(snapshot.expiresAt, at)) {
    throw new CapabilityDomainError(
      "snapshot_expired",
      "Capability registry snapshot has expired.",
    );
  }
}

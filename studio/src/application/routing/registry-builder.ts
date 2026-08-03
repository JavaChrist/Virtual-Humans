/**
 * Application composition for capability registry (VHS-107).
 * Pure merge by explicit keys — no env reads, no provider probes.
 */

import {
  buildRegistrySnapshot,
  CapabilityDomainError,
  type CapabilityRegistrySnapshot,
  type ModelCapabilities,
  type ProviderDefinition,
  type PricingDefinition,
} from "@/domain/routing/capabilities";

export type BuildCapabilityRegistryInput = {
  providers: ProviderDefinition[];
  models: ModelCapabilities[];
  /** Optional pricing overlays merged by pricing id onto matching models. */
  pricing?: Array<{ providerId: string; modelId: string; lines: PricingDefinition[] }>;
  createdAt: string;
  registryVersion: string;
  expiresAt?: string;
};

/**
 * Compose a frozen registry. Refuses duplicates and orphan models.
 */
export function buildCapabilityRegistry(
  input: BuildCapabilityRegistryInput,
): CapabilityRegistrySnapshot {
  const providerIds = new Set<string>();
  for (const p of input.providers) {
    if (providerIds.has(p.id)) {
      throw new CapabilityDomainError(
        "duplicate_provider",
        "Duplicate provider in registry builder input.",
        p.id,
      );
    }
    providerIds.add(p.id);
  }

  const modelKeys = new Set<string>();
  const models = input.models.map((m) => {
    const key = `${m.providerId}::${m.modelId}`;
    if (modelKeys.has(key)) {
      throw new CapabilityDomainError(
        "duplicate_model",
        "Duplicate model in registry builder input.",
        key,
      );
    }
    modelKeys.add(key);
    if (!providerIds.has(m.providerId)) {
      throw new CapabilityDomainError(
        "orphan_model",
        "Model references unknown provider.",
        key,
      );
    }
    // External id collision across models of same provider
    if (m.externalModelId) {
      const clash = input.models.find(
        (other) =>
          other !== m &&
          other.providerId === m.providerId &&
          other.externalModelId === m.externalModelId &&
          other.modelId !== m.modelId,
      );
      if (clash) {
        throw new CapabilityDomainError(
          "duplicate_model",
          "externalModelId collision within provider.",
          m.externalModelId,
        );
      }
    }
    return { ...m };
  });

  if (input.pricing) {
    for (const overlay of input.pricing) {
      const idx = models.findIndex(
        (m) => m.providerId === overlay.providerId && m.modelId === overlay.modelId,
      );
      if (idx < 0) {
        throw new CapabilityDomainError(
          "unknown_model",
          "Pricing overlay targets unknown model.",
          `${overlay.providerId}::${overlay.modelId}`,
        );
      }
      const target = models[idx]!;
      const ids = new Set(target.pricing.map((p) => p.id));
      for (const line of overlay.lines) {
        if (ids.has(line.id)) {
          throw new CapabilityDomainError(
            "duplicate_model",
            "Duplicate pricing line id on model.",
            line.id,
          );
        }
        ids.add(line.id);
      }
      models[idx] = {
        ...target,
        pricing: [...target.pricing, ...overlay.lines],
      };
    }
  }

  // Builder must not invent quality scores
  for (const m of models) {
    if (Object.keys(m.quality).length > 0) {
      // scores allowed only if already present with evidence — validated by schema
    }
  }

  return buildRegistrySnapshot({
    providers: input.providers,
    models,
    createdAt: input.createdAt,
    registryVersion: input.registryVersion,
    expiresAt: input.expiresAt,
  });
}

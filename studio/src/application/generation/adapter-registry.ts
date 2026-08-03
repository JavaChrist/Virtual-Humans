/**
 * ProviderAdapterRegistry — executes; distinct from Capability Registry (VHS-109).
 */

import type { MediaAction } from "@/domain/cost";
import {
  GenerationDomainError,
  type ProviderAdapter,
} from "@/domain/generation";

export interface ProviderAdapterRegistry {
  resolve(providerId: string, modelId: string, action: MediaAction): ProviderAdapter;
  list(): readonly ProviderAdapter[];
}

export function createProviderAdapterRegistry(
  adapters: ProviderAdapter[],
): ProviderAdapterRegistry {
  const byProvider = new Map<string, ProviderAdapter>();
  for (const a of adapters) {
    if (byProvider.has(a.providerId)) {
      throw new GenerationDomainError(
        "invalid_input",
        "Duplicate provider adapter registration.",
        { diagnostic: a.providerId },
      );
    }
    byProvider.set(a.providerId, a);
  }

  const sorted = [...adapters].sort((a, b) => a.providerId.localeCompare(b.providerId));

  return {
    list() {
      return sorted;
    },
    resolve(providerId, modelId, action) {
      const adapter = byProvider.get(providerId);
      if (!adapter) {
        throw new GenerationDomainError("adapter_not_found", "No adapter for provider.", {
          providerId,
          modelId,
        });
      }
      if (!adapter.supports(modelId, action)) {
        throw new GenerationDomainError(
          "model_not_supported",
          "Adapter does not support model/action.",
          { providerId, modelId },
        );
      }
      return adapter;
    },
  };
}

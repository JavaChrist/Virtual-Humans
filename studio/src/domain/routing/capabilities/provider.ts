/**
 * Provider definition (VHS-107).
 * status: unknown unless a reliable check exists — never inferred from code presence.
 */

import { CapabilityDomainError } from "./errors";

export const RegionCodeValues = ["eu", "us", "global", "unknown"] as const;
export type RegionCode = (typeof RegionCodeValues)[number];

export const ProviderStatusValues = [
  "available",
  "degraded",
  "unavailable",
  "unknown",
] as const;
export type ProviderStatus = (typeof ProviderStatusValues)[number];

export type ProviderId = string;

export type ProviderDefinition = {
  id: ProviderId;
  displayName: string;
  adapterKind: string;
  enabled: boolean;
  regions: RegionCode[];
  dataResidency?: RegionCode[];
  supportsIdempotency: boolean;
  supportsCancellation: boolean;
  supportsWebhooks: boolean;
  status: ProviderStatus;
  statusCheckedAt?: string;
};

export const PROVIDER_ID_MAX = 64;
export const PROVIDER_DISPLAY_MAX = 120;
export const ADAPTER_KIND_MAX = 64;

const ID_RE = /^[a-z][a-z0-9._-]{0,63}$/;

export function normalizeProviderId(raw: string): ProviderId {
  const id = raw.trim().toLowerCase();
  if (!id || id.length > PROVIDER_ID_MAX || !ID_RE.test(id)) {
    throw new CapabilityDomainError(
      "invalid_identifier",
      "Invalid provider identifier.",
      `providerId=${raw}`,
    );
  }
  return id;
}

/** Pure normalize without throw for schemas — returns null if invalid. */
export function tryNormalizeProviderId(raw: string): ProviderId | null {
  const id = raw.trim().toLowerCase();
  if (!id || id.length > PROVIDER_ID_MAX || !ID_RE.test(id)) return null;
  return id;
}

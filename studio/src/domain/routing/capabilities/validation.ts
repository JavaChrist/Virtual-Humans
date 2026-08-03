/**
 * Validation helpers for capability registry (VHS-107).
 */

import { CapabilityDomainError } from "./errors";
import type { ModelCapabilities } from "./model";
import type { PricingDefinition } from "./pricing";
import type { ProviderDefinition } from "./provider";
import {
  CapabilityRegistrySnapshotSchema,
  ModelCapabilitiesSchema,
  PricingDefinitionSchema,
  ProviderDefinitionSchema,
  type CapabilityRegistrySnapshotParsed,
} from "./schemas";

export function validateProvider(input: unknown): ProviderDefinition {
  const parsed = ProviderDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDomainError(
      "invalid_capability",
      "Invalid provider definition.",
      parsed.error.issues[0]?.message,
    );
  }
  return parsed.data;
}

export function validateModel(input: unknown): ModelCapabilities {
  const parsed = ModelCapabilitiesSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDomainError(
      "invalid_capability",
      "Invalid model capabilities.",
      parsed.error.issues[0]?.message,
    );
  }
  return parsed.data as ModelCapabilities;
}

export function validatePricing(input: unknown): PricingDefinition {
  const parsed = PricingDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDomainError(
      "invalid_pricing",
      "Invalid pricing definition.",
      parsed.error.issues[0]?.message,
    );
  }
  return parsed.data;
}

export function validateRegistrySnapshot(input: unknown): CapabilityRegistrySnapshotParsed {
  const parsed = CapabilityRegistrySnapshotSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "invalid";
    let code: import("./errors").CapabilityErrorCode = "invalid_snapshot";
    if (msg.includes("duplicate provider")) code = "duplicate_provider";
    else if (msg.includes("duplicate model")) code = "duplicate_model";
    else if (msg.includes("orphan")) code = "orphan_model";
    else if (msg.includes("expiresAt")) code = "invalid_snapshot";
    throw new CapabilityDomainError(code, "Invalid capability registry snapshot.", msg);
  }
  return parsed.data;
}

/** Ensure value is JSON-serializable (no functions, undefined in arrays, bigint, etc.). */
export function assertSerializable(value: unknown, path = "root"): void {
  const t = typeof value;
  if (value === null || t === "string" || t === "boolean") return;
  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new CapabilityDomainError("non_serializable", "Non-finite number.", path);
    }
    return;
  }
  if (t === "undefined" || t === "function" || t === "symbol" || t === "bigint") {
    throw new CapabilityDomainError("non_serializable", "Value is not JSON-serializable.", path);
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertSerializable(v, `${path}[${i}]`));
    return;
  }
  if (t === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue; // omitted in JSON
      assertSerializable(v, `${path}.${k}`);
    }
  }
}

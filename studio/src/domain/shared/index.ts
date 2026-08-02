/**
 * Domain shared primitives — V2 foundation (VHS-003).
 * No React, no Supabase, no provider SDKs.
 */

export {
  ARTIFACT_METADATA_SCHEMA_VERSION,
  ArtifactMetadataSchema,
  DomainIdSchema,
  RevisionSchema,
  SchemaVersionSchema,
  createArtifactMetadata,
  parseArtifactMetadata,
  safeParseArtifactMetadata,
  type ArtifactMetadata,
  type DomainId,
  type Revision,
  type SchemaVersion,
} from "./artifact";

export {
  CostCentsSchema,
  CurrencyCodeSchema,
  DurationMsSchema,
  IsoDateTimeSchema,
  MoneySchema,
  centsToUsd,
  usdToCents,
  type CostCents,
  type CurrencyCode,
  type DurationMs,
  type IsoDateTime,
  type Money,
} from "./units";

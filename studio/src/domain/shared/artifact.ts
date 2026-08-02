import { z } from "zod";
import { IsoDateTimeSchema } from "./units";

/**
 * Shared artifact metadata for every persisted V2 domain object.
 * Source: docs/Developer-Handover/02_ARCHITECTURE.md § Identité et versionnement
 *
 * Artifacts are immutable and append-only. A correction creates a new revision;
 * the active revision is designated explicitly by the project root.
 */

/** Semver-like schema version for a domain contract (e.g. "1.0.0"). */
export const SchemaVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "schemaVersion must be semver MAJOR.MINOR.PATCH");
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

/** Positive integer revision (1-based). */
export const RevisionSchema = z.number().int().positive();
export type Revision = z.infer<typeof RevisionSchema>;

/**
 * Opaque stable identifiers. UUIDs are preferred; non-empty strings allowed
 * so early local/dev fixtures remain valid before Supabase persistence.
 */
export const DomainIdSchema = z.string().min(1).max(128);
export type DomainId = z.infer<typeof DomainIdSchema>;

/**
 * Metadata present on every persisted domain artifact.
 * Does not include business payload — compose with specific schemas.
 */
export const ArtifactMetadataSchema = z.object({
  id: DomainIdSchema,
  projectId: DomainIdSchema,
  schemaVersion: SchemaVersionSchema,
  revision: RevisionSchema,
  createdAt: IsoDateTimeSchema,
  createdBy: DomainIdSchema,
  correlationId: DomainIdSchema,
});
export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;

/** Current schema version for ArtifactMetadata itself. */
export const ARTIFACT_METADATA_SCHEMA_VERSION = "1.0.0" as const satisfies SchemaVersion;

/**
 * Parse and validate artifact metadata. Throws ZodError on invalid input.
 */
export function parseArtifactMetadata(input: unknown): ArtifactMetadata {
  return ArtifactMetadataSchema.parse(input);
}

/**
 * Safe parse helper for boundaries (API, storage).
 */
export function safeParseArtifactMetadata(input: unknown) {
  return ArtifactMetadataSchema.safeParse(input);
}

/**
 * Build metadata for a new artifact revision.
 * Caller supplies identity fields; timestamps default to now (UTC).
 */
export function createArtifactMetadata(input: {
  id: string;
  projectId: string;
  createdBy: string;
  correlationId: string;
  revision?: number;
  schemaVersion?: SchemaVersion;
  createdAt?: string;
}): ArtifactMetadata {
  return parseArtifactMetadata({
    id: input.id,
    projectId: input.projectId,
    schemaVersion: input.schemaVersion ?? ARTIFACT_METADATA_SCHEMA_VERSION,
    revision: input.revision ?? 1,
    createdAt: input.createdAt ?? new Date().toISOString(),
    createdBy: input.createdBy,
    correlationId: input.correlationId,
  });
}

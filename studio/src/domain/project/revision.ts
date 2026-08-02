import { IsoDateTimeSchema, type DomainId, type SchemaVersion } from "@/domain/shared";
import { isArtifactType, type ArtifactType } from "./artifact-types";
import { ProjectDomainError } from "./errors";

export const REVISION_SCHEMA_VERSION = "1.0.0" as const;

export type RevisionReason =
  | "initial"
  | "correction"
  | "regeneration"
  | "approval_change"
  | "system";

export type Revision<T> = {
  id: DomainId;
  projectId: DomainId;
  artifactType: ArtifactType;
  revision: number;
  schemaVersion: SchemaVersion;
  value: Readonly<T>;
  createdAt: string;
  createdBy: DomainId;
  correlationId: DomainId;
  parentRevisionId?: DomainId;
  reason?: RevisionReason;
};

export type ActiveRevision = {
  projectId: DomainId;
  artifactType: ArtifactType;
  revisionId: DomainId;
  revision: number;
  updatedAt: string;
  updatedBy: DomainId;
};

const MAX_JSON_BYTES = 512_000;

function assertSerializableShape(value: unknown, seen = new WeakSet<object>()): void {
  if (value === undefined) {
    throw new ProjectDomainError("non_serializable_value", "Revision value cannot be undefined.");
  }
  const t = typeof value;
  if (t === "function" || t === "symbol" || t === "bigint") {
    throw new ProjectDomainError(
      "non_serializable_value",
      "Revision value contains a non-serializable type.",
    );
  }
  if (value === null || t !== "object") return;

  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new ProjectDomainError(
      "non_serializable_value",
      "Revision value contains a non-serializable object type.",
    );
  }
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) assertSerializableShape(item, seen);
    return;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    assertSerializableShape(item, seen);
  }
}

/**
 * Ensure value is JSON-serializable (no Date, Map, Set, function, bigint).
 * Returns a deep-frozen structured clone via JSON round-trip.
 */
export function freezeSerializableValue<T>(value: T): Readonly<T> {
  assertSerializableShape(value);

  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new ProjectDomainError("non_serializable_value", "Revision value is not serializable.");
  }

  if (json === undefined) {
    throw new ProjectDomainError("non_serializable_value", "Revision value is not serializable.");
  }
  if (json.length > MAX_JSON_BYTES) {
    throw new ProjectDomainError("non_serializable_value", "Revision value exceeds size limits.");
  }

  const cloned = JSON.parse(json) as T;
  return deepFreeze(cloned);
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj as object)) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

function assertIso(createdAt: string): void {
  if (!IsoDateTimeSchema.safeParse(createdAt).success) {
    throw new ProjectDomainError("invalid_argument", "createdAt must be a valid UTC ISO-8601 timestamp.", {
      field: "createdAt",
    });
  }
}

function assertId(id: string, field: string): void {
  if (typeof id !== "string" || id.trim().length === 0 || id.length > 128) {
    throw new ProjectDomainError("invalid_argument", `Invalid ${field}.`, { field });
  }
}

export type CreateInitialRevisionInput<T> = {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  value: T;
  createdBy: string;
  correlationId: string;
  createdAt?: string;
  schemaVersion?: SchemaVersion;
  reason?: RevisionReason;
};

/** First revision is always numbered 1. */
export function createInitialRevision<T>(input: CreateInitialRevisionInput<T>): Revision<T> {
  if (!isArtifactType(input.artifactType)) {
    throw new ProjectDomainError("incompatible_artifact", "Unknown artifact type.");
  }
  assertId(input.id, "id");
  assertId(input.projectId, "projectId");
  assertId(input.createdBy, "createdBy");
  assertId(input.correlationId, "correlationId");
  const createdAt = input.createdAt ?? new Date().toISOString();
  assertIso(createdAt);

  return Object.freeze({
    id: input.id,
    projectId: input.projectId,
    artifactType: input.artifactType,
    revision: 1,
    schemaVersion: input.schemaVersion ?? REVISION_SCHEMA_VERSION,
    value: freezeSerializableValue(input.value),
    createdAt,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    reason: input.reason ?? "initial",
  });
}

export type CreateNextRevisionInput<T> = {
  id: string;
  parent: Revision<unknown>;
  value: T;
  createdBy: string;
  correlationId: string;
  createdAt?: string;
  reason?: RevisionReason;
  schemaVersion?: SchemaVersion;
};

/** Next revision: strictly increasing, same project/type, parent link required. */
export function createNextRevision<T>(input: CreateNextRevisionInput<T>): Revision<T> {
  assertId(input.id, "id");
  assertId(input.createdBy, "createdBy");
  assertId(input.correlationId, "correlationId");
  if (input.id === input.parent.id) {
    throw new ProjectDomainError("invalid_revision_chain", "Next revision id must differ from parent.");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  assertIso(createdAt);

  return Object.freeze({
    id: input.id,
    projectId: input.parent.projectId,
    artifactType: input.parent.artifactType,
    revision: input.parent.revision + 1,
    schemaVersion: input.schemaVersion ?? input.parent.schemaVersion,
    value: freezeSerializableValue(input.value),
    createdAt,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    parentRevisionId: input.parent.id,
    reason: input.reason ?? "correction",
  });
}

/**
 * Validate an ordered chain (revision 1..n, parent links, same project/type).
 * Throws on any inconsistency — never silently repairs.
 */
export function validateRevisionChain(revisions: readonly Revision<unknown>[]): void {
  if (revisions.length === 0) {
    throw new ProjectDomainError("invalid_revision_chain", "Revision chain is empty.");
  }

  const sorted = [...revisions].sort((a, b) => a.revision - b.revision);
  const byId = new Map(sorted.map((r) => [r.id, r]));

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const expected = i + 1;
    if (r.revision !== expected) {
      throw new ProjectDomainError("invalid_revision_chain", "Revision numbers must be contiguous and increasing.", {
        expected,
        actual: r.revision,
      });
    }
    if (i === 0) {
      if (r.parentRevisionId) {
        throw new ProjectDomainError("invalid_revision_chain", "Initial revision must not have a parent.");
      }
    } else {
      const prev = sorted[i - 1];
      if (r.projectId !== prev.projectId || r.artifactType !== prev.artifactType) {
        throw new ProjectDomainError(
          "incompatible_artifact",
          "Revision chain project or artifact type mismatch.",
          { projectId: r.projectId, artifactType: r.artifactType },
        );
      }
      if (r.parentRevisionId !== prev.id) {
        throw new ProjectDomainError("invalid_revision_chain", "Parent revision link is incorrect.", {
          revision: r.revision,
        });
      }
      if (!byId.has(r.parentRevisionId!)) {
        throw new ProjectDomainError("revision_not_found", "Parent revision was not found in the chain.");
      }
      if (r.revision <= prev.revision) {
        throw new ProjectDomainError("invalid_revision_chain", "Revision numbers must be strictly increasing.");
      }
    }
  }
}

/**
 * Point the active revision pointer at `target` if expectedRevision matches current.
 * Never mutates historical artifacts.
 */
export function activateRevision(
  current: ActiveRevision | null,
  target: Revision<unknown>,
  expectedRevision: number | null,
): ActiveRevision {
  if (current) {
    if (current.projectId !== target.projectId || current.artifactType !== target.artifactType) {
      throw new ProjectDomainError(
        "incompatible_artifact",
        "Cannot activate a revision from a different project or artifact type.",
      );
    }
    if (expectedRevision !== null && current.revision !== expectedRevision) {
      throw new ProjectDomainError(
        "version_conflict",
        "Active revision pointer is out of date.",
        {
          expectedRevision,
          actualRevision: current.revision,
          resourceType: current.artifactType,
          resourceId: current.revisionId,
        },
      );
    }
  } else if (expectedRevision !== null && expectedRevision !== 0) {
    // null current expects 0 (no prior active) when provided
    throw new ProjectDomainError("version_conflict", "Active revision pointer is out of date.", {
      expectedRevision,
      actualRevision: 0,
      resourceType: target.artifactType,
      resourceId: target.id,
    });
  }

  return Object.freeze({
    projectId: target.projectId,
    artifactType: target.artifactType,
    revisionId: target.id,
    revision: target.revision,
    updatedAt: new Date().toISOString(),
    updatedBy: target.createdBy,
  });
}

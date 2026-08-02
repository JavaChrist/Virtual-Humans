import { IsoDateTimeSchema } from "@/domain/shared";
import { ProjectDomainError } from "./errors";

export type VersionToken = {
  revision: number;
  updatedAt: string;
};

export type OptimisticWrite<T> = {
  expectedRevision: number;
  value: T;
};

export type OptimisticUpdateResult<T> = {
  value: T;
  token: VersionToken;
};

/**
 * Assert that the caller's expected revision matches the resource's current revision.
 * Error details contain only expected/actual revision + resource identity — never payload.
 */
export function assertExpectedRevision(
  expectedRevision: number,
  actualRevision: number,
  resourceType: string,
  resourceId: string,
): void {
  if (
    !Number.isInteger(expectedRevision) ||
    !Number.isInteger(actualRevision) ||
    expectedRevision < 0 ||
    actualRevision < 0
  ) {
    throw new ProjectDomainError("invalid_argument", "Revision numbers must be non-negative integers.");
  }
  if (expectedRevision !== actualRevision) {
    throw new ProjectDomainError("version_conflict", "Optimistic lock conflict.", {
      expectedRevision,
      actualRevision,
      resourceType,
      resourceId,
    });
  }
}

/**
 * Pure optimistic update: verify expected revision, return next value + new token.
 * Does not persist — the future repository must apply this atomically.
 */
export function applyOptimisticUpdate<T>(input: {
  resourceType: string;
  resourceId: string;
  currentRevision: number;
  currentUpdatedAt: string;
  write: OptimisticWrite<T>;
  updatedAt?: string;
}): OptimisticUpdateResult<T> {
  assertExpectedRevision(
    input.write.expectedRevision,
    input.currentRevision,
    input.resourceType,
    input.resourceId,
  );

  const updatedAt = input.updatedAt ?? new Date().toISOString();
  if (!IsoDateTimeSchema.safeParse(updatedAt).success) {
    throw new ProjectDomainError("invalid_argument", "updatedAt must be a valid UTC ISO-8601 timestamp.");
  }

  // Defensive: currentUpdatedAt should also be valid if provided
  if (input.currentUpdatedAt && !IsoDateTimeSchema.safeParse(input.currentUpdatedAt).success) {
    throw new ProjectDomainError("invalid_argument", "currentUpdatedAt is invalid.");
  }

  return {
    value: input.write.value,
    token: Object.freeze({
      revision: input.currentRevision + 1,
      updatedAt,
    }),
  };
}

/**
 * Application-level Director project quota (phase 187).
 *
 * Scoped to workspace_id. Archived projects (archived_at IS NOT NULL) do not
 * consume a slot. Replay of an existing projectId is allowed even at quota.
 *
 * This guard is check-then-act, not a database unique constraint. Two concurrent
 * creates of distinct IDs can theoretically both pass a count of 49 and produce
 * 51 rows. Residual race is accepted for single-tenant shared-password; it does
 * not block persistence enablement and is not an atomic guarantee.
 */

export const DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE = 50 as const;
export const DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE =
  "director_project_quota_exceeded" as const;
export const DIRECTOR_PROJECT_QUOTA_PUBLIC_MESSAGE =
  "La limite de projets de cet espace est atteinte." as const;

export const DIRECTOR_PROJECT_QUOTA = {
  maxActiveNonArchived: DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE,
  atomic: false,
  archivedExcluded: true,
  replayAllowedAtQuota: true,
  race: "check-then-act — concurrent distinct creates may exceed by a small amount",
  blocksSingleTenantActivation: false,
} as const;

export type DirectorProjectQuotaCheck =
  | { allowed: true; reason: "under_quota" | "replay_existing" }
  | {
      allowed: false;
      code: typeof DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE;
      publicMessage: typeof DIRECTOR_PROJECT_QUOTA_PUBLIC_MESSAGE;
    };

export function evaluateDirectorProjectQuota(input: {
  existingInWorkspace: boolean;
  activeNonArchivedCount: number;
  maxActive?: number;
}): DirectorProjectQuotaCheck {
  if (input.existingInWorkspace) {
    return { allowed: true, reason: "replay_existing" };
  }
  const max = input.maxActive ?? DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE;
  if (input.activeNonArchivedCount >= max) {
    return {
      allowed: false,
      code: DIRECTOR_PROJECT_QUOTA_EXCEEDED_CODE,
      publicMessage: DIRECTOR_PROJECT_QUOTA_PUBLIC_MESSAGE,
    };
  }
  return { allowed: true, reason: "under_quota" };
}

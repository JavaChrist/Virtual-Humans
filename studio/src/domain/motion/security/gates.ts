/**
 * Consolidated Motion Transfer security gates (MT-011) — fail-closed, typed, redacted.
 */

import { deepFreeze } from "../freeze";
import {
  evaluateMotionPrivacyDecisions,
  type MotionPrivacyDecisionSet,
} from "./privacy-decision";

export const MOTION_SECURITY_GATES_VERSION = "mt011-gates-1.0.0" as const;

export type MotionSecurityGateCode =
  | "capability_disabled"
  | "paid_disabled"
  | "fal_disabled"
  | "worker_disabled"
  | "registry_unverified"
  | "registry_disabled"
  | "privacy_blocked"
  | "consent_expired"
  | "media_invalid"
  | "budget_invalid"
  | "remote_migration_absent"
  | "fake_forbidden"
  | "scope_mismatch";

export type MotionSecurityGateInput = {
  env?: Record<string, string | undefined>;
  privacy?: MotionPrivacyDecisionSet | null;
  nowIso: string;
  registry?: {
    enabled: boolean;
    verificationStatus: string;
  } | null;
  mediaValid?: boolean;
  budgetValid?: boolean;
  /** When true, remote MT-005 human_review migration is known applied. */
  remoteMigrationApplied?: boolean;
  /** Fake adapter / measurement requested. */
  fakeRequested?: boolean;
  workspaceId?: string;
  projectWorkspaceId?: string;
};

export type MotionSecurityGateResult = {
  version: typeof MOTION_SECURITY_GATES_VERSION;
  ok: boolean;
  denied: readonly MotionSecurityGateCode[];
  privacyStatus: "blocked" | "accepted";
};

function flagOn(env: Record<string, string | undefined>, key: string): boolean {
  const v = env[key];
  return v === "1" || v === "true";
}

/**
 * Evaluate runtime security gates. Does not mutate env or apply migrations.
 */
export function evaluateMotionSecurityGates(
  input: MotionSecurityGateInput,
): Readonly<MotionSecurityGateResult> {
  const env = input.env ?? {};
  const denied: MotionSecurityGateCode[] = [];

  if (!flagOn(env, "MOTION_TRANSFER_ENABLED")) denied.push("capability_disabled");
  if (!flagOn(env, "MOTION_TRANSFER_PAID_ENABLED")) denied.push("paid_disabled");
  if (!flagOn(env, "MOTION_TRANSFER_FAL_ENABLED")) denied.push("fal_disabled");
  if (!flagOn(env, "MOTION_TRANSFER_WORKER_ENABLED")) denied.push("worker_disabled");

  if (input.registry) {
    if (!input.registry.enabled) denied.push("registry_disabled");
    if (input.registry.verificationStatus !== "VERIFIED") {
      denied.push("registry_unverified");
    }
  } else {
    denied.push("registry_unverified");
  }

  const privacy = evaluateMotionPrivacyDecisions(input.privacy, input.nowIso);
  if (privacy.status !== "accepted") {
    denied.push("privacy_blocked");
    if (privacy.expired.length > 0) denied.push("consent_expired");
  }

  if (input.mediaValid === false) denied.push("media_invalid");
  if (input.budgetValid === false) denied.push("budget_invalid");

  if (input.remoteMigrationApplied === false) {
    denied.push("remote_migration_absent");
  }

  if (input.fakeRequested) {
    const harness =
      flagOn(env, "MOTION_TRANSFER_FAKE_HARNESS") ||
      flagOn(env, "DIRECTOR_V2_E2E_HARNESS");
    if (
      env.VERCEL === "1" ||
      (env.NODE_ENV === "production" && !harness)
    ) {
      denied.push("fake_forbidden");
    }
  }

  if (
    input.workspaceId &&
    input.projectWorkspaceId &&
    input.workspaceId !== input.projectWorkspaceId
  ) {
    denied.push("scope_mismatch");
  }

  return deepFreeze({
    version: MOTION_SECURITY_GATES_VERSION,
    ok: denied.length === 0,
    denied,
    privacyStatus: privacy.status,
  });
}

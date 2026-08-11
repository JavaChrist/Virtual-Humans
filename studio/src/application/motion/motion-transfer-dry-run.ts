/**
 * Public Motion Transfer dry-run façade (MT-012).
 * Synthetic / redacted only — never calls providers, never returns URLs/prompts/secrets.
 */

import {
  createFakeMotionTransferMediaResolver,
  MOTION_TRANSFER_DRY_RUN_VERSION,
  runMotionTransferGenerationDryRun,
  type MotionTransferDryRunResult,
  type MotionTransferGenerationInput,
} from "@/domain/generation";
import type { MotionTransferInput } from "@/domain/motion";
import {
  evaluateMotionSecurityGates,
  MOTION_SECURITY_GATES_VERSION,
  type MotionPrivacyDecisionSet,
  type MotionSecurityGateCode,
} from "@/domain/motion/security";
import type { CapabilityRegistrySnapshot } from "@/domain/routing/capabilities";
import { getMotionTransferFlags } from "@/infrastructure/providers/motion-transfer/motion-transfer-flags";
import { isMotionTransferFakeHarnessActive } from "./motion-transfer-worker-gates";

export const MOTION_TRANSFER_PUBLIC_DRY_RUN_VERSION = "mt012-dry-run-1.0.0" as const;

export type MotionTransferPublicDryRunInput = {
  motion: MotionTransferInput;
  workspaceId: string;
  projectId: string;
  correlationId: string;
  at: string;
  budgetLimitMinor?: number;
  currency?: string;
  /** Synthetic registry — required for executable synthetic dry-run. */
  registry?: CapabilityRegistrySnapshot | null;
  privacy?: MotionPrivacyDecisionSet | null;
  env?: Record<string, string | undefined>;
  /** Production remote MT-005 migration known applied (default false). */
  remoteMigrationApplied?: boolean;
};

export type MotionTransferPublicDryRunResult = {
  version: typeof MOTION_TRANSFER_PUBLIC_DRY_RUN_VERSION;
  dryRunVersion: typeof MOTION_TRANSFER_DRY_RUN_VERSION;
  capability: "video.motion_transfer";
  runtimeCapability: "unavailable" | "synthetic_executable" | "blocked";
  executable: boolean;
  blockingReasons: readonly { code: string; message: string }[];
  securityGates: {
    version: typeof MOTION_SECURITY_GATES_VERSION;
    ok: boolean;
    denied: readonly MotionSecurityGateCode[];
    privacyStatus: "blocked" | "accepted";
  };
  flags: {
    motionTransferEnabled: boolean;
    motionTransferPaidEnabled: boolean;
    motionTransferFalEnabled: boolean;
    motionTransferWorkerEnabled: boolean;
    fakeHarnessActive: boolean;
  };
  registryVersion: string | null;
  routerDecisionVersion: string | null;
  selected?: { providerId: string; modelId: string };
  estimate?: { amountMinor: number; currency: string };
  limits: {
    syncOrAsync?: "sync" | "async";
    pollingRequired?: boolean;
    budgetFits: boolean | null;
  };
  fingerprints: {
    planFingerprint?: string;
    idempotencyFingerprint?: string;
    inputFingerprint?: string;
  };
  qc: {
    qcRequired: boolean;
    humanValidationRequired: boolean;
    humanReviewRequired: boolean;
  };
  providerCalled: false;
  productionWrites: 0;
};

function productionLikeUnavailable(
  input: MotionTransferPublicDryRunInput,
  denied: readonly MotionSecurityGateCode[],
  privacyStatus: "blocked" | "accepted",
): MotionTransferPublicDryRunResult {
  const env = input.env ?? {};
  const flags = getMotionTransferFlags(env);
  return {
    version: MOTION_TRANSFER_PUBLIC_DRY_RUN_VERSION,
    dryRunVersion: MOTION_TRANSFER_DRY_RUN_VERSION,
    capability: "video.motion_transfer",
    runtimeCapability: "unavailable",
    executable: false,
    blockingReasons: [
      {
        code: "runtime_unavailable",
        message:
          "Motion Transfer runtime unavailable — Registry, privacy, migration and flags not Production-validated.",
      },
      ...denied.map((code) => ({
        code,
        message: `Security gate denied: ${code}`,
      })),
    ],
    securityGates: {
      version: MOTION_SECURITY_GATES_VERSION,
      ok: false,
      denied,
      privacyStatus,
    },
    flags: {
      motionTransferEnabled: flags.motionTransferEnabled,
      motionTransferPaidEnabled: flags.motionTransferPaidEnabled,
      motionTransferFalEnabled: flags.motionTransferFalEnabled,
      motionTransferWorkerEnabled: flags.motionTransferWorkerEnabled,
      fakeHarnessActive: isMotionTransferFakeHarnessActive(env),
    },
    registryVersion: null,
    routerDecisionVersion: null,
    limits: { budgetFits: null },
    fingerprints: {},
    qc: {
      qcRequired: true,
      humanValidationRequired: true,
      humanReviewRequired: true,
    },
    providerCalled: false,
    productionWrites: 0,
  };
}

/**
 * Public dry-run. Production-like environments stay unavailable.
 * Synthetic harness + registry may return executable=true without provider calls.
 */
export async function runMotionTransferPublicDryRun(
  input: MotionTransferPublicDryRunInput,
): Promise<Readonly<MotionTransferPublicDryRunResult>> {
  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const harness = isMotionTransferFakeHarnessActive(env);
  const gates = evaluateMotionSecurityGates({
    env,
    privacy: input.privacy ?? null,
    nowIso: input.at,
    registry: input.registry
      ? {
          enabled: true,
          verificationStatus: "VERIFIED",
        }
      : { enabled: false, verificationStatus: "UNVERIFIED" },
    mediaValid: true,
    budgetValid: true,
    remoteMigrationApplied: input.remoteMigrationApplied ?? false,
    fakeRequested: harness,
    workspaceId: input.workspaceId,
    projectWorkspaceId: input.workspaceId,
  });

  // Real Production path: stay unavailable until all gates green (not this phase).
  if (!harness || !input.registry) {
    return productionLikeUnavailable(input, gates.denied, gates.privacyStatus);
  }

  const request: MotionTransferGenerationInput = {
    schemaVersion: "1.0.0",
    action: "motion_transfer",
    motion: input.motion,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    budgetLimitMinor: input.budgetLimitMinor,
    currency: input.currency,
    correlationId: input.correlationId,
    at: input.at,
  };

  const mediaResolver = createFakeMotionTransferMediaResolver();
  mediaResolver.register(input.motion.sourceVideo);
  for (const ref of input.motion.character.identityReferences) {
    mediaResolver.register(ref);
  }
  if (input.motion.character.outfitReference) {
    mediaResolver.register(input.motion.character.outfitReference);
  }

  const dry: MotionTransferDryRunResult = await runMotionTransferGenerationDryRun(
    request,
    {
      registry: input.registry,
      mediaResolver,
    },
  );

  const flags = getMotionTransferFlags(env);
  // MT-005 remains LOCAL_ONLY — do not treat remote_migration_absent as a synthetic dry-run blocker.
  const syntheticDenied = gates.denied.filter((d) => d !== "remote_migration_absent");
  const executable = dry.executable && syntheticDenied.length === 0;
  const blocking = [
    ...dry.blockingReasons,
    ...gates.denied.map((code) => ({
      code,
      message:
        code === "remote_migration_absent"
          ? "Remote MT-005 migration not applied (expected — LOCAL_ONLY)."
          : `Security gate denied: ${code}`,
    })),
  ];

  return {
    version: MOTION_TRANSFER_PUBLIC_DRY_RUN_VERSION,
    dryRunVersion: dry.dryRunVersion,
    capability: "video.motion_transfer",
    runtimeCapability: executable ? "synthetic_executable" : "blocked",
    executable,
    blockingReasons: blocking,
    securityGates: {
      version: gates.version,
      ok: gates.ok,
      denied: gates.denied,
      privacyStatus: gates.privacyStatus,
    },
    flags: {
      motionTransferEnabled: flags.motionTransferEnabled,
      motionTransferPaidEnabled: flags.motionTransferPaidEnabled,
      motionTransferFalEnabled: flags.motionTransferFalEnabled,
      motionTransferWorkerEnabled: flags.motionTransferWorkerEnabled,
      fakeHarnessActive: harness,
    },
    registryVersion: input.registry.registryVersion,
    routerDecisionVersion: dry.contractVersions.routingDecision,
    selected: dry.selected,
    estimate: dry.estimate
      ? {
          amountMinor: dry.estimate.amountMinor,
          currency: dry.estimate.currency,
        }
      : undefined,
    limits: {
      syncOrAsync: dry.syncOrAsync,
      pollingRequired: dry.pollingRequired,
      budgetFits: dry.budgetFits,
    },
    fingerprints: {
      planFingerprint: dry.planFingerprint,
      idempotencyFingerprint: dry.idempotencyFingerprint,
      inputFingerprint: dry.resolved?.inputFingerprint,
    },
    qc: {
      qcRequired: dry.qcRequired,
      humanValidationRequired: dry.humanValidationRequired,
      humanReviewRequired: dry.humanValidationRequired,
    },
    providerCalled: false,
    productionWrites: 0,
  };
}

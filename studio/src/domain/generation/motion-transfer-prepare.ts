/**
 * Motion Transfer Generation Engine preparation / dry-run (MT-004).
 *
 * Pipeline: validate → resolve media → route (MT-003) → normalize → plan → dry-run
 * No provider calls, runs/jobs, ledger reserves, storage writes, or DB persistence.
 */

import { createHash } from "node:crypto";
import {
  MOTION_TRANSFER_CAPABILITY,
  MOTION_TRANSFER_ACTION_VERSION,
  MOTION_TRANSFER_INPUT_SCHEMA_VERSION,
  assertNotI2vOrT2vFallback,
  buildMotionTransferIdempotencyMaterial,
  buildMotionTransferInputFingerprint,
  fingerprintMotionMediaReference,
  fingerprintMotionReferenceSpec,
  isMotionTransferDomainError,
  parseMotionTransferInput,
  redactMotionTransferInput,
  sanitizePublicMessage,
  type MotionTransferInput,
  type MotionTransferRoutingErrorCode,
} from "@/domain/motion";
import {
  MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
  type CapabilityRegistrySnapshot,
} from "@/domain/routing/capabilities";
import {
  MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP,
  MOTION_TRANSFER_ROUTING_DECISION_VERSION,
  MOTION_TRANSFER_STRATEGY_ID,
  redactMotionTransferRoutingDecision,
  routeMotionTransfer,
  routingConstraintsFromMotionTransferInput,
  type MotionTransferRoutingDecision,
} from "@/domain/routing/router";
import type { Money } from "@/domain/cost";
import { GenerationDomainError, isGenerationDomainError } from "./errors";
import type { MotionTransferCanonicalInput } from "./input";
import {
  redactResolvedMotionMedia,
  type MotionTransferMediaResolver,
  type ResolvedMotionMediaMeta,
} from "./motion-transfer-media";

export const MOTION_TRANSFER_ENGINE_ACTION = "motion_transfer" as const;
export const MOTION_TRANSFER_ENGINE_VERSION = "motion-transfer-engine-v1" as const;
export const MOTION_TRANSFER_GENERATION_PLAN_VERSION = "1.0.0" as const;
export const MOTION_TRANSFER_DRY_RUN_VERSION = "1.0.0" as const;

/** Engine-facing request — wraps MT-001 input + routing/budget context. No provider keys. */
export type MotionTransferGenerationInput = {
  schemaVersion: "1.0.0";
  action: typeof MOTION_TRANSFER_ENGINE_ACTION;
  motion: MotionTransferInput;
  workspaceId: string;
  projectId: string;
  planRevisionId?: string;
  budgetLimitMinor?: number;
  currency?: string;
  allowedProviders?: readonly string[];
  allowedModels?: readonly string[];
  correlationId: string;
  at: string;
  /** Upstream artifact fingerprints (optional, redacted ids only). */
  upstreamArtifactFingerprints?: readonly string[];
};

export type ResolvedMotionTransferInput = {
  sourceVideo: Omit<ResolvedMotionMediaMeta, "ephemeralAccess">;
  identityReferences: Array<Omit<ResolvedMotionMediaMeta, "ephemeralAccess">>;
  outfitReference?: Omit<ResolvedMotionMediaMeta, "ephemeralAccess">;
  /** Provider-independent input fingerprint (MT-001). */
  inputFingerprint: string;
  sourceVideoFingerprint: string;
  identityFingerprints: string[];
  outfitFingerprint: string | null;
  referenceSpecFingerprint: string;
};

export type MotionTransferGenerationPlan = {
  planVersion: typeof MOTION_TRANSFER_GENERATION_PLAN_VERSION;
  action: typeof MOTION_TRANSFER_ENGINE_ACTION;
  actionVersion: typeof MOTION_TRANSFER_ENGINE_VERSION;
  capability: typeof MOTION_TRANSFER_CAPABILITY;
  capabilityContractVersion: typeof MOTION_TRANSFER_INPUT_SCHEMA_VERSION;
  motionCapabilitiesSchemaVersion: typeof MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION;
  registryVersion: string;
  routeDecisionVersion: typeof MOTION_TRANSFER_ROUTING_DECISION_VERSION;
  strategy: typeof MOTION_TRANSFER_STRATEGY_ID;
  routeStatus: "selected" | "failed";
  selected?: { providerId: string; modelId: string };
  estimate?: Money;
  syncOrAsync?: "sync" | "async";
  pollingRequired?: boolean;
  cancellationSupported?: boolean;
  outputConstraints: MotionTransferInput["output"];
  qcRequirements: MotionTransferInput["qcRequirements"];
  humanValidationRequired: boolean;
  motionFidelity: MotionTransferInput["motion"]["fidelity"];
  sourceVideoFingerprint: string;
  identityFingerprints: string[];
  outfitFingerprint: string | null;
  referenceSpecFingerprint: string;
  inputFingerprint: string;
  /** Base idempotency material — attempt excluded; append provider/model/attempt at job layer. */
  idempotencyMaterial: string;
  /** Engine plan fingerprint (includes route selection when present). */
  planFingerprint: string;
  provenance: {
    workspaceId: string;
    projectId: string;
    correlationId: string;
    planRevisionId?: string;
    upstreamArtifactFingerprints?: readonly string[];
  };
  maximumFallbacksPerStep: typeof MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP;
  canonicalInput?: MotionTransferCanonicalInput;
};

export type MotionTransferDryRunBlockingReason = {
  code: string;
  message: string;
};

export type MotionTransferDryRunResult = {
  dryRunVersion: typeof MOTION_TRANSFER_DRY_RUN_VERSION;
  action: typeof MOTION_TRANSFER_ENGINE_ACTION;
  capability: typeof MOTION_TRANSFER_CAPABILITY;
  contractVersions: {
    input: typeof MOTION_TRANSFER_INPUT_SCHEMA_VERSION;
    engine: typeof MOTION_TRANSFER_ENGINE_VERSION;
    routingDecision: typeof MOTION_TRANSFER_ROUTING_DECISION_VERSION;
    motionCapabilities: typeof MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION;
    plan: typeof MOTION_TRANSFER_GENERATION_PLAN_VERSION;
  };
  inputValid: boolean;
  mediaResolvable: boolean;
  routeStatus: "selected" | "failed" | "skipped";
  selected?: { providerId: string; modelId: string };
  estimate?: Money;
  pricingConfigured: boolean;
  budgetFits: boolean | null;
  syncOrAsync?: "sync" | "async";
  pollingRequired?: boolean;
  qcRequired: boolean;
  humanValidationRequired: boolean;
  idempotencyFingerprint?: string;
  planFingerprint?: string;
  providerCalled: false;
  executable: boolean;
  blockingReasons: MotionTransferDryRunBlockingReason[];
  plan?: MotionTransferGenerationPlan;
  resolved?: ResolvedMotionTransferInput;
  routeDecision?: MotionTransferRoutingDecision;
};

export type PrepareMotionTransferDryRunOptions = {
  registry: CapabilityRegistrySnapshot;
  mediaResolver: MotionTransferMediaResolver;
  allowDataUrl?: boolean;
};

function deepFreezeJson<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) {
      deepFreezeJson(v);
    }
  }
  return value;
}

function publicErr(e: unknown): string {
  if (isMotionTransferDomainError(e) || isGenerationDomainError(e)) {
    return sanitizePublicMessage(e.publicMessage);
  }
  return "Motion-transfer preparation failed.";
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function requireHumanValidation(input: MotionTransferInput): boolean {
  if (input.motion.fidelity === "critical") return true;
  if (input.referenceSpec?.humanValidationRequired) return true;
  return input.qcRequirements.some((q) => q.humanValidationRequired === true);
}

function buildPlanFingerprint(parts: {
  inputFingerprint: string;
  registryVersion: string;
  routeDecisionVersion: string;
  selected?: { providerId: string; modelId: string };
  output: MotionTransferInput["output"];
  qc: MotionTransferInput["qcRequirements"];
  humanValidationRequired: boolean;
  engineVersion: string;
}): string {
  return sha256(
    JSON.stringify({
      action: MOTION_TRANSFER_ENGINE_ACTION,
      engineVersion: parts.engineVersion,
      capability: MOTION_TRANSFER_CAPABILITY,
      actionVersion: MOTION_TRANSFER_ACTION_VERSION,
      inputFingerprint: parts.inputFingerprint,
      registryVersion: parts.registryVersion,
      routeDecisionVersion: parts.routeDecisionVersion,
      selected: parts.selected ?? null,
      output: parts.output,
      qc: [...parts.qc]
        .map((q) => ({
          code: q.code,
          severity: q.severity,
          humanValidationRequired: q.humanValidationRequired ?? false,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
      humanValidationRequired: parts.humanValidationRequired,
    }),
  );
}

/**
 * Compose engine idempotency material from MT-001 + route/engine versions.
 * Attempt is excluded from the base material (job layer appends it later).
 */
export function buildMotionTransferEngineIdempotencyMaterial(parts: {
  motion: MotionTransferInput;
  registryVersion: string;
  routeDecisionVersion: string;
  selected?: { providerId: string; modelId: string };
  planFingerprint: string;
}): string {
  const base = buildMotionTransferIdempotencyMaterial(parts.motion);
  const selected =
    parts.selected != null
      ? `${parts.selected.providerId}::${parts.selected.modelId}`
      : "none";
  return [
    base,
    MOTION_TRANSFER_ENGINE_VERSION,
    parts.registryVersion,
    parts.routeDecisionVersion,
    selected,
    parts.planFingerprint.slice(0, 16),
  ].join(":");
}

async function resolveAllMedia(
  input: MotionTransferInput,
  resolver: MotionTransferMediaResolver,
  at: string,
  allowDataUrl: boolean,
): Promise<{
  resolved: ResolvedMotionTransferInput;
  source: ResolvedMotionMediaMeta;
  identities: ResolvedMotionMediaMeta[];
  outfit?: ResolvedMotionMediaMeta;
}> {
  const source = await resolver.resolve(input.sourceVideo, { at, allowDataUrl });
  const identities: ResolvedMotionMediaMeta[] = [];
  for (const ref of input.character.identityReferences) {
    identities.push(await resolver.resolve(ref, { at, allowDataUrl }));
  }
  let outfit: ResolvedMotionMediaMeta | undefined;
  if (input.character.outfitReference) {
    outfit = await resolver.resolve(input.character.outfitReference, {
      at,
      allowDataUrl,
    });
  }
  const resolved: ResolvedMotionTransferInput = {
    sourceVideo: redactResolvedMotionMedia(source),
    identityReferences: identities.map(redactResolvedMotionMedia),
    outfitReference: outfit ? redactResolvedMotionMedia(outfit) : undefined,
    inputFingerprint: buildMotionTransferInputFingerprint(input),
    sourceVideoFingerprint: fingerprintMotionMediaReference(input.sourceVideo),
    identityFingerprints: input.character.identityReferences
      .map(fingerprintMotionMediaReference)
      .sort(),
    outfitFingerprint: input.character.outfitReference
      ? fingerprintMotionMediaReference(input.character.outfitReference)
      : null,
    referenceSpecFingerprint: fingerprintMotionReferenceSpec(input.referenceSpec),
  };
  return { resolved, source, identities, outfit };
}

/**
 * Pure motion-transfer dry-run preparation.
 * Always returns providerCalled=false. Never mutates the request.
 */
export async function runMotionTransferGenerationDryRun(
  request: MotionTransferGenerationInput,
  options: PrepareMotionTransferDryRunOptions,
): Promise<MotionTransferDryRunResult> {
  const blocking: MotionTransferDryRunBlockingReason[] = [];
  const requestClone = structuredClone({
    ...request,
    motion: redactMotionTransferInput(request.motion),
  });
  void requestClone;

  const base: MotionTransferDryRunResult = {
    dryRunVersion: MOTION_TRANSFER_DRY_RUN_VERSION,
    action: MOTION_TRANSFER_ENGINE_ACTION,
    capability: MOTION_TRANSFER_CAPABILITY,
    contractVersions: {
      input: MOTION_TRANSFER_INPUT_SCHEMA_VERSION,
      engine: MOTION_TRANSFER_ENGINE_VERSION,
      routingDecision: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
      motionCapabilities: MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
      plan: MOTION_TRANSFER_GENERATION_PLAN_VERSION,
    },
    inputValid: false,
    mediaResolvable: false,
    routeStatus: "skipped",
    pricingConfigured: false,
    budgetFits: null,
    qcRequired: false,
    humanValidationRequired: false,
    providerCalled: false,
    executable: false,
    blockingReasons: blocking,
  };

  // --- validate ---
  let parsed: MotionTransferInput;
  try {
    if (request.action !== MOTION_TRANSFER_ENGINE_ACTION) {
      throw new GenerationDomainError(
        "invalid_input",
        "Engine action must be motion_transfer.",
      );
    }
    assertNotI2vOrT2vFallback(request.motion.capability);
    parsed = parseMotionTransferInput(request.motion, {
      at: request.at,
      allowDataUrl: options.allowDataUrl === true,
    });
    base.inputValid = true;
  } catch (e) {
    blocking.push({
      code: isMotionTransferDomainError(e) ? e.code : "invalid_input",
      message: publicErr(e),
    });
    return deepFreezeJson(structuredClone({ ...base, blockingReasons: blocking }));
  }

  base.qcRequired = parsed.qcRequirements.length > 0;
  base.humanValidationRequired = requireHumanValidation(parsed);

  // --- resolve media ---
  let resolvedBundle: Awaited<ReturnType<typeof resolveAllMedia>>;
  try {
    resolvedBundle = await resolveAllMedia(
      parsed,
      options.mediaResolver,
      request.at,
      options.allowDataUrl === true,
    );
    base.mediaResolvable = true;
    base.resolved = resolvedBundle.resolved;
  } catch (e) {
    blocking.push({
      code: isGenerationDomainError(e) ? e.code : "asset_unavailable",
      message: publicErr(e),
    });
    return deepFreezeJson(structuredClone({ ...base, blockingReasons: blocking }));
  }

  // --- route (MT-003 only) ---
  const constraints = routingConstraintsFromMotionTransferInput(parsed);
  const routeDecision = routeMotionTransfer({
    schemaVersion: "1.0.0",
    strategy: MOTION_TRANSFER_STRATEGY_ID,
    constraints,
    registry: options.registry,
    allowedProviders: request.allowedProviders,
    allowedModels: request.allowedModels,
    budgetLimitMinor: request.budgetLimitMinor,
    currency: request.currency,
    at: request.at,
    correlationId: request.correlationId,
  });
  const redactedRoute = redactMotionTransferRoutingDecision(routeDecision);
  base.routeDecision = redactedRoute;
  base.routeStatus = redactedRoute.status === "selected" ? "selected" : "failed";

  if (redactedRoute.status === "failed") {
    const code = redactedRoute.failure.code;
    blocking.push({
      code,
      message: sanitizePublicMessage(redactedRoute.failure.message),
    });
    if (
      code === "pricing_unconfigured" ||
      code === "estimate_unavailable"
    ) {
      base.pricingConfigured = false;
    }
    if (code === "budget_limit_exceeded") {
      base.budgetFits = false;
      base.pricingConfigured = true;
    }
    // Still expose a non-executable plan skeleton for observability
    const planFingerprint = buildPlanFingerprint({
      inputFingerprint: resolvedBundle.resolved.inputFingerprint,
      registryVersion: options.registry.registryVersion,
      routeDecisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
      output: parsed.output,
      qc: parsed.qcRequirements,
      humanValidationRequired: base.humanValidationRequired,
      engineVersion: MOTION_TRANSFER_ENGINE_VERSION,
    });
    const plan: MotionTransferGenerationPlan = {
      planVersion: MOTION_TRANSFER_GENERATION_PLAN_VERSION,
      action: MOTION_TRANSFER_ENGINE_ACTION,
      actionVersion: MOTION_TRANSFER_ENGINE_VERSION,
      capability: MOTION_TRANSFER_CAPABILITY,
      capabilityContractVersion: MOTION_TRANSFER_INPUT_SCHEMA_VERSION,
      motionCapabilitiesSchemaVersion:
        MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
      registryVersion: options.registry.registryVersion,
      routeDecisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
      strategy: MOTION_TRANSFER_STRATEGY_ID,
      routeStatus: "failed",
      outputConstraints: parsed.output,
      qcRequirements: parsed.qcRequirements,
      humanValidationRequired: base.humanValidationRequired,
      motionFidelity: parsed.motion.fidelity,
      sourceVideoFingerprint: resolvedBundle.resolved.sourceVideoFingerprint,
      identityFingerprints: resolvedBundle.resolved.identityFingerprints,
      outfitFingerprint: resolvedBundle.resolved.outfitFingerprint,
      referenceSpecFingerprint: resolvedBundle.resolved.referenceSpecFingerprint,
      inputFingerprint: resolvedBundle.resolved.inputFingerprint,
      idempotencyMaterial: buildMotionTransferEngineIdempotencyMaterial({
        motion: parsed,
        registryVersion: options.registry.registryVersion,
        routeDecisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
        planFingerprint,
      }),
      planFingerprint,
      provenance: {
        workspaceId: request.workspaceId,
        projectId: request.projectId,
        correlationId: request.correlationId,
        planRevisionId: request.planRevisionId,
        upstreamArtifactFingerprints: request.upstreamArtifactFingerprints,
      },
      maximumFallbacksPerStep: MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP,
    };
    base.plan = plan;
    base.idempotencyFingerprint = plan.idempotencyMaterial;
    base.planFingerprint = plan.planFingerprint;
    base.executable = false;
    return deepFreezeJson(structuredClone(base));
  }

  // selected
  const selected = redactedRoute.selected;
  const estimate = redactedRoute.estimate;
  base.selected = selected;
  base.estimate = estimate;
  base.pricingConfigured = true;
  base.budgetFits =
    request.budgetLimitMinor === undefined
      ? true
      : estimate.amountMinor <= request.budgetLimitMinor;

  const model = options.registry.models.find(
    (m) =>
      m.providerId === selected.providerId && m.modelId === selected.modelId,
  );
  const mt = model?.motionTransfer;
  base.syncOrAsync = mt?.syncOrAsync;
  base.pollingRequired = mt?.pollingRequired;

  if (base.budgetFits === false) {
    blocking.push({
      code: "budget_limit_exceeded" satisfies MotionTransferRoutingErrorCode,
      message: "Estimated cost exceeds the provided budget limit.",
    });
  }

  const planFingerprint = buildPlanFingerprint({
    inputFingerprint: resolvedBundle.resolved.inputFingerprint,
    registryVersion: options.registry.registryVersion,
    routeDecisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
    selected,
    output: parsed.output,
    qc: parsed.qcRequirements,
    humanValidationRequired: base.humanValidationRequired,
    engineVersion: MOTION_TRANSFER_ENGINE_VERSION,
  });

  const canonicalInput: MotionTransferCanonicalInput = {
    kind: "motion_transfer",
    action: "motion_transfer",
    capabilityProfile: MOTION_TRANSFER_CAPABILITY,
    providerId: selected.providerId,
    modelId: selected.modelId,
    promptText: "", // prompts excluded from dry-run public surface
    negativePrompt: undefined,
    references: [
      parsed.sourceVideo.asset,
      ...parsed.character.identityReferences.map((r) => r.asset),
      ...(parsed.character.outfitReference
        ? [parsed.character.outfitReference.asset]
        : []),
    ],
    aspectRatio: parsed.output.aspectRatio,
    durationSeconds: parsed.output.durationSeconds ?? 0,
    sourceVideo: parsed.sourceVideo.asset,
    identityReferences: parsed.character.identityReferences.map((r) => r.asset),
    outfitReference: parsed.character.outfitReference?.asset,
  };
  // Strip any signed URL from canonical references for plan storage
  const scrubAccess = (asset: typeof canonicalInput.sourceVideo) => {
    if (asset.access.kind === "signed_url") {
      return {
        ...asset,
        access: {
          kind: "signed_url" as const,
          url: "[redacted-ephemeral]",
          expiresAt: asset.access.expiresAt,
        },
      };
    }
    if (asset.access.kind === "data_url") {
      return {
        ...asset,
        access: { kind: "data_url" as const, dataUrl: "data:omitted" },
      };
    }
    return asset;
  };
  const safeCanonical: MotionTransferCanonicalInput = {
    ...canonicalInput,
    sourceVideo: scrubAccess(canonicalInput.sourceVideo),
    identityReferences: canonicalInput.identityReferences.map(scrubAccess),
    outfitReference: canonicalInput.outfitReference
      ? scrubAccess(canonicalInput.outfitReference)
      : undefined,
    references: canonicalInput.references.map(scrubAccess),
  };

  const plan: MotionTransferGenerationPlan = {
    planVersion: MOTION_TRANSFER_GENERATION_PLAN_VERSION,
    action: MOTION_TRANSFER_ENGINE_ACTION,
    actionVersion: MOTION_TRANSFER_ENGINE_VERSION,
    capability: MOTION_TRANSFER_CAPABILITY,
    capabilityContractVersion: MOTION_TRANSFER_INPUT_SCHEMA_VERSION,
    motionCapabilitiesSchemaVersion:
      MOTION_TRANSFER_MODEL_CAPABILITIES_SCHEMA_VERSION,
    registryVersion: options.registry.registryVersion,
    routeDecisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
    strategy: MOTION_TRANSFER_STRATEGY_ID,
    routeStatus: "selected",
    selected,
    estimate,
    syncOrAsync: mt?.syncOrAsync,
    pollingRequired: mt?.pollingRequired,
    cancellationSupported: mt?.cancellationSupported,
    outputConstraints: parsed.output,
    qcRequirements: parsed.qcRequirements,
    humanValidationRequired: base.humanValidationRequired,
    motionFidelity: parsed.motion.fidelity,
    sourceVideoFingerprint: resolvedBundle.resolved.sourceVideoFingerprint,
    identityFingerprints: resolvedBundle.resolved.identityFingerprints,
    outfitFingerprint: resolvedBundle.resolved.outfitFingerprint,
    referenceSpecFingerprint: resolvedBundle.resolved.referenceSpecFingerprint,
    inputFingerprint: resolvedBundle.resolved.inputFingerprint,
    idempotencyMaterial: buildMotionTransferEngineIdempotencyMaterial({
      motion: parsed,
      registryVersion: options.registry.registryVersion,
      routeDecisionVersion: MOTION_TRANSFER_ROUTING_DECISION_VERSION,
      selected,
      planFingerprint,
    }),
    planFingerprint,
    provenance: {
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      correlationId: request.correlationId,
      planRevisionId: request.planRevisionId,
      upstreamArtifactFingerprints: request.upstreamArtifactFingerprints,
    },
    maximumFallbacksPerStep: MOTION_TRANSFER_MAXIMUM_FALLBACKS_PER_STEP,
    canonicalInput: safeCanonical,
  };

  base.plan = plan;
  base.idempotencyFingerprint = plan.idempotencyMaterial;
  base.planFingerprint = plan.planFingerprint;
  base.executable = blocking.length === 0;
  base.providerCalled = false;

  // Hostile: ensure public JSON has no live signed URLs / data bodies / prompts
  const frozen = deepFreezeJson(structuredClone(base));
  const blob = JSON.stringify(frozen);
  if (/https:\/\/(?!\[)/i.test(blob) && blob.includes("X-Amz")) {
    throw new GenerationDomainError(
      "invalid_input",
      "Signed URL leaked into dry-run result.",
    );
  }
  return frozen;
}

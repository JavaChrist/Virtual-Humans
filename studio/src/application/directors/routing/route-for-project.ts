/**
 * VHS-123 — persisted Model Router (GenerationPlan).
 * Selects models from Capability Registry — never calls providers, never reserves budget.
 */
import { createHash, randomUUID } from "node:crypto";
import {
  createBudgetPolicy,
  createBudgetSnapshot,
  LEGACY_PRICING_VERSION,
  money,
  type BudgetSnapshot,
} from "@/domain/cost";
import { VideoProjectBriefSchema } from "@/domain/brief";
import {
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  ScenePackageSetSchema,
  type ScenePackage,
  type ScenePackageSet,
} from "@/domain/prompt";
import {
  CAPABILITY_REGISTRY_SCHEMA_VERSION,
  type CapabilityRegistrySnapshot,
} from "@/domain/routing/capabilities";
import {
  createDefaultRoutingPolicy,
  DEFAULT_ROUTING_POLICY_VERSION,
  GENERATION_PLAN_ARTIFACT_TYPE,
  GENERATION_PLAN_SCHEMA_VERSION,
  type GenerationPlan,
} from "@/domain/routing/router";
import { StoryboardProjectSchema } from "@/domain/storyboard";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import { buildRegistryFromStudioPricing } from "@/application/routing/build-from-studio-pricing";
import { createModelRouter } from "@/application/routing/model-router";
import { runModelRouterDryRun } from "@/application/routing/model-router/dry-run";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import {
  authorizeDirectorAction,
  canExecuteSyntheticDirectorPipeline,
} from "@/application/director/director-action-policy";
import type { DirectorRunContext } from "@/application/directors/marketing/result";
import {
  isVhs124OpenAIImageExceptionEnabled,
  isVhs124OpenAIImageExceptionExpired,
  PHASE_11A_SMOKE_PROJECT_ID,
  phase11ARuntimeCompositionFingerprint,
} from "@/application/production/phase-11a-openai-image-allowlist";
import {
  buildPhase11ASingleStepGenerationPlan,
  selectPhase11AScene2Package,
} from "@/application/production/phase-11a-single-step-plan";

type Warning = { code: string; message: string };

export type GenerationPlanSceneView = {
  sceneId: string;
  sceneOrder: number;
  strategy: string;
  primaryProviderId: string;
  primaryModelId: string;
  fallbacks: Array<{ order: number; providerId: string; modelId: string; reason: string }>;
  dependsOnStepIds: string[];
  estimatedCostMinor: number;
  estimatedDurationSeconds: number;
  selectionSummary: string;
};

export type GenerationPlanView = {
  revision: number;
  status: "ready" | "absent";
  artifactId?: string;
  registryVersion?: string;
  policyVersion?: string;
  schemaVersion?: string;
  scenePackageSetRevision?: number;
  estimatedCostMinor?: number;
  maximumExposureMinor?: number;
  currency?: string;
  budgetAvailableMinor?: number;
  budgetAllowed?: boolean;
  sceneCount?: number;
  scenes?: GenerationPlanSceneView[];
  warnings: Warning[];
  unknowns: string[];
  explanations: string[];
  approval?: {
    status: "approved" | "rejected" | "none" | "stale";
    revision?: number;
    decidedAt?: string;
    decidedBy?: string;
  };
};

export type RoutingProjectInput = {
  projectId: string;
  expectedScenePackageSetRevision?: number;
  expectedRegistrySnapshotVersion?: string;
};

export type RoutingProjectDryRunResult = {
  executable: boolean;
  providerCalled: false;
  executionAvailable: boolean;
  briefRevision: number;
  briefArtifactId: string;
  storyboardRevision: number;
  storyboardArtifactId: string;
  scenePackageSetRevision: number;
  scenePackageSetArtifactId: string;
  registryVersion: string;
  registrySchemaVersion: typeof CAPABILITY_REGISTRY_SCHEMA_VERSION;
  policyVersion: typeof DEFAULT_ROUTING_POLICY_VERSION;
  schemaVersion: typeof GENERATION_PLAN_SCHEMA_VERSION;
  budgetAvailableMinor: number;
  budgetLimitMinor: number;
  currency: string;
  estimatedCostMinor?: number;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Warning[];
  missingInformation: Array<{ code: string; message: string; field?: string }>;
  existingPlan?: GenerationPlanView;
  /** Present when VHS-124 Phase 11A single-step path is the executable route. */
  phase11ACanonicalSingleStep?: {
    enabled: true;
    compositionFingerprint: string;
    sceneId: "scene-2";
    provider: "openai";
    model: "gpt-image-1";
    quality: "low";
    size: "1024x1024";
    estimateMinor: number;
    reservationMinor: number;
    stepCount: 1;
    fallbackCount: 0;
    planFingerprint: string;
  };
};

export type RoutingProjectResult =
  | { status: "completed" | "existing"; plan: GenerationPlanView; directorRunId: string }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | {
      status: "needs_input";
      missingInformation: Array<{ code: string; message: string; field?: string }>;
      warnings: Warning[];
      directorRunId?: string;
    }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 402 | 409 | 422 | 429 | 500 | 502 | 503 | 504;
      directorRunId?: string;
    };

export type RoutingBudgetPort = {
  loadSnapshot(workspaceId: string): Promise<BudgetSnapshot>;
};

export type RoutingDirectorRunPort = {
  beginOrGet(input: {
    id: string;
    workspaceId: string;
    projectId: string;
    scenePackageSetArtifactId: string;
    scenePackageSetRevision: number;
    storyboardArtifactId: string;
    storyboardRevision: number;
    briefArtifactId: string;
    briefRevision: number;
    registryVersion: string;
    policyVersion: string;
    schemaVersion: string;
    idempotencyKey: string;
    commandFingerprint: string;
    correlationId: string;
  }): Promise<
    | { status: "created"; directorRunId: string; revision: number }
    | { status: "existing"; directorRunId: string; revision: number; outputArtifactId: string }
    | { status: "already_running"; directorRunId: string; revision: number }
  >;
  persistGenerationPlan(input: {
    workspaceId: string;
    projectId: string;
    directorRunId: string;
    artifactId: string;
    scenePackageSetArtifactId: string;
    scenePackageSetRevision: number;
    storyboardArtifactId: string;
    storyboardRevision: number;
    briefArtifactId: string;
    briefRevision: number;
    plan: Record<string, unknown>;
    schemaVersion: string;
    registryVersion: string;
    policyVersion: string;
    estimatedCostMinor: number;
    maximumExposureMinor: number;
    currency: string;
    correlationId: string;
    expectedRunRevision: number;
  }): Promise<{ status: "created" | "existing"; artifactId: string; revision: number }>;
  failRun(input: {
    directorRunId: string;
    workspaceId: string;
    expectedRevision: number;
    errorCode: string;
    status: "failed" | "needs_input" | "cancelled";
    correlationId: string;
  }): Promise<void>;
  loadActiveGenerationPlan(projectId: string): Promise<{
    artifactId: string;
    revision: number;
    value: unknown;
  } | null>;
  loadLatestApproval(
    projectId: string,
    artifactType: "generation_plan",
  ): Promise<{
    artifactId: string;
    revision: number;
    status: "approved" | "rejected";
    decidedAt: string;
    decidedBy: string;
  } | null>;
};

export type RouteGenerationPlanForProjectDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  directorRuns: RoutingDirectorRunPort;
  budget: RoutingBudgetPort;
  /** Optional injection — defaults to studio legacy pricing catalogue (no network). */
  buildRegistry?: (options: {
    createdAt: string;
    registryVersion: string;
  }) => CapabilityRegistrySnapshot;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
  nowIso?: () => string;
};

export type RouteGenerationPlanForProject = {
  dryRun(input: RoutingProjectInput, context: DirectorRunContext): Promise<RoutingProjectDryRunResult>;
  execute(input: RoutingProjectInput, context: DirectorRunContext): Promise<RoutingProjectResult>;
};

function registryContentFingerprint(snapshot: CapabilityRegistrySnapshot): string {
  const compact = {
    schemaVersion: snapshot.schemaVersion,
    providers: snapshot.providers.map((p) => ({
      id: p.id,
      enabled: p.enabled,
      status: p.status,
    })),
    models: snapshot.models.map((m) => ({
      providerId: m.providerId,
      modelId: m.modelId,
      enabled: m.enabled,
      status: m.status,
      supportedProfiles: m.supportedProfiles,
      pricing: m.pricing.map((p) => ({
        id: p.id,
        unit: p.unit,
        amountMinor: p.unitCost.amountMinor,
        currency: p.unitCost.currency,
        confidence: p.confidence,
      })),
    })),
  };
  return createHash("sha256").update(JSON.stringify(compact)).digest("hex").slice(0, 16);
}

export function resolveRegistrySnapshotVersion(snapshot: CapabilityRegistrySnapshot): string {
  return `${snapshot.registryVersion}:${registryContentFingerprint(snapshot)}`;
}

function toSafeView(
  plan: GenerationPlan,
  revision: number,
  extras: {
    artifactId?: string;
    scenePackageSetRevision?: number;
    budgetAvailableMinor?: number;
    approval?: GenerationPlanView["approval"];
    warnings?: Warning[];
  } = {},
): GenerationPlanView {
  const unknowns: string[] = [];
  for (const w of plan.warnings) {
    if (w.code.includes("unknown") || w.message.toLowerCase().includes("unknown")) {
      unknowns.push(w.code);
    }
  }
  const explanations = [
    plan.rationale.summary,
    ...plan.scenePlans.map((s) => `${s.sceneId}: ${s.rationale.summary}`),
  ].filter(Boolean);

  return {
    revision,
    status: "ready",
    artifactId: extras.artifactId ?? plan.id,
    registryVersion: plan.registryVersion,
    policyVersion: plan.policyVersion,
    schemaVersion: plan.schemaVersion,
    scenePackageSetRevision: extras.scenePackageSetRevision,
    estimatedCostMinor: plan.estimatedCost.amountMinor,
    maximumExposureMinor: Math.max(
      plan.estimatedCost.amountMinor,
      plan.fallbackExposure?.amountMinor ?? plan.estimatedCost.amountMinor,
    ),
    currency: plan.currency,
    budgetAvailableMinor: extras.budgetAvailableMinor,
    budgetAllowed: plan.budgetDecision.allowed,
    sceneCount: plan.scenePlans.length,
    scenes: [...plan.scenePlans]
      .sort((a, b) => a.sceneOrder - b.sceneOrder)
      .map((s) => {
        const primary = s.steps[0];
        return {
          sceneId: s.sceneId,
          sceneOrder: s.sceneOrder,
          strategy: s.strategy,
          primaryProviderId: primary?.providerId ?? "unknown",
          primaryModelId: primary?.modelId ?? "unknown",
          fallbacks: (primary?.fallbacks ?? []).map((f) => ({
            order: f.order,
            providerId: f.providerId,
            modelId: f.modelId,
            reason: f.reason,
          })),
          dependsOnStepIds: primary?.dependsOnStepIds ?? [],
          estimatedCostMinor: s.estimatedCost.amountMinor,
          estimatedDurationSeconds: s.estimatedDurationSeconds,
          selectionSummary: s.rationale.summary,
        };
      }),
    warnings: [
      ...(extras.warnings ?? []),
      ...plan.warnings.map((w) => ({ code: w.code, message: w.message })),
    ],
    unknowns,
    explanations,
    approval: extras.approval ?? { status: "none" },
  };
}

function storedPlan(
  value: unknown,
  revision: number,
  extras: Parameters<typeof toSafeView>[2],
): GenerationPlanView | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as GenerationPlan;
  if (raw.artifactType !== GENERATION_PLAN_ARTIFACT_TYPE) return undefined;
  if (!raw.scenePlans || !Array.isArray(raw.scenePlans)) return undefined;
  try {
    return toSafeView(raw, revision, extras);
  } catch {
    return undefined;
  }
}

async function activeArtifact(
  artifacts: ArtifactRepository,
  projectId: string,
  type: "video_project_brief" | "storyboard_project" | "scene_package_set",
): Promise<{
  artifactId: string;
  revision: number;
  value: unknown;
  diag: "ok" | "missing_active" | "missing_row";
} | null> {
  const current = await artifacts.getActive(projectId, type);
  if (!current) return null;
  let item = await artifacts.load(current.artifactId);
  if (!item) {
    item = await artifacts.loadByRevision(projectId, type, current.revision);
  }
  if (!item) {
    return {
      artifactId: current.artifactId,
      revision: current.revision,
      value: null,
      diag: "missing_row",
    };
  }
  return {
    artifactId: current.artifactId,
    revision: current.revision,
    value: item.value,
    diag: "ok",
  };
}

function failed(
  code: string,
  publicMessage: string,
  httpHint: Extract<RoutingProjectResult, { status: "failed" }>["httpHint"],
  extra: Partial<Extract<RoutingProjectResult, { status: "failed" }>> = {},
): Extract<RoutingProjectResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false, ...extra };
}

function empty(
  partial: Partial<RoutingProjectDryRunResult> &
    Pick<RoutingProjectDryRunResult, "validations" | "missingInformation">,
): RoutingProjectDryRunResult {
  return {
    executable: false,
    providerCalled: false,
    executionAvailable: false,
    briefRevision: 0,
    briefArtifactId: "",
    storyboardRevision: 0,
    storyboardArtifactId: "",
    scenePackageSetRevision: 0,
    scenePackageSetArtifactId: "",
    registryVersion: LEGACY_PRICING_VERSION,
    registrySchemaVersion: CAPABILITY_REGISTRY_SCHEMA_VERSION,
    policyVersion: DEFAULT_ROUTING_POLICY_VERSION,
    schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
    budgetAvailableMinor: 0,
    budgetLimitMinor: 0,
    currency: "USD",
    warnings: [],
    ...partial,
  };
}

function packagesFromSet(set: ScenePackageSet): ScenePackage[] {
  return [...set.packages].sort((a, b) => a.sceneOrder - b.sceneOrder);
}

async function resolveApproval(
  port: RoutingDirectorRunPort,
  projectId: string,
  planArtifactId: string,
  planRevision: number,
): Promise<GenerationPlanView["approval"]> {
  const latest = await port.loadLatestApproval(projectId, "generation_plan");
  if (!latest) return { status: "none" };
  if (latest.artifactId !== planArtifactId || latest.revision !== planRevision) {
    return {
      status: "stale",
      revision: latest.revision,
      decidedAt: latest.decidedAt,
      decidedBy: latest.decidedBy,
    };
  }
  return {
    status: latest.status,
    revision: latest.revision,
    decidedAt: latest.decidedAt,
    decidedBy: latest.decidedBy,
  };
}

export function createRouteGenerationPlanForProject(
  deps: RouteGenerationPlanForProjectDeps,
): RouteGenerationPlanForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());
  const buildRegistry =
    deps.buildRegistry ??
    ((options) =>
      buildRegistryFromStudioPricing({
        createdAt: options.createdAt,
        registryVersion: options.registryVersion,
      }));
  const router = createModelRouter();
  const policy = createDefaultRoutingPolicy();

  async function loadSources(projectId: string) {
    const [briefRaw, storyboardRaw, packageSetRaw] = await Promise.all([
      activeArtifact(deps.artifacts, projectId, "video_project_brief"),
      activeArtifact(deps.artifacts, projectId, "storyboard_project"),
      activeArtifact(deps.artifacts, projectId, "scene_package_set"),
    ]);
    const briefParsed =
      briefRaw?.diag === "ok"
        ? VideoProjectBriefSchema.safeParse(briefRaw.value)
        : null;
    const storyboardParsed =
      storyboardRaw?.diag === "ok"
        ? StoryboardProjectSchema.safeParse(storyboardRaw.value)
        : null;
    const packageSetParsed =
      packageSetRaw?.diag === "ok"
        ? ScenePackageSetSchema.safeParse(packageSetRaw.value)
        : null;
    const brief =
      briefRaw?.diag === "ok" && briefParsed?.success
        ? {
            artifactId: briefRaw.artifactId,
            revision: briefRaw.revision,
            value: briefParsed.data,
          }
        : null;
    const storyboard =
      storyboardRaw?.diag === "ok" && storyboardParsed?.success
        ? {
            artifactId: storyboardRaw.artifactId,
            revision: storyboardRaw.revision,
            value: storyboardParsed.data,
          }
        : null;
    const packageSet =
      packageSetRaw?.diag === "ok" && packageSetParsed?.success
        ? {
            artifactId: packageSetRaw.artifactId,
            revision: packageSetRaw.revision,
            value: packageSetParsed.data,
          }
        : null;
    return {
      brief,
      storyboard,
      packageSet,
      loadDiagnostics: {
        brief: !briefRaw
          ? "missing"
          : briefRaw.diag === "missing_row"
            ? "missing_row"
            : briefParsed?.success
              ? "ok"
              : "invalid",
        storyboard: !storyboardRaw
          ? "missing"
          : storyboardRaw.diag === "missing_row"
            ? "missing_row"
            : storyboardParsed?.success
              ? "ok"
              : "invalid",
        packageSet: !packageSetRaw
          ? "missing"
          : packageSetRaw.diag === "missing_row"
            ? "missing_row"
            : packageSetParsed?.success
              ? "ok"
              : "invalid",
      },
    };
  }

  function buildRegistryForRun(at: string) {
    const base = buildRegistry({
      createdAt: at,
      registryVersion: LEGACY_PRICING_VERSION,
    });
    const versioned = resolveRegistrySnapshotVersion(base);
    // Rebuild with the content-addressed version so plan.registryVersion is stable & explicit.
    return buildRegistry({
      createdAt: at,
      registryVersion: versioned,
    });
  }

  async function dry(input: RoutingProjectInput): Promise<RoutingProjectDryRunResult> {
    if (!canUseDirectorV2Persistence(env)) {
      return empty({
        validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }],
        missingInformation: [],
      });
    }
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) {
      return empty({
        validations: [{ code: "project", passed: false, message: "Projet introuvable." }],
        missingInformation: [{ code: "project_missing", message: "Projet introuvable." }],
      });
    }
    const { brief, storyboard, packageSet, loadDiagnostics } = await loadSources(
      input.projectId,
    );
    if (!brief || !storyboard || !packageSet) {
      const missing = !brief
        ? "brief"
        : !storyboard
          ? "storyboard_project"
          : "scene_package_set";
      const diag =
        missing === "brief"
          ? loadDiagnostics.brief
          : missing === "storyboard_project"
            ? loadDiagnostics.storyboard
            : loadDiagnostics.packageSet;
      const label =
        missing === "brief"
          ? "Brief"
          : missing === "storyboard_project"
            ? "Storyboard"
            : "ScenePackageSet";
      return empty({
        briefRevision: brief?.revision ?? 0,
        briefArtifactId: brief?.artifactId ?? "",
        storyboardRevision: storyboard?.revision ?? 0,
        storyboardArtifactId: storyboard?.artifactId ?? "",
        scenePackageSetRevision: packageSet?.revision ?? 0,
        scenePackageSetArtifactId: packageSet?.artifactId ?? "",
        validations: [
          {
            code: missing,
            passed: false,
            message: `Pré-requis actif introuvable (${missing}:${diag}).`,
          },
        ],
        missingInformation: [
          {
            code: `${missing}_missing`,
            message: `${label} actif ${
              diag === "invalid"
                ? "invalide"
                : diag === "missing_row"
                  ? "pointeur sans ligne"
                  : "introuvable"
            } (diag=${diag}).`,
          },
        ],
      });
    }

    const at = nowIso();
    const registry = buildRegistryForRun(at);
    const registryVersion = registry.registryVersion;
    const budgetSnapshot = await deps.budget.loadSnapshot(deps.workspaceId);
    const budgetPolicy = createBudgetPolicy(budgetSnapshot.limit);
    const packages = packagesFromSet(packageSet.value);
    const readiness = runModelRouterDryRun({
      storyboard: storyboard.value,
      scenePackages: packages,
      registry,
      routingPolicy: policy,
      budgetPolicy,
      budgetSnapshot,
      at,
      correlationId: "routing-dry-run",
      createdBy: "shared-password-user",
    });

    const existing = await deps.directorRuns.loadActiveGenerationPlan(input.projectId);
    let existingPlan: GenerationPlanView | undefined;
    if (existing) {
      const approval = await resolveApproval(
        deps.directorRuns,
        input.projectId,
        existing.artifactId,
        existing.revision,
      );
      existingPlan = storedPlan(existing.value, existing.revision, {
        artifactId: existing.artifactId,
        scenePackageSetRevision: packageSet.revision,
        budgetAvailableMinor: budgetSnapshot.available.amountMinor,
        approval,
      });
    }

    const validations = [
      {
        code: "scene_coverage",
        passed: readiness.failures.every((f) => !f.reasonCodes.includes("missing_package")),
        message: "Couverture complète des scènes.",
      },
      {
        code: "strategies",
        passed: readiness.executable || (readiness.wouldSelect?.length ?? 0) > 0,
        message: "Stratégies éligibles disponibles.",
      },
      {
        code: "budget",
        passed: readiness.budgetDecision?.allowed ?? false,
        message: readiness.budgetDecision?.allowed
          ? "Budget suffisant pour le chemin principal."
          : "Budget insuffisant ou indécidable.",
      },
      {
        code: "providers",
        passed: readiness.providerCalled === false,
        message: "Aucun provider appelé.",
      },
    ];

    const phase11a = tryPhase11ASingleStep({
      projectId: input.projectId,
      packages,
      storyboardArtifactId: storyboard.artifactId,
      packageSetArtifactId: packageSet.artifactId,
      availableMinor: budgetSnapshot.available.amountMinor,
      env,
      at,
      correlationId: "routing-dry-run",
    });

    if (phase11a) {
      return {
        executable: true,
        providerCalled: false,
        executionAvailable: canExecuteSyntheticDirectorPipeline(env),
        briefRevision: brief.revision,
        briefArtifactId: brief.artifactId,
        storyboardRevision: storyboard.revision,
        storyboardArtifactId: storyboard.artifactId,
        scenePackageSetRevision: packageSet.revision,
        scenePackageSetArtifactId: packageSet.artifactId,
        registryVersion,
        registrySchemaVersion: CAPABILITY_REGISTRY_SCHEMA_VERSION,
        policyVersion: DEFAULT_ROUTING_POLICY_VERSION,
        schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
        budgetAvailableMinor: budgetSnapshot.available.amountMinor,
        budgetLimitMinor: budgetSnapshot.limit.amountMinor,
        currency: budgetSnapshot.limit.currency,
        estimatedCostMinor: phase11a.estimateMinor,
        validations: [
          ...validations,
          {
            code: "phase11a_single_step",
            passed: true,
            message: "GenerationPlan single-step VHS-124 matérialisable.",
          },
          {
            code: "canonical_routing",
            passed: true,
            message: "Chemin POST /routing canonique Phase 11A.",
          },
        ],
        warnings: [
          {
            code: "vhs124_temporary_exception",
            message:
              "Does not declare global Production Registry real-provider compatibility.",
          },
        ],
        missingInformation: [],
        existingPlan,
        phase11ACanonicalSingleStep: {
          enabled: true,
          compositionFingerprint: phase11ARuntimeCompositionFingerprint(),
          sceneId: "scene-2",
          provider: "openai",
          model: "gpt-image-1",
          quality: "low",
          size: "1024x1024",
          estimateMinor: phase11a.estimateMinor,
          reservationMinor: phase11a.reservationMinor,
          stepCount: 1,
          fallbackCount: 0,
          planFingerprint: phase11a.fingerprint,
        },
      };
    }

    return {
      executable: readiness.executable,
      providerCalled: false,
      executionAvailable:
        readiness.executable && canExecuteSyntheticDirectorPipeline(env),
      briefRevision: brief.revision,
      briefArtifactId: brief.artifactId,
      storyboardRevision: storyboard.revision,
      storyboardArtifactId: storyboard.artifactId,
      scenePackageSetRevision: packageSet.revision,
      scenePackageSetArtifactId: packageSet.artifactId,
      registryVersion,
      registrySchemaVersion: CAPABILITY_REGISTRY_SCHEMA_VERSION,
      policyVersion: DEFAULT_ROUTING_POLICY_VERSION,
      schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
      budgetAvailableMinor: budgetSnapshot.available.amountMinor,
      budgetLimitMinor: budgetSnapshot.limit.amountMinor,
      currency: budgetSnapshot.limit.currency,
      estimatedCostMinor: readiness.estimatedCostRange?.min.amountMinor,
      validations,
      warnings: readiness.warnings.map((w) => ({ code: w.code, message: w.message })),
      missingInformation: readiness.failures.map((f) => ({
        code: f.reasonCodes[0] ?? "routing_failure",
        message: f.message,
        field: f.sceneId,
      })),
      existingPlan,
    };
  }

  return {
    dryRun: async (input) => dry(input),
    async execute(input, context) {
      const denied = authorizeDirectorAction(
        { routeId: "routing", method: "POST", mode: "execute" },
        env,
      );
      if (!denied.allowed) {
        return failed(denied.code, denied.publicMessage, 503);
      }
      if (!canUseDirectorV2Persistence(env)) {
        return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failed("not_found", "Projet introuvable.", 400);
      }
      const { brief, storyboard, packageSet } = await loadSources(input.projectId);
      if (!brief) return failed("brief_missing", "Brief actif introuvable.", 422);
      if (!storyboard) return failed("storyboard_missing", "Storyboard actif introuvable.", 422);
      if (!packageSet) {
        return failed("scene_package_set_missing", "ScenePackageSet actif introuvable.", 422);
      }
      if (
        input.expectedScenePackageSetRevision != null &&
        input.expectedScenePackageSetRevision !== packageSet.revision
      ) {
        return failed(
          "scene_package_set_revision_conflict",
          "Le ScenePackageSet a changé depuis la vérification.",
          409,
        );
      }

      const at = nowIso();
      const registry = buildRegistryForRun(at);
      if (
        input.expectedRegistrySnapshotVersion != null &&
        input.expectedRegistrySnapshotVersion !== registry.registryVersion
      ) {
        return failed(
          "registry_snapshot_conflict",
          "Le Registry snapshot a changé depuis la vérification.",
          409,
        );
      }

      const check = await dry(input);
      if (!check.executable) {
        return {
          status: "needs_input",
          missingInformation: check.missingInformation,
          warnings: check.warnings,
        };
      }

      const budgetSnapshot = await deps.budget.loadSnapshot(deps.workspaceId);
      const budgetPolicy = createBudgetPolicy(budgetSnapshot.limit);
      const packages = packagesFromSet(packageSet.value);

      const phase11aPlan = tryPhase11ASingleStep({
        projectId: input.projectId,
        packages,
        storyboardArtifactId: storyboard.artifactId,
        packageSetArtifactId: packageSet.artifactId,
        availableMinor: budgetSnapshot.available.amountMinor,
        env,
        at,
        correlationId: context.correlationId,
      });

      const fields = [
        input.projectId,
        packageSet.artifactId,
        String(packageSet.revision),
        storyboard.artifactId,
        String(storyboard.revision),
        brief.artifactId,
        String(brief.revision),
        registry.registryVersion,
        DEFAULT_ROUTING_POLICY_VERSION,
        GENERATION_PLAN_SCHEMA_VERSION,
        phase11aPlan ? "phase11a-single-step" : "full-router",
        phase11aPlan?.fingerprint ?? "",
      ];
      const raw = ["rtg", ...fields].join(":");
      const key = raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
      const fingerprint = createHash("sha256").update(fields.join("|")).digest("hex");

      const begin = await deps.directorRuns.beginOrGet({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        scenePackageSetArtifactId: packageSet.artifactId,
        scenePackageSetRevision: packageSet.revision,
        storyboardArtifactId: storyboard.artifactId,
        storyboardRevision: storyboard.revision,
        briefArtifactId: brief.artifactId,
        briefRevision: brief.revision,
        registryVersion: registry.registryVersion,
        policyVersion: DEFAULT_ROUTING_POLICY_VERSION,
        schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
        idempotencyKey: key,
        commandFingerprint: fingerprint,
        correlationId: context.correlationId,
      });

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Un routage est déjà en cours.",
        };
      }
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        if (artifact) {
          const approval = await resolveApproval(
            deps.directorRuns,
            input.projectId,
            artifact.id,
            artifact.revision,
          );
          const prior = storedPlan(artifact.value, artifact.revision, {
            artifactId: artifact.id,
            scenePackageSetRevision: packageSet.revision,
            budgetAvailableMinor: budgetSnapshot.available.amountMinor,
            approval,
          });
          if (prior) {
            return { status: "existing", plan: prior, directorRunId: begin.directorRunId };
          }
        }
      }

      const runId = begin.directorRunId;

      if (phase11aPlan) {
        const plan = phase11aPlan.plan;
        const persistable = {
          ...plan,
          artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
          scenePackageRevisionIds: [packageSet.artifactId],
          phase11A: {
            compositionFingerprint: phase11ARuntimeCompositionFingerprint(),
            planFingerprint: phase11aPlan.fingerprint,
            promptHash: phase11aPlan.promptHash,
            singleStep: true,
          },
        } as unknown as Record<string, unknown>;
        try {
          const persisted = await deps.directorRuns.persistGenerationPlan({
            workspaceId: deps.workspaceId,
            projectId: input.projectId,
            directorRunId: runId,
            artifactId: plan.id,
            scenePackageSetArtifactId: packageSet.artifactId,
            scenePackageSetRevision: packageSet.revision,
            storyboardArtifactId: storyboard.artifactId,
            storyboardRevision: storyboard.revision,
            briefArtifactId: brief.artifactId,
            briefRevision: brief.revision,
            plan: persistable,
            schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
            registryVersion: registry.registryVersion,
            policyVersion: DEFAULT_ROUTING_POLICY_VERSION,
            estimatedCostMinor: plan.estimatedCost.amountMinor,
            maximumExposureMinor: plan.estimatedCost.amountMinor,
            currency: plan.currency,
            correlationId: context.correlationId,
            expectedRunRevision: begin.revision,
          });
          return {
            status: persisted.status === "existing" ? "existing" : "completed",
            plan: toSafeView(plan, persisted.revision, {
              artifactId: persisted.artifactId,
              scenePackageSetRevision: packageSet.revision,
              budgetAvailableMinor: budgetSnapshot.available.amountMinor,
              approval: { status: "none" },
              warnings: [
                {
                  code: "vhs124_temporary_exception",
                  message:
                    "Does not declare global Production Registry real-provider compatibility.",
                },
              ],
            }),
            directorRunId: runId,
          };
        } catch {
          await deps.directorRuns
            .failRun({
              directorRunId: runId,
              workspaceId: deps.workspaceId,
              expectedRevision: begin.revision,
              errorCode: "persist_failed",
              status: "failed",
              correlationId: context.correlationId,
            })
            .catch(() => undefined);
          return failed("persist_failed", "La persistance du GenerationPlan a échoué.", 503, {
            directorRunId: runId,
          });
        }
      }

      const routed = router.route(
        {
          storyboard: storyboard.value,
          scenePackages: packages,
          registry,
          routingPolicy: policy,
          budgetPolicy,
          budgetSnapshot,
          metadata: {
            id: id(),
            createdBy: "shared-password-user",
            createdAt: at,
          },
        },
        { at, correlationId: context.correlationId },
      );

      if (routed.status === "budget_exceeded") {
        await deps.directorRuns.failRun({
          directorRunId: runId,
          workspaceId: deps.workspaceId,
          expectedRevision: begin.revision,
          errorCode: "budget_exceeded",
          status: "failed",
          correlationId: context.correlationId,
        });
        return failed(
          "budget_exceeded",
          "Budget insuffisant pour le chemin principal.",
          402,
          { directorRunId: runId },
        );
      }
      if (routed.status === "no_eligible_strategy") {
        await deps.directorRuns.failRun({
          directorRunId: runId,
          workspaceId: deps.workspaceId,
          expectedRevision: begin.revision,
          errorCode: "no_eligible_strategy",
          status: "needs_input",
          correlationId: context.correlationId,
        });
        return {
          status: "needs_input",
          missingInformation: routed.sceneFailures.map((f) => ({
            code: f.reasonCodes[0] ?? "no_strategy",
            message: f.message,
            field: f.sceneId,
          })),
          warnings: routed.warnings.map((w) => ({ code: w.code, message: w.message })),
          directorRunId: runId,
        };
      }
      if (routed.status === "invalid") {
        await deps.directorRuns.failRun({
          directorRunId: runId,
          workspaceId: deps.workspaceId,
          expectedRevision: begin.revision,
          errorCode: "invalid_plan",
          status: "failed",
          correlationId: context.correlationId,
        });
        return failed(
          "invalid_plan",
          routed.errors[0]?.message ?? "GenerationPlan invalide.",
          422,
          { directorRunId: runId },
        );
      }

      const plan = routed.plan;
      if (plan.artifactType !== GENERATION_PLAN_ARTIFACT_TYPE) {
        return failed("invalid_plan", "Type d'artifact inattendu.", 500, { directorRunId: runId });
      }
      // Ensure provenance fields for persistence
      const persistable = {
        ...plan,
        artifactType: GENERATION_PLAN_ARTIFACT_TYPE,
        scenePackageRevisionIds: [packageSet.artifactId],
      } as unknown as Record<string, unknown>;

      try {
        const persisted = await deps.directorRuns.persistGenerationPlan({
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          directorRunId: runId,
          artifactId: plan.id,
          scenePackageSetArtifactId: packageSet.artifactId,
          scenePackageSetRevision: packageSet.revision,
          storyboardArtifactId: storyboard.artifactId,
          storyboardRevision: storyboard.revision,
          briefArtifactId: brief.artifactId,
          briefRevision: brief.revision,
          plan: persistable,
          schemaVersion: GENERATION_PLAN_SCHEMA_VERSION,
          registryVersion: registry.registryVersion,
          policyVersion: DEFAULT_ROUTING_POLICY_VERSION,
          estimatedCostMinor: plan.estimatedCost.amountMinor,
          maximumExposureMinor: (plan.fallbackExposure ?? plan.estimatedCost).amountMinor,
          currency: plan.currency,
          correlationId: context.correlationId,
          expectedRunRevision: begin.revision,
        });
        return {
          status: persisted.status === "existing" ? "existing" : "completed",
          plan: toSafeView(plan, persisted.revision, {
            artifactId: persisted.artifactId,
            scenePackageSetRevision: packageSet.revision,
            budgetAvailableMinor: budgetSnapshot.available.amountMinor,
            approval: { status: "none" },
            warnings: routed.warnings.map((w) => ({ code: w.code, message: w.message })),
          }),
          directorRunId: runId,
        };
      } catch {
        await deps.directorRuns
          .failRun({
            directorRunId: runId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: "persist_failed",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failed("persist_failed", "La persistance du GenerationPlan a échoué.", 503, {
          directorRunId: runId,
        });
      }
    },
  };
}

/** Default budget port helper used by repositories — reserved/spent from ledger. */
export function createBudgetSnapshotFromAmounts(input: {
  limitMinor: number;
  reservedMinor: number;
  spentMinor: number;
  currency: string;
}): BudgetSnapshot {
  return createBudgetSnapshot({
    limit: money(input.limitMinor, input.currency),
    reserved: money(input.reservedMinor, input.currency),
    spent: money(input.spentMinor, input.currency),
  });
}

/** Build Phase 11A single-step plan when VHS-124 exception is active for the smoke project. */
export function tryPhase11ASingleStep(input: {
  projectId: string;
  packages: readonly ScenePackage[];
  storyboardArtifactId: string;
  packageSetArtifactId: string;
  availableMinor: number;
  env: Record<string, string | undefined>;
  at: string;
  correlationId: string;
}): ReturnType<typeof buildPhase11ASingleStepGenerationPlan> | null {
  if (input.projectId !== PHASE_11A_SMOKE_PROJECT_ID) return null;
  if (!isVhs124OpenAIImageExceptionEnabled(input.env)) return null;
  if (isVhs124OpenAIImageExceptionExpired(input.at)) return null;
  try {
    const scenePackage = selectPhase11AScene2Package({ packages: input.packages });
    return buildPhase11ASingleStepGenerationPlan({
      projectId: input.projectId,
      storyboardRevisionId: input.storyboardArtifactId,
      scenePackageRevisionIds: [input.packageSetArtifactId],
      scenePackage,
      createdAt: input.at,
      createdBy: "shared-password-user",
      correlationId: input.correlationId,
      availableAfterMinor: input.availableMinor,
    });
  } catch {
    return null;
  }
}

void SCENE_PACKAGE_SET_ARTIFACT_TYPE;

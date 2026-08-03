/**
 * VHS-124 — start Production Director for a project (persisted path).
 * dry-run never writes; execute requires confirmation + approved generation_plan.
 * Providers are never called here — only enqueue root jobs for the worker.
 */
import { createHash, randomUUID } from "node:crypto";
import type { BudgetSnapshot } from "@/domain/cost";
import {
  REQUIRED_FOR_PRODUCTION,
  checkProductionReadiness,
  createApproval,
  type Approval,
  type ArtifactType,
  type ProductionReadiness,
  type ProductionReadinessInput,
} from "@/domain/project";
import {
  GENERATION_PLAN_ARTIFACT_TYPE,
  type GenerationPlan,
} from "@/domain/routing/router";
import {
  ScenePackageSetSchema,
  type ScenePackage,
  type ScenePackageSet,
} from "@/domain/prompt";
import { VideoProjectBriefSchema } from "@/domain/brief";
import { StoryboardProjectSchema } from "@/domain/storyboard";
import {
  isTerminalRunStatus,
  type ProductionRun,
  type ProductionRunStatus,
} from "@/domain/production";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import type { DirectorRunContext } from "@/application/directors/marketing/result";
import type { RoutingBudgetPort } from "@/application/directors/routing/route-for-project";
import type {
  ProductionDirector,
  ProductionExecutionContext,
} from "@/application/production/production-director";
import type { JobQueuePort } from "@/application/production/enqueue";
import type { ProductionPorts } from "@/application/production/ports";
import { runProductionDryRun } from "@/application/production/dry-run";
import type { ProviderAdapterRegistry } from "@/application/generation/adapter-registry";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";

type Warning = { code: string; message: string };

export type ProductionStepView = {
  stepId: string;
  sceneId: string;
  order: number;
  status: string;
  providerId?: string;
  modelId?: string;
  attemptCount: number;
};

export type ProductionSceneView = {
  sceneId: string;
  sceneOrder: number;
  status: string;
  steps: ProductionStepView[];
};

export type ProductionRunView = {
  runId: string;
  status: ProductionRunStatus;
  revision: number;
  generationPlanArtifactId: string;
  generationPlanRevision: number;
  estimatedCostMinor: number;
  committedCostMinor: number;
  releasedCostMinor: number;
  currency: string;
  sceneCount: number;
  scenes: ProductionSceneView[];
  waitingReason?: string;
  warnings: Warning[];
};

export type ProductionApprovalState = {
  artifactType: ArtifactType;
  status: "approved" | "rejected" | "none" | "stale" | "missing";
  revision?: number;
  artifactId?: string;
  decidedAt?: string;
};

export type ProductionProjectDryRunResult = {
  executable: boolean;
  providerCalled: false;
  executionAvailable: boolean;
  briefRevision: number;
  briefArtifactId: string;
  storyboardRevision: number;
  storyboardArtifactId: string;
  scenePackageSetRevision: number;
  scenePackageSetArtifactId: string;
  generationPlanRevision: number;
  generationPlanArtifactId: string;
  readiness: ProductionReadiness;
  approvals: ProductionApprovalState[];
  /** Active artifacts marked stale by upstream revision (VHS-126). */
  artifactStale: ArtifactType[];
  budgetAvailableMinor: number;
  budgetLimitMinor: number;
  currency: string;
  estimatedCostMinor?: number;
  maximumExposureMinor?: number;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Warning[];
  missingInformation: Array<{ code: string; message: string; field?: string }>;
  existingRun?: ProductionRunView;
};

export type ProductionProjectInput = {
  projectId: string;
  expectedGenerationPlanRevision?: number;
};

export type ProductionExecuteInput = ProductionProjectInput & {
  confirmation: true;
};

export type ProductionCancelInput = {
  projectId: string;
  runId: string;
  expectedRunRevision: number;
  reason: string;
  confirmation: true;
};

export type ProductionProjectResult =
  | { status: "completed" | "existing"; run: ProductionRunView; directorRunId: string }
  | { status: "already_running"; directorRunId: string; publicMessage: string; run?: ProductionRunView }
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

export type ProductionCancelResult =
  | { status: "cancelled" | "cancelling"; run: ProductionRunView }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 409 | 422 | 503;
    };

export type ProductionApprovalRecord = {
  id: string;
  artifactType: ArtifactType;
  artifactId: string;
  revision: number;
  status: "approved" | "rejected";
  decidedAt: string;
  decidedBy: string;
};

export type ProductionDirectorRunPort = {
  beginOrGet(input: {
    id: string;
    workspaceId: string;
    projectId: string;
    generationPlanArtifactId: string;
    generationPlanRevision: number;
    idempotencyKey: string;
    commandFingerprint: string;
    correlationId: string;
  }): Promise<
    | { status: "created"; directorRunId: string; revision: number }
    | {
        status: "existing";
        directorRunId: string;
        revision: number;
        productionRunId: string | null;
      }
    | { status: "already_running"; directorRunId: string; revision: number; productionRunId?: string | null }
  >;
  complete(input: {
    directorRunId: string;
    workspaceId: string;
    projectId: string;
    productionRunId: string;
    expectedRunRevision: number;
    correlationId: string;
  }): Promise<{ status: "created" | "existing"; productionRunId: string; revision: number }>;
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
  loadApprovalsForProduction(projectId: string): Promise<ProductionApprovalRecord[]>;
  loadActiveProductionRun(projectId: string): Promise<ProductionRun | null>;
  loadProductionRunById(runId: string): Promise<ProductionRun | null>;
  loadLatestTerminalProductionRun(projectId: string): Promise<ProductionRun | null>;
};

export type StartProductionForProjectDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  directorRuns: ProductionDirectorRunPort;
  budget: RoutingBudgetPort;
  productionDirector: ProductionDirector;
  jobQueue: JobQueuePort;
  registry: ProviderAdapterRegistry;
  /** Ports used by dry-run readiness (idempotency durable, etc.). */
  productionPorts: ProductionPorts;
  /** Seed plan/packages into sync resolvers before PD calls. */
  hydratePlan?: (plan: GenerationPlan, packages: ScenePackage[]) => void | Promise<void>;
  /** Optional list of active stale artifact types (VHS-126). */
  listStaleTypes?: (projectId: string) => Promise<ArtifactType[]>;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
  nowIso?: () => string;
};

export type StartProductionForProject = {
  dryRun(
    input: ProductionProjectInput,
    context: DirectorRunContext,
  ): Promise<ProductionProjectDryRunResult>;
  execute(
    input: ProductionExecuteInput,
    context: DirectorRunContext,
  ): Promise<ProductionProjectResult>;
  cancel(
    input: ProductionCancelInput,
    context: DirectorRunContext,
  ): Promise<ProductionCancelResult>;
};

function failed(
  code: string,
  publicMessage: string,
  httpHint: Extract<ProductionProjectResult, { status: "failed" }>["httpHint"],
  extra: Partial<Extract<ProductionProjectResult, { status: "failed" }>> = {},
): Extract<ProductionProjectResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false, ...extra };
}

const PRODUCTION_STALE_BLOCKERS: readonly ArtifactType[] = [
  "storyboard_project",
  "scene_package_set",
  "generation_plan",
];

function empty(
  partial: Partial<ProductionProjectDryRunResult> &
    Pick<ProductionProjectDryRunResult, "validations" | "missingInformation" | "readiness" | "approvals">,
): ProductionProjectDryRunResult {
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
    generationPlanRevision: 0,
    generationPlanArtifactId: "",
    artifactStale: [],
    budgetAvailableMinor: 0,
    budgetLimitMinor: 0,
    currency: "USD",
    warnings: [],
    ...partial,
  };
}

async function activeArtifact(
  artifacts: ArtifactRepository,
  projectId: string,
  type: "video_project_brief" | "storyboard_project" | "scene_package_set" | "generation_plan",
) {
  const current = await artifacts.getActive(projectId, type);
  if (!current) return null;
  const item = await artifacts.load(current.artifactId);
  if (!item) return null;
  return { artifactId: current.artifactId, revision: current.revision, value: item.value };
}

function parsePlan(value: unknown): GenerationPlan | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as GenerationPlan;
  if (raw.artifactType !== GENERATION_PLAN_ARTIFACT_TYPE) return null;
  if (!Array.isArray(raw.scenePlans) || raw.scenePlans.length < 1) return null;
  return raw;
}

function toSafeRunView(
  run: ProductionRun,
  planArtifactId: string,
  planRevision: number,
  warnings: Warning[] = [],
): ProductionRunView {
  return {
    runId: run.id,
    status: run.status,
    revision: run.revision,
    generationPlanArtifactId: planArtifactId,
    generationPlanRevision: planRevision,
    estimatedCostMinor: run.estimatedCost.amountMinor,
    committedCostMinor: run.committedCost.amountMinor,
    releasedCostMinor: run.releasedCost.amountMinor,
    currency: run.currency,
    sceneCount: run.scenes.length,
    scenes: [...run.scenes]
      .sort((a, b) => a.sceneOrder - b.sceneOrder)
      .map((scene) => ({
        sceneId: scene.sceneId,
        sceneOrder: scene.sceneOrder,
        status: scene.status,
        steps: [...scene.steps]
          .sort((a, b) => a.order - b.order)
          .map((step) => {
            const last = step.attempts[step.attempts.length - 1];
            return {
              stepId: step.stepId,
              sceneId: step.sceneId,
              order: step.order,
              status: step.status,
              providerId: last?.providerId ? String(last.providerId) : undefined,
              modelId: last?.modelId ? String(last.modelId) : undefined,
              attemptCount: step.attempts.length,
            };
          }),
      })),
    waitingReason: run.waitingReason,
    warnings,
  };
}

function buildReadinessInput(input: {
  projectId: string;
  brief: { artifactId: string; revision: number } | null;
  storyboard: { artifactId: string; revision: number } | null;
  plan: { artifactId: string; revision: number } | null;
  approvals: ProductionApprovalRecord[];
  at: string;
}): ProductionReadinessInput {
  const activeByType: ProductionReadinessInput["activeByType"] = {};
  if (input.brief) {
    activeByType.video_project_brief = {
      projectId: input.projectId,
      artifactType: "video_project_brief",
      revisionId: input.brief.artifactId,
      revision: input.brief.revision,
      updatedAt: input.at,
      updatedBy: "system",
    };
  }
  if (input.storyboard) {
    activeByType.storyboard_project = {
      projectId: input.projectId,
      artifactType: "storyboard_project",
      revisionId: input.storyboard.artifactId,
      revision: input.storyboard.revision,
      updatedAt: input.at,
      updatedBy: "system",
    };
  }
  if (input.plan) {
    activeByType.generation_plan = {
      projectId: input.projectId,
      artifactType: "generation_plan",
      revisionId: input.plan.artifactId,
      revision: input.plan.revision,
      updatedAt: input.at,
      updatedBy: "system",
    };
  }

  const approvalsByType: Partial<Record<ArtifactType, Approval>> = {};
  for (const type of REQUIRED_FOR_PRODUCTION) {
    const latest = input.approvals.find((a) => a.artifactType === type);
    if (!latest) continue;
    const active = activeByType[type];
    if (!active) continue;
    approvalsByType[type] = createApproval({
      id: latest.id,
      target: {
        id: latest.artifactId,
        projectId: input.projectId,
        artifactType: type,
        revision: latest.revision,
        schemaVersion: "1.0.0",
        value: {},
        createdAt: latest.decidedAt,
        createdBy: latest.decidedBy,
        correlationId: "approval-readiness",
      },
      status: latest.status,
      decidedBy: latest.decidedBy,
      decidedAt: latest.decidedAt,
    });
  }

  return {
    projectId: input.projectId,
    activeByType,
    approvalsByType,
    requiredTypes: REQUIRED_FOR_PRODUCTION,
  };
}

function approvalStates(
  readinessInput: ProductionReadinessInput,
  approvals: ProductionApprovalRecord[],
): ProductionApprovalState[] {
  return REQUIRED_FOR_PRODUCTION.map((type) => {
    const active = readinessInput.activeByType[type];
    if (!active) {
      return { artifactType: type, status: "missing" as const };
    }
    const latest = approvals.find((a) => a.artifactType === type);
    if (!latest) {
      return {
        artifactType: type,
        status: "none" as const,
        revision: active.revision,
        artifactId: active.revisionId,
      };
    }
    if (latest.artifactId !== active.revisionId || latest.revision !== active.revision) {
      return {
        artifactType: type,
        status: "stale" as const,
        revision: latest.revision,
        artifactId: latest.artifactId,
        decidedAt: latest.decidedAt,
      };
    }
    return {
      artifactType: type,
      status: latest.status,
      revision: latest.revision,
      artifactId: latest.artifactId,
      decidedAt: latest.decidedAt,
    };
  });
}

function packagesFromSet(set: ScenePackageSet): ScenePackage[] {
  return [...set.packages].sort((a, b) => a.sceneOrder - b.sceneOrder);
}

function execContext(
  context: DirectorRunContext,
  id: () => string,
  nowIso: () => string,
): ProductionExecutionContext {
  return {
    correlationId: context.correlationId,
    actorId: "shared-password-user",
    nowIso,
    nextId: id,
    maxActionsPerAdvance: 2,
    paidGenerationEnabled: false,
  };
}

export function createStartProductionForProject(
  deps: StartProductionForProjectDeps,
): StartProductionForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  async function loadSources(projectId: string) {
    const [briefRaw, storyboardRaw, packageSetRaw, planRaw] = await Promise.all([
      activeArtifact(deps.artifacts, projectId, "video_project_brief"),
      activeArtifact(deps.artifacts, projectId, "storyboard_project"),
      activeArtifact(deps.artifacts, projectId, "scene_package_set"),
      activeArtifact(deps.artifacts, projectId, "generation_plan"),
    ]);
    const brief =
      briefRaw && VideoProjectBriefSchema.safeParse(briefRaw.value).success
        ? { ...briefRaw, value: VideoProjectBriefSchema.parse(briefRaw.value) }
        : null;
    const storyboard =
      storyboardRaw && StoryboardProjectSchema.safeParse(storyboardRaw.value).success
        ? { ...storyboardRaw, value: StoryboardProjectSchema.parse(storyboardRaw.value) }
        : null;
    const packageSet =
      packageSetRaw && ScenePackageSetSchema.safeParse(packageSetRaw.value).success
        ? { ...packageSetRaw, value: ScenePackageSetSchema.parse(packageSetRaw.value) }
        : null;
    const plan =
      planRaw && parsePlan(planRaw.value)
        ? { ...planRaw, value: parsePlan(planRaw.value)! }
        : null;
    return { brief, storyboard, packageSet, plan };
  }

  async function dry(input: ProductionProjectInput): Promise<ProductionProjectDryRunResult> {
    if (!canUseDirectorV2Persistence(env)) {
      return empty({
        readiness: { ready: false, missing: [...REQUIRED_FOR_PRODUCTION], unapproved: [], stale: [] },
        approvals: REQUIRED_FOR_PRODUCTION.map((t) => ({ artifactType: t, status: "missing" })),
        validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }],
        missingInformation: [],
      });
    }
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) {
      return empty({
        readiness: { ready: false, missing: [...REQUIRED_FOR_PRODUCTION], unapproved: [], stale: [] },
        approvals: REQUIRED_FOR_PRODUCTION.map((t) => ({ artifactType: t, status: "missing" })),
        validations: [{ code: "project", passed: false, message: "Projet introuvable." }],
        missingInformation: [{ code: "project_missing", message: "Projet introuvable." }],
      });
    }

    const { brief, storyboard, packageSet, plan } = await loadSources(input.projectId);
    const approvals = await deps.directorRuns.loadApprovalsForProduction(input.projectId);
    const at = nowIso();
    const readinessInput = buildReadinessInput({
      projectId: input.projectId,
      brief,
      storyboard,
      plan,
      approvals,
      at,
    });
    const readiness = checkProductionReadiness(readinessInput);
    const approvalViews = approvalStates(readinessInput, approvals);
    const staleListed = deps.listStaleTypes
      ? await deps.listStaleTypes(input.projectId)
      : [];
    const artifactStale = PRODUCTION_STALE_BLOCKERS.filter((t) => staleListed.includes(t));

    if (!brief || !storyboard || !packageSet || !plan) {
      const missing = !brief
        ? "brief"
        : !storyboard
          ? "storyboard_project"
          : !packageSet
            ? "scene_package_set"
            : "generation_plan";
      return empty({
        briefRevision: brief?.revision ?? 0,
        briefArtifactId: brief?.artifactId ?? "",
        storyboardRevision: storyboard?.revision ?? 0,
        storyboardArtifactId: storyboard?.artifactId ?? "",
        scenePackageSetRevision: packageSet?.revision ?? 0,
        scenePackageSetArtifactId: packageSet?.artifactId ?? "",
        generationPlanRevision: plan?.revision ?? 0,
        generationPlanArtifactId: plan?.artifactId ?? "",
        readiness,
        approvals: approvalViews,
        artifactStale,
        validations: [
          { code: missing, passed: false, message: `Pré-requis actif introuvable (${missing}).` },
        ],
        missingInformation: [{ code: `${missing}_missing`, message: "Pré-requis actif introuvable." }],
      });
    }

    const budgetSnapshot = await deps.budget.loadSnapshot(deps.workspaceId);
    const packages = packagesFromSet(packageSet.value);
    const dryResult = runProductionDryRun({
      plan: plan.value,
      scenePackages: packages,
      readiness: readinessInput,
      budgetSnapshot,
      registry: deps.registry,
      ports: deps.productionPorts,
      at,
    });

    const existing =
      (await deps.directorRuns.loadActiveProductionRun(input.projectId)) ??
      (await deps.directorRuns.loadLatestTerminalProductionRun(input.projectId));
    const existingRun = existing
      ? toSafeRunView(existing, plan.artifactId, plan.revision)
      : undefined;

    const staleBlocked = artifactStale.length > 0;
    const ready = dryResult.executable && readiness.ready && !staleBlocked;

    return {
      executable: ready,
      providerCalled: false,
      executionAvailable: ready,
      briefRevision: brief.revision,
      briefArtifactId: brief.artifactId,
      storyboardRevision: storyboard.revision,
      storyboardArtifactId: storyboard.artifactId,
      scenePackageSetRevision: packageSet.revision,
      scenePackageSetArtifactId: packageSet.artifactId,
      generationPlanRevision: plan.revision,
      generationPlanArtifactId: plan.artifactId,
      readiness,
      approvals: approvalViews,
      artifactStale,
      budgetAvailableMinor: budgetSnapshot.available.amountMinor,
      budgetLimitMinor: budgetSnapshot.limit.amountMinor,
      currency: budgetSnapshot.limit.currency,
      estimatedCostMinor: plan.value.estimatedCost.amountMinor,
      maximumExposureMinor: (plan.value.fallbackExposure ?? plan.value.estimatedCost).amountMinor,
      validations: [
        ...dryResult.validations,
        ...artifactStale.map((t) => ({
          code: `${t}_artifact_stale`,
          passed: false,
          message: `Artifact actif obsolète (${t}) — relancer depuis le point de reprise.`,
        })),
      ],
      warnings: dryResult.warnings.map((w) => ({ code: w.code, message: w.message })),
      missingInformation: [
        ...readiness.missing.map((t) => ({
          code: `${t}_missing`,
          message: `Artifact manquant: ${t}`,
          field: t,
        })),
        ...readiness.unapproved.map((t) => ({
          code: `${t}_unapproved`,
          message: `Non approuvé: ${t}`,
          field: t,
        })),
        ...readiness.stale.map((t) => ({
          code: `${t}_stale`,
          message: `Approbation obsolète: ${t}`,
          field: t,
        })),
        ...artifactStale.map((t) => ({
          code: `${t}_artifact_stale`,
          message: `Artifact actif obsolète: ${t}`,
          field: t,
        })),
      ],
      existingRun,
    };
  }

  return {
    dryRun: async (input) => dry(input),

    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failed("confirmation_required", "Confirmation requise.", 400);
      }

      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failed("not_found", "Projet introuvable.", 400);
      }

      const { brief, storyboard, packageSet, plan } = await loadSources(input.projectId);
      if (!brief) return failed("brief_missing", "Brief actif introuvable.", 422);
      if (!storyboard) return failed("storyboard_missing", "Storyboard actif introuvable.", 422);
      if (!packageSet) {
        return failed("scene_package_set_missing", "ScenePackageSet actif introuvable.", 422);
      }
      if (!plan) return failed("generation_plan_missing", "GenerationPlan actif introuvable.", 422);

      if (
        input.expectedGenerationPlanRevision != null &&
        input.expectedGenerationPlanRevision !== plan.revision
      ) {
        return failed(
          "generation_plan_revision_conflict",
          "Le GenerationPlan a changé depuis la vérification.",
          409,
        );
      }

      const check = await dry(input);
      if (!check.executable) {
        if (!check.readiness.ready) {
          return {
            status: "needs_input",
            missingInformation: check.missingInformation,
            warnings: check.warnings,
          };
        }
        return {
          status: "needs_input",
          missingInformation: check.missingInformation.length
            ? check.missingInformation
            : [{ code: "not_ready", message: "Production non exécutable." }],
          warnings: check.warnings,
        };
      }

      const approvals = await deps.directorRuns.loadApprovalsForProduction(input.projectId);
      const at = nowIso();
      const readinessInput = buildReadinessInput({
        projectId: input.projectId,
        brief,
        storyboard,
        plan,
        approvals,
        at,
      });
      const readiness = checkProductionReadiness(readinessInput);
      if (!readiness.ready) {
        return {
          status: "needs_input",
          missingInformation: [
            ...readiness.unapproved.map((t) => ({
              code: `${t}_unapproved`,
              message: `Non approuvé: ${t}`,
              field: t,
            })),
            ...readiness.stale.map((t) => ({
              code: `${t}_stale`,
              message: `Approbation obsolète: ${t}`,
              field: t,
            })),
            ...readiness.missing.map((t) => ({
              code: `${t}_missing`,
              message: `Artifact manquant: ${t}`,
              field: t,
            })),
          ],
          warnings: [],
        };
      }

      const budgetSnapshot = await deps.budget.loadSnapshot(deps.workspaceId);
      const packages = packagesFromSet(packageSet.value);
      const fields = [
        input.projectId,
        plan.artifactId,
        String(plan.revision),
        "production-v1",
      ];
      const raw = ["prd", ...fields].join(":");
      const key = raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
      const fingerprint = createHash("sha256").update(fields.join("|")).digest("hex");

      const begin = await deps.directorRuns.beginOrGet({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        generationPlanArtifactId: plan.artifactId,
        generationPlanRevision: plan.revision,
        idempotencyKey: key,
        commandFingerprint: fingerprint,
        correlationId: context.correlationId,
      });

      if (begin.status === "already_running") {
        const active = await deps.directorRuns.loadActiveProductionRun(input.projectId);
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Une production est déjà en cours.",
          run: active
            ? toSafeRunView(active, plan.artifactId, plan.revision)
            : undefined,
        };
      }

      if (begin.status === "existing" && begin.productionRunId) {
        const loaded =
          (await deps.directorRuns.loadProductionRunById(begin.productionRunId)) ??
          (await deps.directorRuns.loadActiveProductionRun(input.projectId));
        if (loaded) {
          return {
            status: "existing",
            run: toSafeRunView(loaded, plan.artifactId, plan.revision),
            directorRunId: begin.directorRunId,
          };
        }
      }

      if (deps.hydratePlan) {
        await deps.hydratePlan(plan.value, packages);
      }

      const runId = id();
      const started = await deps.productionDirector.start(
        {
          plan: plan.value,
          scenePackages: packages,
          readiness: readinessInput,
          budgetSnapshot,
          runId,
          requireDurableIdempotency: true,
        },
        execContext(context, id, nowIso),
      );

      if (started.status !== "started") {
        await deps.directorRuns
          .failRun({
            directorRunId: begin.directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: started.status === "failed" ? started.errors[0]?.code ?? "start_failed" : "start_failed",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failed(
          started.status === "failed" ? started.errors[0]?.code ?? "start_failed" : "start_failed",
          started.status === "failed"
            ? started.errors[0]?.message ?? "Échec du démarrage production."
            : "Échec du démarrage production.",
          started.status === "failed" && started.errors[0]?.code === "budget_reservation_failed"
            ? 402
            : 422,
          { directorRunId: begin.directorRunId },
        );
      }

      const planned = await deps.productionDirector.planEnqueueCommands(
        started.run.id,
        execContext(context, id, nowIso),
      );
      for (const command of planned.commands) {
        await deps.jobQueue.enqueue(command);
      }

      try {
        await deps.directorRuns.complete({
          directorRunId: begin.directorRunId,
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          productionRunId: started.run.id,
          expectedRunRevision: begin.revision,
          correlationId: context.correlationId,
        });
      } catch {
        // Run + jobs already created — surface as completed with warning
        return {
          status: "completed",
          run: toSafeRunView(started.run, plan.artifactId, plan.revision, [
            {
              code: "director_run_complete_deferred",
              message: "Production démarrée ; finalisation audit différée.",
            },
          ]),
          directorRunId: begin.directorRunId,
        };
      }

      return {
        status: "completed",
        run: toSafeRunView(started.run, plan.artifactId, plan.revision),
        directorRunId: begin.directorRunId,
      };
    },

    async cancel(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return {
          status: "failed",
          code: "persistence_disabled",
          publicMessage: "Persistance Director désactivée.",
          retryable: false,
          httpHint: 503,
        };
      }
      if (input.confirmation !== true) {
        return {
          status: "failed",
          code: "confirmation_required",
          publicMessage: "Confirmation requise.",
          retryable: false,
          httpHint: 400,
        };
      }
      if (!input.reason?.trim()) {
        return {
          status: "failed",
          code: "reason_required",
          publicMessage: "Motif d'annulation requis.",
          retryable: false,
          httpHint: 400,
        };
      }

      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return {
          status: "failed",
          code: "not_found",
          publicMessage: "Projet introuvable.",
          retryable: false,
          httpHint: 400,
        };
      }

      const active = await deps.directorRuns.loadActiveProductionRun(input.projectId);
      const run =
        active?.id === input.runId
          ? active
          : await deps.directorRuns.loadProductionRunById(input.runId);
      if (!run || run.projectId !== input.projectId) {
        return {
          status: "failed",
          code: "run_not_found",
          publicMessage: "Run de production introuvable.",
          retryable: false,
          httpHint: 422,
        };
      }
      if (run.revision !== input.expectedRunRevision) {
        return {
          status: "failed",
          code: "run_revision_conflict",
          publicMessage: "La révision du run a changé.",
          retryable: false,
          httpHint: 409,
        };
      }

      const cancelled = await deps.productionDirector.requestCancellation(
        input.runId,
        execContext(context, id, nowIso),
      );
      const planMeta = await deps.directorRuns.loadActiveGenerationPlan(input.projectId);
      const viewRun = cancelled.status === "failed" && cancelled.run
        ? cancelled.run
        : "run" in cancelled && cancelled.run
          ? cancelled.run
          : run;

      if (cancelled.status === "failed" && !cancelled.run) {
        return {
          status: "failed",
          code: cancelled.errors[0]?.code ?? "cancel_failed",
          publicMessage: cancelled.errors[0]?.message ?? "Annulation impossible.",
          retryable: false,
          httpHint: 422,
        };
      }

      const finalRun = viewRun;
      const planArtifactId = planMeta?.artifactId ?? "";
      const planRevision = planMeta?.revision ?? 0;
      if (finalRun.status === "cancelled" || isTerminalRunStatus(finalRun.status)) {
        return {
          status: "cancelled",
          run: toSafeRunView(finalRun, planArtifactId, planRevision, [
            { code: "cancel_reason", message: input.reason.trim().slice(0, 200) },
          ]),
        };
      }
      return {
        status: "cancelling",
        run: toSafeRunView(finalRun, planArtifactId, planRevision, [
          { code: "cancel_reason", message: input.reason.trim().slice(0, 200) },
        ]),
      };
    },
  };
}

export type { BudgetSnapshot };

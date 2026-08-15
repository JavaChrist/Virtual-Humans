/**
 * VHS-125 — Postproduction delivery services (quality / human review / merge / export).
 * dry-run never writes; execute requires confirmation. Fake merge only — no real
 * fal/OpenAI/AICCOS calls. Reuses PostProductionDirector + postproduction domain —
 * does not duplicate quality/merge-plan/export business logic.
 */
import { createHash, randomUUID } from "node:crypto";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import type { DirectorRunContext } from "@/application/directors/marketing/result";
import type { GeneratedAsset } from "@/domain/generation";
import {
  assertDeliveryTransition,
  withDeliveryUpdate,
  type ProductionDelivery,
  type ProductionResult,
} from "@/domain/production";
import {
  buildMergePlan,
  isPostProductionDomainError,
  type ExportPackage,
  type FinalQualityReport,
  type HumanReviewDecision,
  type MergeExecutionContext,
  type MergePlan,
} from "@/domain/postproduction";
import type { MergeEngine } from "@/application/postproduction/ports";
import type { PostProductionDirector } from "@/application/postproduction/post-production-director";
import type { PostProductionResult } from "@/application/postproduction/result";
import {
  isAssetContentConfigured,
  sha256Hex,
  type AssetContentBackend,
} from "@/application/postproduction/asset-content-port";
import { buildDirectorFinalAssetStoragePath } from "@/application/postproduction/director-final-asset-path";
import { canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import {
  evaluateMergeExportAuthorization,
  readMergeExportAuthorized,
  redactCoherenceError,
} from "@/application/production/artifact-bundle-coherence";
import {
  loadProductionContext,
  type LoadProductionContextDeps,
} from "./load-production-context";
import type { DeliveryDirectorRunPort, MergeOutcomeStatus } from "./ports";

type Warning = { code: string; message: string };
type Validation = { code: string; passed: boolean; message: string };
type MissingInfo = { code: string; message: string };

/** VHS-126 — refuse silent QC/merge/export when active production_result is stale. */
async function activeProductionResultStale(
  artifacts: ArtifactRepository,
  projectId: string,
): Promise<boolean> {
  const active = await artifacts.getActive(projectId, "production_result");
  return active?.stale === true;
}

/** `merge_ready` alone is never sufficient. Fail-closed if authorization is missing. */
function refuseMergeExportIfUnauthorized(productionResult: ProductionResult): {
  ok: true;
} | { ok: false; code: string; message: string } {
  const authorized = readMergeExportAuthorized(productionResult);
  const decision = evaluateMergeExportAuthorization({
    deliveryStatus: productionResult.delivery?.status ?? null,
    mergeExportAuthorized: authorized,
    outputApproved: true,
    outputSelected: true,
    humanReviewApproved:
      Boolean(productionResult.delivery?.humanReviewId) || authorized,
    stale: false,
    quarantined: false,
    bundleCoherent: true,
    downstreamEnabled: false,
    requireActivation: false,
  });
  if (decision.mergeAllowed) return { ok: true };
  const code = decision.reasons[0] ?? "merge_export_unauthorized";
  return {
    ok: false,
    code,
    message: redactCoherenceError(
      code === "merge_ready_without_authorization"
        ? "Merge non autorisé : merge_ready seul est insuffisant."
        : "Merge ou export non autorisé.",
    ),
  };
}

export const QUALITY_REPORT_SCHEMA_VERSION = "1.0.0" as const;
export const MERGE_OUTCOME_SCHEMA_VERSION = "1.0.0" as const;
export const EXPORT_PACKAGE_SCHEMA_VERSION = "1.0.0" as const;

/** Envelope persisted as the `merge_plan` artifact value. */
export type MergeOutcomeRecord = {
  status: MergeOutcomeStatus;
  plan?: MergePlan;
  finalAsset?: GeneratedAsset;
  reason?: string;
};

export type DeliveryCommonDeps = {
  workspaceId: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  deliveryRuns: DeliveryDirectorRunPort;
  env?: Record<string, string | undefined>;
  idFactory?: () => string;
  nowIso?: () => string;
};

/** Composes exported domain primitives — no business-logic duplication. */
function patchDelivery(
  result: ProductionResult,
  nextStatus: ProductionDelivery["status"],
  at: string,
  extra: Partial<ProductionDelivery> = {},
): ProductionResult {
  const current = result.delivery ?? { status: "not_started" as const, updatedAt: at };
  assertDeliveryTransition(current.status, nextStatus);
  return withDeliveryUpdate(result, { ...current, ...extra, status: nextStatus, updatedAt: at });
}

async function activeArtifact<T>(
  artifacts: ArtifactRepository,
  projectId: string,
  type: "quality_report" | "production_result" | "merge_plan" | "export_package",
): Promise<{ artifactId: string; revision: number; value: T } | null> {
  const current = await artifacts.getActive(projectId, type);
  if (!current) return null;
  const item = await artifacts.load(current.artifactId);
  if (!item) return null;
  return { artifactId: current.artifactId, revision: current.revision, value: item.value as T };
}

function idempotencyKey(prefix: string, fields: string[]): string {
  const raw = [prefix, ...fields].join(":");
  return raw.length <= 200 ? raw : createHash("sha256").update(raw).digest("hex");
}

function fingerprintOf(fields: string[]): string {
  return createHash("sha256").update(fields.join("|")).digest("hex");
}

/** `prepare()` only ever returns these three statuses on success — narrow the wider union. */
function isQualityOutcome(
  r: PostProductionResult,
): r is Extract<PostProductionResult, { status: "prepared" | "merge_unavailable" | "needs_review" }> {
  return r.status === "prepared" || r.status === "merge_unavailable" || r.status === "needs_review";
}

/** `prepareExport()` only ever returns "failed" | "export_prepared" — narrow the wider union. */
function isExportPrepared(
  r: PostProductionResult,
): r is Extract<PostProductionResult, { status: "export_prepared" }> {
  return r.status === "export_prepared";
}

// -----------------------------------------------------------------------------
// 1. Evaluate production quality (QC).
// -----------------------------------------------------------------------------

export type EvaluateProductionQualityDeps = DeliveryCommonDeps & {
  postProductionDirector: PostProductionDirector;
  contextDeps: LoadProductionContextDeps;
};

export type EvaluateQualityInput = {
  projectId: string;
  /** Required only when no production_result artifact is active yet. */
  productionRunId?: string;
  allowPartial?: boolean;
};

export type EvaluateQualityExecuteInput = EvaluateQualityInput & { confirmation: true };

export type EvaluateQualityDryRunResult = {
  executable: boolean;
  providerCalled: false;
  quality?: FinalQualityReport;
  mergePlan?: MergePlan;
  productionResultArtifactId: string | null;
  productionResultRevision: number;
  productionRunId?: string;
  validations: Validation[];
  warnings: Warning[];
  missingInformation: MissingInfo[];
};

export type EvaluateQualityResult =
  | {
      status: "completed" | "existing";
      quality: FinalQualityReport;
      productionResultArtifactId: string;
      productionResultRevision: number;
      directorRunId: string;
      humanReviewRequired: boolean;
    }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | { status: "needs_input"; missingInformation: MissingInfo[]; warnings: Warning[] }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 409 | 422 | 503;
      directorRunId?: string;
    };

export type EvaluateProductionQualityForProject = {
  dryRun(
    input: EvaluateQualityInput,
    context: DirectorRunContext,
  ): Promise<EvaluateQualityDryRunResult>;
  execute(
    input: EvaluateQualityExecuteInput,
    context: DirectorRunContext,
  ): Promise<EvaluateQualityResult>;
};

function failedQ(
  code: string,
  publicMessage: string,
  httpHint: 400 | 409 | 422 | 503,
  extra: Partial<Extract<EvaluateQualityResult, { status: "failed" }>> = {},
): Extract<EvaluateQualityResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false, ...extra };
}

export function createEvaluateProductionQualityForProject(
  deps: EvaluateProductionQualityDeps,
): EvaluateProductionQualityForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  async function dry(
    input: EvaluateQualityInput,
    context: DirectorRunContext,
  ): Promise<EvaluateQualityDryRunResult> {
    if (!canUseDirectorV2Persistence(env)) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }],
        warnings: [],
        missingInformation: [],
      };
    }
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [{ code: "project", passed: false, message: "Projet introuvable." }],
        warnings: [],
        missingInformation: [{ code: "project_missing", message: "Projet introuvable." }],
      };
    }

    if (await activeProductionResultStale(deps.artifacts, input.projectId)) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [
          {
            code: "production_result_artifact_stale",
            passed: false,
            message: "ProductionResult obsolète — relancer depuis le point de reprise.",
          },
        ],
        warnings: [],
        missingInformation: [
          {
            code: "production_result_artifact_stale",
            message: "ProductionResult obsolète suite à une révision amont.",
          },
        ],
      };
    }

    const ctx = await loadProductionContext({
      projectId: input.projectId,
      productionRunId: input.productionRunId,
      correlationId: context.correlationId,
      createdBy: context.createdBy ?? "shared-password-user",
      deps: deps.contextDeps,
    });
    if (!ctx.ok) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [{ code: ctx.code, passed: false, message: ctx.message }],
        warnings: [],
        missingInformation: [{ code: ctx.code, message: ctx.message }],
      };
    }

    const prepared = await deps.postProductionDirector.prepare(
      {
        productionResult: ctx.productionResult,
        storyboard: ctx.storyboard,
        scenePackages: ctx.scenePackages,
        aspectRatio: ctx.aspectRatio,
        allowPartial: input.allowPartial,
      },
      { correlationId: context.correlationId, actorId: context.createdBy ?? "shared-password-user", nowIso, nextId: id },
    );

    if (prepared.status === "failed") {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: ctx.productionResultArtifactId,
        productionResultRevision: ctx.productionResultRevision,
        productionRunId: ctx.productionRunId,
        validations: prepared.errors.map((e) => ({ code: e.code, passed: false, message: e.message })),
        warnings: prepared.warnings.map((w) => ({ code: w.code, message: w.message })),
        missingInformation: prepared.errors.map((e) => ({ code: e.code, message: e.message })),
      };
    }
    if (!isQualityOutcome(prepared)) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: ctx.productionResultArtifactId,
        productionResultRevision: ctx.productionResultRevision,
        productionRunId: ctx.productionRunId,
        validations: [{ code: "unexpected_status", passed: false, message: "Statut inattendu." }],
        warnings: [],
        missingInformation: [{ code: "unexpected_status", message: "Statut inattendu." }],
      };
    }

    return {
      executable: true,
      providerCalled: false,
      quality: prepared.quality,
      mergePlan: prepared.mergePlan,
      productionResultArtifactId: ctx.productionResultArtifactId,
      productionResultRevision: ctx.productionResultRevision,
      productionRunId: ctx.productionRunId,
      validations: prepared.validations.map((v) => ({ code: v.code, passed: v.passed, message: v.message })),
      warnings: prepared.warnings.map((w) => ({ code: w.code, message: w.message })),
      missingInformation: [],
    };
  }

  return {
    dryRun: dry,

    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failedQ("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failedQ("confirmation_required", "Confirmation requise.", 400);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failedQ("not_found", "Projet introuvable.", 400);
      }
      if (await activeProductionResultStale(deps.artifacts, input.projectId)) {
        return failedQ(
          "production_result_artifact_stale",
          "ProductionResult obsolète — QC refusé.",
          422,
        );
      }

      const ctx = await loadProductionContext({
        projectId: input.projectId,
        productionRunId: input.productionRunId,
        correlationId: context.correlationId,
        createdBy: context.createdBy ?? "shared-password-user",
        deps: deps.contextDeps,
      });
      if (!ctx.ok) {
        return failedQ(ctx.code, ctx.message, ctx.code === "production_run_not_terminal" ? 409 : 422);
      }

      let productionResultArtifactId = ctx.productionResultArtifactId;
      let productionResultRevision = ctx.productionResultRevision;
      let productionResult = ctx.productionResult;

      if (!productionResultArtifactId) {
        const persisted = await deps.deliveryRuns.persistProductionResult({
          workspaceId: deps.workspaceId,
          projectId: input.projectId,
          artifactId: id(),
          productionRunId: ctx.productionRunId,
          result: productionResult as unknown as Record<string, unknown>,
          schemaVersion: productionResult.schemaVersion,
          correlationId: context.correlationId,
          createdBy: context.createdBy ?? "shared-password-user",
          actorType: "shared_password",
          actorId: context.createdBy ?? "shared-password-user",
          expectedActiveRevision: 0,
        });
        productionResultArtifactId = persisted.artifactId;
        productionResultRevision = persisted.revision;
        const reloaded = await deps.artifacts.load(persisted.artifactId);
        if (reloaded) productionResult = reloaded.value as ProductionResult;
      }

      const fields = [input.projectId, productionResultArtifactId, String(productionResultRevision), "quality-v1"];
      const key = idempotencyKey("qc", fields);
      const fingerprint = fingerprintOf(fields);

      const begin = await deps.deliveryRuns.beginOrGetQualityRun({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        productionResultArtifactId,
        productionResultRevision,
        idempotencyKey: key,
        commandFingerprint: fingerprint,
        correlationId: context.correlationId,
      });

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Une évaluation qualité est déjà en cours.",
        };
      }
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        if (artifact) {
          const report = artifact.value as FinalQualityReport;
          const activePr = await activeArtifact<ProductionResult>(
            deps.artifacts,
            input.projectId,
            "production_result",
          );
          return {
            status: "existing",
            quality: report,
            productionResultArtifactId: activePr?.artifactId ?? productionResultArtifactId,
            productionResultRevision: activePr?.revision ?? productionResultRevision,
            directorRunId: begin.directorRunId,
            humanReviewRequired: report.status === "needs_review",
          };
        }
      }

      const prepared = await deps.postProductionDirector.prepare(
        {
          productionResult,
          storyboard: ctx.storyboard,
          scenePackages: ctx.scenePackages,
          aspectRatio: ctx.aspectRatio,
          allowPartial: input.allowPartial,
        },
        { correlationId: context.correlationId, actorId: context.createdBy ?? "shared-password-user", nowIso, nextId: id },
      );

      if (prepared.status === "failed") {
        await deps.deliveryRuns
          .failRun({
            directorRunId: begin.directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: prepared.errors[0]?.code ?? "quality_failed",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failedQ(
          prepared.errors[0]?.code ?? "quality_failed",
          prepared.errors[0]?.message ?? "Évaluation qualité impossible.",
          422,
          { directorRunId: begin.directorRunId },
        );
      }
      if (!isQualityOutcome(prepared)) {
        await deps.deliveryRuns
          .failRun({
            directorRunId: begin.directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: "unexpected_status",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failedQ("unexpected_status", "Statut inattendu retourné par le director.", 422, {
          directorRunId: begin.directorRunId,
        });
      }

      const quality = prepared.quality;
      const updatedProductionResult = prepared.productionResult;

      const persistedReport = await deps.deliveryRuns.persistQualityReport({
        directorRunId: begin.directorRunId,
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        artifactId: id(),
        productionResultArtifactId,
        productionResultRevision,
        report: quality as unknown as Record<string, unknown>,
        schemaVersion: QUALITY_REPORT_SCHEMA_VERSION,
        updatedProductionResult: updatedProductionResult as unknown as Record<string, unknown>,
        productionResultNewId: id(),
        correlationId: context.correlationId,
        createdBy: context.createdBy ?? "shared-password-user",
        actorType: "shared_password",
        actorId: context.createdBy ?? "shared-password-user",
        expectedRunRevision: begin.revision,
      });

      return {
        status: persistedReport.status === "existing" ? "existing" : "completed",
        quality,
        productionResultArtifactId: persistedReport.productionResultArtifactId,
        productionResultRevision: persistedReport.productionResultRevision,
        directorRunId: begin.directorRunId,
        humanReviewRequired: quality.status === "needs_review",
      };
    },
  };
}

// -----------------------------------------------------------------------------
// 2. Record human review decision — append-only, execute-only.
// -----------------------------------------------------------------------------

export type RecordQualityReviewDeps = DeliveryCommonDeps & {
  postProductionDirector: PostProductionDirector;
};

export type RecordQualityReviewInput = {
  projectId: string;
  /** MT-010 — Motion retry intents allowed (persist via human_review_decisions). */
  decision:
    | "approved"
    | "rejected"
    | "retry_same_reference"
    | "retry_updated_constraints"
    | "request_new_reference";
  reviewedIssueCodes: string[];
  comment?: string;
  expectedQualityReportRevision: number;
  expectedProductionResultRevision: number;
  /** Optional client idempotency — when set, included in persist key. */
  reviewRequestId?: string;
};

export type RecordQualityReviewExecuteInput = RecordQualityReviewInput & { confirmation: true };

export type RecordQualityReviewResult =
  | {
      status: "recorded" | "existing";
      humanReview: HumanReviewDecision;
      productionResultArtifactId: string;
      productionResultRevision: number;
    }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 404 | 409 | 422 | 503;
    };

export type RecordQualityReviewForProject = {
  execute(
    input: RecordQualityReviewExecuteInput,
    context: DirectorRunContext,
  ): Promise<RecordQualityReviewResult>;
};

function failedR(
  code: string,
  publicMessage: string,
  httpHint: 400 | 404 | 409 | 422 | 503,
): Extract<RecordQualityReviewResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false };
}

export function createRecordQualityReviewForProject(
  deps: RecordQualityReviewDeps,
): RecordQualityReviewForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  return {
    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failedR("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failedR("confirmation_required", "Confirmation requise.", 400);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failedR("not_found", "Projet introuvable.", 404);
      }

      const qrActive = await activeArtifact<FinalQualityReport>(
        deps.artifacts,
        input.projectId,
        "quality_report",
      );
      if (!qrActive) return failedR("quality_report_missing", "Rapport qualité introuvable.", 422);
      if (qrActive.revision !== input.expectedQualityReportRevision) {
        return failedR("quality_report_stale", "Le rapport qualité a changé depuis la vérification.", 409);
      }

      const prActive = await activeArtifact<ProductionResult>(
        deps.artifacts,
        input.projectId,
        "production_result",
      );
      if (!prActive) return failedR("production_result_missing", "ProductionResult introuvable.", 422);
      if (prActive.revision !== input.expectedProductionResultRevision) {
        return failedR("production_result_stale", "Le ProductionResult a changé depuis la vérification.", 409);
      }

      const productionResult = prActive.value;
      if (productionResult.delivery?.status !== "quality_review") {
        return failedR(
          "delivery_not_ready",
          `Revue non requise (statut delivery: ${productionResult.delivery?.status ?? "not_started"}).`,
          409,
        );
      }

      let recorded;
      try {
        recorded = await deps.postProductionDirector.recordHumanReview(
          {
            productionResult,
            quality: qrActive.value,
            status: input.decision,
            reviewedIssueCodes: input.reviewedIssueCodes,
            comment: input.comment,
          },
          {
            correlationId: context.correlationId,
            actorId: context.createdBy ?? "shared-password-user",
            nowIso,
            nextId: id,
          },
        );
      } catch (e) {
        if (isPostProductionDomainError(e)) return failedR(e.code, e.publicMessage, 422);
        throw e;
      }
      if (recorded.status !== "review_recorded") {
        return failedR("review_failed", "Échec de l'enregistrement de la revue.", 422);
      }

      const fields = [
        input.projectId,
        qrActive.artifactId,
        String(qrActive.revision),
        input.decision,
        input.reviewRequestId ?? "",
      ];
      const key = idempotencyKey("rvw", fields);

      const persisted = await deps.deliveryRuns.persistHumanReviewDecision({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        qualityReportArtifactId: qrActive.artifactId,
        qualityReportRevision: qrActive.revision,
        productionResultArtifactId: prActive.artifactId,
        productionResultRevision: prActive.revision,
        decision: input.decision,
        comment: input.comment,
        reviewedIssueCodes: input.reviewedIssueCodes,
        idempotencyKey: key,
        correlationId: context.correlationId,
        actorType: "shared_password",
        actorId: context.createdBy ?? "shared-password-user",
        updatedProductionResult: recorded.productionResult as unknown as Record<string, unknown>,
        productionResultNewId: id(),
        expectedProductionResultRevision: prActive.revision,
      });

      return {
        status: persisted.status === "existing" ? "existing" : "recorded",
        humanReview: recorded.humanReview,
        productionResultArtifactId: persisted.productionResultArtifactId,
        productionResultRevision: persisted.productionResultRevision,
      };
    },
  };
}

// -----------------------------------------------------------------------------
// 3. Prepare merge — builds & persists a MergePlan (may block).
// -----------------------------------------------------------------------------

export type PrepareMergeDeps = DeliveryCommonDeps & {
  mergeEngine: MergeEngine;
  contextDeps: LoadProductionContextDeps;
};

export type PrepareMergeInput = { projectId: string };
export type PrepareMergeExecuteInput = PrepareMergeInput & { confirmation: true };

export type PrepareMergeDryRunResult = {
  executable: boolean;
  providerCalled: false;
  mergeStatus?: MergeOutcomeStatus;
  mergePlan?: MergePlan;
  productionResultArtifactId: string | null;
  productionResultRevision: number;
  validations: Validation[];
  warnings: Warning[];
  missingInformation: MissingInfo[];
};

export type PrepareMergeResult =
  | {
      status: "prepared" | "blocked" | "existing";
      mergeStatus: MergeOutcomeStatus;
      mergePlan?: MergePlan;
      productionResultArtifactId: string;
      productionResultRevision: number;
      directorRunId: string;
    }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 409 | 422 | 503;
      directorRunId?: string;
    };

export type PrepareMergeForProject = {
  dryRun(input: PrepareMergeInput, context: DirectorRunContext): Promise<PrepareMergeDryRunResult>;
  execute(input: PrepareMergeExecuteInput, context: DirectorRunContext): Promise<PrepareMergeResult>;
};

function failedM(
  code: string,
  publicMessage: string,
  httpHint: 400 | 409 | 422 | 503,
  extra: Partial<Extract<PrepareMergeResult, { status: "failed" }>> = {},
): Extract<PrepareMergeResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false, ...extra };
}

type ComputedMergePlan =
  | { ok: false; code: string; message: string }
  | {
      ok: true;
      mergeStatus: MergeOutcomeStatus;
      plan?: MergePlan;
      productionResult: ProductionResult;
      productionResultArtifactId: string;
      productionResultRevision: number;
      reason?: string;
      errors: { code: string; message: string }[];
      warnings: string[];
    };

export function createPrepareMergeForProject(deps: PrepareMergeDeps): PrepareMergeForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  async function computePlan(
    input: PrepareMergeInput,
    context: DirectorRunContext,
  ): Promise<ComputedMergePlan> {
    const ctx = await loadProductionContext({
      projectId: input.projectId,
      correlationId: context.correlationId,
      createdBy: context.createdBy ?? "shared-password-user",
      deps: deps.contextDeps,
    });
    if (!ctx.ok) return { ok: false, code: ctx.code, message: ctx.message };
    if (!ctx.productionResultArtifactId) {
      return {
        ok: false,
        code: "production_result_missing",
        message: "ProductionResult non persisté — exécuter l'évaluation qualité d'abord.",
      };
    }
    const productionResult = ctx.productionResult;
    if (productionResult.delivery?.status !== "merge_ready") {
      return {
        ok: false,
        code: "delivery_not_ready",
        message: `Merge non prêt (statut delivery: ${productionResult.delivery?.status ?? "not_started"}).`,
      };
    }
    const authorization = refuseMergeExportIfUnauthorized(productionResult);
    if (!authorization.ok) {
      return { ok: false, code: authorization.code, message: authorization.message };
    }

    const at = nowIso();
    const built = buildMergePlan({
      id: id(),
      productionResult,
      storyboard: ctx.storyboard,
      scenePackages: ctx.scenePackages,
      aspectRatio: ctx.aspectRatio,
      createdAt: at,
      nowIso: at,
      capabilities: deps.mergeEngine.capabilities,
    });

    if (!built.ok) {
      return {
        ok: true,
        mergeStatus: "blocked",
        productionResult,
        productionResultArtifactId: ctx.productionResultArtifactId,
        productionResultRevision: ctx.productionResultRevision,
        reason: built.errors[0]?.code ?? "invalid_plan",
        errors: built.errors,
        warnings: built.warnings,
      };
    }

    const overlayBlock = built.warnings.some((w) => w.startsWith("overlay_unsupported:"));
    const blocked = overlayBlock || !deps.mergeEngine.capabilities.executionEnabled;

    return {
      ok: true,
      mergeStatus: blocked ? "blocked" : "prepared",
      plan: built.plan,
      productionResult,
      productionResultArtifactId: ctx.productionResultArtifactId,
      productionResultRevision: ctx.productionResultRevision,
      reason: blocked ? (overlayBlock ? "unsupported_overlay" : "merge_execution_unavailable") : undefined,
      errors: [],
      warnings: built.warnings,
    };
  }

  async function dry(
    input: PrepareMergeInput,
    context: DirectorRunContext,
  ): Promise<PrepareMergeDryRunResult> {
    if (!canUseDirectorV2Persistence(env)) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }],
        warnings: [],
        missingInformation: [],
      };
    }
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [{ code: "project", passed: false, message: "Projet introuvable." }],
        warnings: [],
        missingInformation: [{ code: "project_missing", message: "Projet introuvable." }],
      };
    }
    if (await activeProductionResultStale(deps.artifacts, input.projectId)) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [
          {
            code: "production_result_artifact_stale",
            passed: false,
            message: "ProductionResult obsolète — merge refusé.",
          },
        ],
        warnings: [],
        missingInformation: [
          {
            code: "production_result_artifact_stale",
            message: "ProductionResult obsolète suite à une révision amont.",
          },
        ],
      };
    }

    const computed = await computePlan(input, context);
    if (!computed.ok) {
      return {
        executable: false,
        providerCalled: false,
        productionResultArtifactId: null,
        productionResultRevision: 0,
        validations: [{ code: computed.code, passed: false, message: computed.message }],
        warnings: [],
        missingInformation: [{ code: computed.code, message: computed.message }],
      };
    }

    return {
      executable: computed.mergeStatus === "prepared",
      providerCalled: false,
      mergeStatus: computed.mergeStatus,
      mergePlan: computed.plan,
      productionResultArtifactId: computed.productionResultArtifactId,
      productionResultRevision: computed.productionResultRevision,
      validations: computed.errors.map((e) => ({ code: e.code, passed: false, message: e.message })),
      warnings: computed.warnings.map((w) => ({ code: "merge_warning", message: w })),
      missingInformation:
        computed.mergeStatus === "blocked"
          ? [{ code: computed.reason ?? "merge_blocked", message: "Préparation du merge bloquée." }]
          : [],
    };
  }

  return {
    dryRun: dry,

    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failedM("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failedM("confirmation_required", "Confirmation requise.", 400);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failedM("not_found", "Projet introuvable.", 400);
      }

      const computed = await computePlan(input, context);
      if (!computed.ok) {
        return failedM(computed.code, computed.message, computed.code === "delivery_not_ready" ? 409 : 422);
      }

      const qrActive = await activeArtifact<FinalQualityReport>(
        deps.artifacts,
        input.projectId,
        "quality_report",
      );
      if (!qrActive) return failedM("quality_report_missing", "Rapport qualité introuvable.", 422);

      const fields = [
        input.projectId,
        qrActive.artifactId,
        String(qrActive.revision),
        computed.productionResultArtifactId,
        String(computed.productionResultRevision),
        "merge-prepare-v1",
      ];
      const key = idempotencyKey("mrgp", fields);
      const fingerprint = fingerprintOf(fields);

      const begin = await deps.deliveryRuns.beginOrGetMergeRun({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        qualityReportArtifactId: qrActive.artifactId,
        qualityReportRevision: qrActive.revision,
        productionResultArtifactId: computed.productionResultArtifactId,
        productionResultRevision: computed.productionResultRevision,
        idempotencyKey: key,
        commandFingerprint: fingerprint,
        correlationId: context.correlationId,
      });

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Une préparation de merge est déjà en cours.",
        };
      }
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        const activePr = await activeArtifact<ProductionResult>(
          deps.artifacts,
          input.projectId,
          "production_result",
        );
        if (artifact) {
          const outcome = artifact.value as MergeOutcomeRecord;
          return {
            status: outcome.status === "prepared" ? "existing" : "blocked",
            mergeStatus: outcome.status,
            mergePlan: outcome.plan,
            productionResultArtifactId: activePr?.artifactId ?? computed.productionResultArtifactId,
            productionResultRevision: activePr?.revision ?? computed.productionResultRevision,
            directorRunId: begin.directorRunId,
          };
        }
      }

      const at = nowIso();
      const nextStatus = computed.mergeStatus === "blocked" ? "blocked" : "merge_ready";
      const updatedProductionResult = patchDelivery(computed.productionResult, nextStatus, at, {
        mergePlanId: computed.plan?.id,
        blockingCodes: computed.mergeStatus === "blocked" ? [computed.reason ?? "merge_blocked"] : undefined,
      });

      const mergeOutcome: MergeOutcomeRecord = {
        status: computed.mergeStatus,
        plan: computed.plan,
        reason: computed.reason,
      };

      const persisted = await deps.deliveryRuns.persistMergeOutcome({
        directorRunId: begin.directorRunId,
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        artifactId: id(),
        productionResultArtifactId: computed.productionResultArtifactId,
        productionResultRevision: computed.productionResultRevision,
        mergeOutcome: mergeOutcome as unknown as Record<string, unknown>,
        schemaVersion: MERGE_OUTCOME_SCHEMA_VERSION,
        mergeStatus: computed.mergeStatus,
        updatedProductionResult: updatedProductionResult as unknown as Record<string, unknown>,
        productionResultNewId: id(),
        correlationId: context.correlationId,
        createdBy: context.createdBy ?? "shared-password-user",
        actorType: "shared_password",
        actorId: context.createdBy ?? "shared-password-user",
        expectedRunRevision: begin.revision,
      });

      return {
        status: persisted.status === "existing" ? "existing" : (computed.mergeStatus as "prepared" | "blocked"),
        mergeStatus: computed.mergeStatus,
        mergePlan: computed.plan,
        productionResultArtifactId: persisted.productionResultArtifactId,
        productionResultRevision: persisted.productionResultRevision,
        directorRunId: begin.directorRunId,
      };
    },
  };
}

// -----------------------------------------------------------------------------
// 4. Execute merge — fake engine only.
// -----------------------------------------------------------------------------

export type ExecuteMergeDeps = DeliveryCommonDeps & {
  mergeEngine: MergeEngine;
  /** Recoverable content backend — required for /export/download media. */
  assetContent?: AssetContentBackend;
  /**
   * Supplies fake/local bytes for a completed merge asset (no network).
   * When absent, merge still persists metadata but download will fail with content_missing.
   */
  provideMergeContentBytes?: (asset: GeneratedAsset) => Uint8Array | null | undefined;
};

export type ExecuteMergeInput = { projectId: string };
export type ExecuteMergeExecuteInput = ExecuteMergeInput & { confirmation: true };

export type ExecuteMergeDryRunResult = {
  executable: boolean;
  providerCalled: false;
  mergeStatus?: MergeOutcomeStatus;
  productionResultArtifactId: string | null;
  productionResultRevision: number;
  validations: Validation[];
  warnings: Warning[];
  missingInformation: MissingInfo[];
};

export type ExecuteMergeResult =
  | {
      status: "completed" | "existing";
      finalAsset: GeneratedAsset;
      productionResultArtifactId: string;
      productionResultRevision: number;
      directorRunId: string;
    }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 409 | 422 | 503;
      directorRunId?: string;
    };

export type ExecuteMergeForProject = {
  dryRun(input: ExecuteMergeInput, context: DirectorRunContext): Promise<ExecuteMergeDryRunResult>;
  execute(input: ExecuteMergeExecuteInput, context: DirectorRunContext): Promise<ExecuteMergeResult>;
};

function failedX(
  code: string,
  publicMessage: string,
  httpHint: 400 | 409 | 422 | 503,
  extra: Partial<Extract<ExecuteMergeResult, { status: "failed" }>> = {},
): Extract<ExecuteMergeResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false, ...extra };
}

export function createExecuteMergeForProject(deps: ExecuteMergeDeps): ExecuteMergeForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  return {
    async dryRun(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return {
          executable: false,
          providerCalled: false,
          productionResultArtifactId: null,
          productionResultRevision: 0,
          validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }],
          warnings: [],
          missingInformation: [],
        };
      }
      const mpActive = await activeArtifact<MergeOutcomeRecord>(deps.artifacts, input.projectId, "merge_plan");
      if (!mpActive || mpActive.value.status !== "prepared" || !mpActive.value.plan) {
        return {
          executable: false,
          providerCalled: false,
          productionResultArtifactId: null,
          productionResultRevision: 0,
          validations: [{ code: "merge_not_prepared", passed: false, message: "Aucun plan de merge prêt." }],
          warnings: [],
          missingInformation: [{ code: "merge_not_prepared", message: "Aucun plan de merge prêt." }],
        };
      }
      const prActive = await activeArtifact<ProductionResult>(
        deps.artifacts,
        input.projectId,
        "production_result",
      );
      if (prActive) {
        const authorization = refuseMergeExportIfUnauthorized(prActive.value);
        if (!authorization.ok) {
          return {
            executable: false,
            providerCalled: false,
            productionResultArtifactId: prActive.artifactId,
            productionResultRevision: prActive.revision,
            validations: [{ code: authorization.code, passed: false, message: authorization.message }],
            warnings: [],
            missingInformation: [{ code: authorization.code, message: authorization.message }],
          };
        }
      }
      const validation = await deps.mergeEngine.validate(mpActive.value.plan, {
        correlationId: context.correlationId,
        requestedAt: nowIso(),
      });
      return {
        executable: validation.valid && deps.mergeEngine.capabilities.executionEnabled,
        providerCalled: false,
        mergeStatus: mpActive.value.status,
        productionResultArtifactId: prActive?.artifactId ?? null,
        productionResultRevision: prActive?.revision ?? 0,
        validations: validation.issues.map((i) => ({ code: i.code, passed: !i.blocking, message: i.message })),
        warnings: validation.warnings.map((w) => ({ code: w.code, message: w.message })),
        missingInformation: [],
      };
    },

    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failedX("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failedX("confirmation_required", "Confirmation requise.", 400);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failedX("not_found", "Projet introuvable.", 400);
      }

      const mpActive = await activeArtifact<MergeOutcomeRecord>(deps.artifacts, input.projectId, "merge_plan");
      if (!mpActive) return failedX("merge_plan_missing", "Plan de merge introuvable.", 422);
      const outcome = mpActive.value;
      if (outcome.status !== "prepared" || !outcome.plan) {
        return failedX("merge_not_prepared", "Le plan de merge n'est pas prêt.", 422);
      }

      const qrActive = await activeArtifact<FinalQualityReport>(
        deps.artifacts,
        input.projectId,
        "quality_report",
      );
      if (!qrActive) return failedX("quality_report_missing", "Rapport qualité introuvable.", 422);

      const prActive = await activeArtifact<ProductionResult>(
        deps.artifacts,
        input.projectId,
        "production_result",
      );
      if (!prActive) return failedX("production_result_missing", "ProductionResult introuvable.", 422);
      const productionResult = prActive.value;
      if (productionResult.delivery?.status !== "merge_ready") {
        return failedX(
          "delivery_not_ready",
          `Merge non exécutable (statut delivery: ${productionResult.delivery?.status ?? "not_started"}).`,
          409,
        );
      }
      const authorization = refuseMergeExportIfUnauthorized(productionResult);
      if (!authorization.ok) {
        return failedX(authorization.code, authorization.message, 409);
      }

      const fields = [
        input.projectId,
        qrActive.artifactId,
        String(qrActive.revision),
        prActive.artifactId,
        String(prActive.revision),
        "merge-execute-v1",
      ];
      const key = idempotencyKey("mrge", fields);
      const fingerprint = fingerprintOf(fields);

      const begin = await deps.deliveryRuns.beginOrGetMergeRun({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        qualityReportArtifactId: qrActive.artifactId,
        qualityReportRevision: qrActive.revision,
        productionResultArtifactId: prActive.artifactId,
        productionResultRevision: prActive.revision,
        idempotencyKey: key,
        commandFingerprint: fingerprint,
        correlationId: context.correlationId,
      });

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Un merge est déjà en cours.",
        };
      }
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        const activePr = await activeArtifact<ProductionResult>(
          deps.artifacts,
          input.projectId,
          "production_result",
        );
        if (artifact) {
          const existingOutcome = artifact.value as MergeOutcomeRecord;
          if (existingOutcome.status === "completed" && existingOutcome.finalAsset) {
            return {
              status: "existing",
              finalAsset: existingOutcome.finalAsset,
              productionResultArtifactId: activePr?.artifactId ?? prActive.artifactId,
              productionResultRevision: activePr?.revision ?? prActive.revision,
              directorRunId: begin.directorRunId,
            };
          }
          return failedX(
            existingOutcome.reason ?? "merge_failed",
            "Le merge précédent a échoué.",
            422,
            { directorRunId: begin.directorRunId },
          );
        }
      }

      const at = nowIso();
      const execCtx: MergeExecutionContext = { correlationId: context.correlationId, requestedAt: at };
      const validation = await deps.mergeEngine.validate(outcome.plan, execCtx);

      let mergeStatus: MergeOutcomeStatus;
      let finalAsset: GeneratedAsset | undefined;
      let reason: string | undefined;
      let updatedProductionResult: ProductionResult;

      if (!validation.valid || !deps.mergeEngine.capabilities.executionEnabled) {
        mergeStatus = "failed";
        reason = validation.issues.find((i) => i.blocking)?.code ?? "merge_execution_unavailable";
        updatedProductionResult = patchDelivery(productionResult, "merging", at, { mergePlanId: outcome.plan.id });
        updatedProductionResult = patchDelivery(updatedProductionResult, "failed", at, { blockingCodes: [reason] });
      } else {
        updatedProductionResult = patchDelivery(productionResult, "merging", at, { mergePlanId: outcome.plan.id });
        let mergeResult = await deps.mergeEngine.execute(outcome.plan, execCtx);
        let attempts = 0;
        while (
          (mergeResult.status === "submitted" || mergeResult.status === "processing") &&
          deps.mergeEngine.poll &&
          attempts < 5
        ) {
          mergeResult = await deps.mergeEngine.poll(mergeResult.job, {
            correlationId: context.correlationId,
            requestedAt: nowIso(),
          });
          attempts += 1;
        }

        if (mergeResult.status === "completed") {
          finalAsset = mergeResult.asset;
          if (finalAsset && isAssetContentConfigured(deps.assetContent)) {
            // Backend configured → bytes must be persisted before downloadable merge.
            const bytes = deps.provideMergeContentBytes?.(finalAsset);
            if (!bytes || bytes.byteLength === 0) {
              mergeStatus = "failed";
              reason = "asset_content_missing";
              finalAsset = undefined;
              updatedProductionResult = patchDelivery(updatedProductionResult, "failed", at, {
                blockingCodes: [reason],
              });
            } else {
              try {
                const storagePath = buildDirectorFinalAssetStoragePath({
                  workspaceId: deps.workspaceId,
                  projectId: input.projectId,
                  containerId: outcome.plan.id,
                  assetId: finalAsset.id,
                  mimeType: finalAsset.mimeType,
                });
                await deps.assetContent.put({
                  assetId: finalAsset.id,
                  workspaceId: deps.workspaceId,
                  projectId: input.projectId,
                  containerId: outcome.plan.id,
                  mimeType: finalAsset.mimeType,
                  bytes,
                  storagePath,
                });
                finalAsset = {
                  ...finalAsset,
                  sizeBytes: bytes.byteLength,
                  checksum: sha256Hex(bytes),
                  source: { kind: "internal", storagePath },
                };
                mergeStatus = "completed";
                updatedProductionResult = patchDelivery(updatedProductionResult, "merged", at, {
                  finalAssetId: finalAsset.id,
                  mergePlanId: outcome.plan.id,
                });
              } catch {
                mergeStatus = "failed";
                reason = "asset_content_persist_failed";
                finalAsset = undefined;
                updatedProductionResult = patchDelivery(updatedProductionResult, "failed", at, {
                  blockingCodes: [reason],
                });
              }
            }
          } else {
            // No content backend — merge metadata only; download remains fail-closed.
            mergeStatus = "completed";
            updatedProductionResult = patchDelivery(updatedProductionResult, "merged", at, {
              finalAssetId: finalAsset?.id,
              mergePlanId: outcome.plan.id,
            });
          }
        } else {
          mergeStatus = "failed";
          reason = mergeResult.status === "failed" ? mergeResult.error.code : "merge_execution_unavailable";
          updatedProductionResult = patchDelivery(updatedProductionResult, "failed", at, {
            blockingCodes: [reason],
          });
        }
      }

      const persisted = await deps.deliveryRuns.persistMergeOutcome({
        directorRunId: begin.directorRunId,
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        artifactId: id(),
        productionResultArtifactId: prActive.artifactId,
        productionResultRevision: prActive.revision,
        mergeOutcome: { status: mergeStatus, plan: outcome.plan, finalAsset, reason } as unknown as Record<
          string,
          unknown
        >,
        schemaVersion: MERGE_OUTCOME_SCHEMA_VERSION,
        mergeStatus,
        updatedProductionResult: updatedProductionResult as unknown as Record<string, unknown>,
        productionResultNewId: id(),
        correlationId: context.correlationId,
        createdBy: context.createdBy ?? "shared-password-user",
        actorType: "shared_password",
        actorId: context.createdBy ?? "shared-password-user",
        expectedRunRevision: begin.revision,
      });

      if (mergeStatus !== "completed" || !finalAsset) {
        return failedX(reason ?? "merge_failed", "Échec de l'exécution du merge.", 422, {
          directorRunId: begin.directorRunId,
        });
      }

      return {
        status: persisted.status === "existing" ? "existing" : "completed",
        finalAsset,
        productionResultArtifactId: persisted.productionResultArtifactId,
        productionResultRevision: persisted.productionResultRevision,
        directorRunId: begin.directorRunId,
      };
    },
  };
}

// -----------------------------------------------------------------------------
// 5. Prepare export — download or (fake/unavailable) aiccos destination.
// -----------------------------------------------------------------------------

export type PrepareExportDeps = DeliveryCommonDeps & { postProductionDirector: PostProductionDirector };

export type PrepareExportInput = { projectId: string; destinationId?: "download" | "aiccos" };
export type PrepareExportExecuteInput = PrepareExportInput & { confirmation: true };

export type PrepareExportDryRunResult = {
  executable: boolean;
  providerCalled: false;
  productionResultArtifactId: string | null;
  productionResultRevision: number;
  validations: Validation[];
  warnings: Warning[];
  missingInformation: MissingInfo[];
};

export type PrepareExportResult =
  | {
      status: "prepared" | "existing";
      exportPackage: ExportPackage;
      productionResultArtifactId: string;
      productionResultRevision: number;
      directorRunId: string;
    }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 409 | 422 | 503;
      directorRunId?: string;
    };

export type PrepareExportForProject = {
  dryRun(input: PrepareExportInput, context: DirectorRunContext): Promise<PrepareExportDryRunResult>;
  execute(input: PrepareExportExecuteInput, context: DirectorRunContext): Promise<PrepareExportResult>;
};

function failedE(
  code: string,
  publicMessage: string,
  httpHint: 400 | 409 | 422 | 503,
  extra: Partial<Extract<PrepareExportResult, { status: "failed" }>> = {},
): Extract<PrepareExportResult, { status: "failed" }> {
  return { status: "failed", code, publicMessage, httpHint, retryable: false, ...extra };
}

type LoadedExportContext =
  | { ok: false; code: string; message: string }
  | {
      ok: true;
      mergePlan: MergePlan;
      finalAsset: GeneratedAsset;
      quality: FinalQualityReport;
      humanReview?: HumanReviewDecision;
      productionResult: ProductionResult;
      productionResultArtifactId: string;
      productionResultRevision: number;
      qualityReportArtifactId: string;
      qualityReportRevision: number;
      mergePlanArtifactId: string;
      mergePlanRevision: number;
    };

export function createPrepareExportForProject(deps: PrepareExportDeps): PrepareExportForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>);
  const id = deps.idFactory ?? randomUUID;
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  async function loadExportContext(projectId: string): Promise<LoadedExportContext> {
    const mpActive = await activeArtifact<MergeOutcomeRecord>(deps.artifacts, projectId, "merge_plan");
    if (!mpActive) return { ok: false, code: "merge_plan_missing", message: "Plan de merge introuvable." };
    const outcome = mpActive.value;
    if (outcome.status !== "completed" || !outcome.finalAsset || !outcome.plan) {
      return { ok: false, code: "merge_not_completed", message: "Le merge n'est pas terminé." };
    }

    const qrActive = await activeArtifact<FinalQualityReport>(deps.artifacts, projectId, "quality_report");
    if (!qrActive) return { ok: false, code: "quality_report_missing", message: "Rapport qualité introuvable." };

    const prActive = await activeArtifact<ProductionResult>(deps.artifacts, projectId, "production_result");
    if (!prActive) return { ok: false, code: "production_result_missing", message: "ProductionResult introuvable." };
    if (!readMergeExportAuthorized(prActive.value)) {
      return {
        ok: false,
        code: "merge_export_unauthorized",
        message: redactCoherenceError("Export non autorisé : merge_ready seul est insuffisant."),
      };
    }

    let humanReview: HumanReviewDecision | undefined;
    if (qrActive.value.status === "needs_review") {
      humanReview =
        (await deps.deliveryRuns.loadLatestHumanReview(projectId, qrActive.artifactId, qrActive.revision)) ??
        undefined;
    }

    return {
      ok: true,
      mergePlan: outcome.plan,
      finalAsset: outcome.finalAsset,
      quality: qrActive.value,
      humanReview,
      productionResult: prActive.value,
      productionResultArtifactId: prActive.artifactId,
      productionResultRevision: prActive.revision,
      qualityReportArtifactId: qrActive.artifactId,
      qualityReportRevision: qrActive.revision,
      mergePlanArtifactId: mpActive.artifactId,
      mergePlanRevision: mpActive.revision,
    };
  }

  return {
    async dryRun(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return {
          executable: false,
          providerCalled: false,
          productionResultArtifactId: null,
          productionResultRevision: 0,
          validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }],
          warnings: [],
          missingInformation: [],
        };
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return {
          executable: false,
          providerCalled: false,
          productionResultArtifactId: null,
          productionResultRevision: 0,
          validations: [{ code: "project", passed: false, message: "Projet introuvable." }],
          warnings: [],
          missingInformation: [{ code: "project_missing", message: "Projet introuvable." }],
        };
      }

      const loaded = await loadExportContext(input.projectId);
      if (!loaded.ok) {
        return {
          executable: false,
          providerCalled: false,
          productionResultArtifactId: null,
          productionResultRevision: 0,
          validations: [{ code: loaded.code, passed: false, message: loaded.message }],
          warnings: [],
          missingInformation: [{ code: loaded.code, message: loaded.message }],
        };
      }

      const prepared = await deps.postProductionDirector.prepareExport(
        {
          productionResult: loaded.productionResult,
          mergePlan: loaded.mergePlan,
          quality: loaded.quality,
          humanReview: loaded.humanReview,
          finalAsset: loaded.finalAsset,
          destinationId: input.destinationId,
        },
        { correlationId: context.correlationId, actorId: context.createdBy ?? "shared-password-user", nowIso, nextId: id },
      );

      if (prepared.status === "failed") {
        return {
          executable: false,
          providerCalled: false,
          productionResultArtifactId: loaded.productionResultArtifactId,
          productionResultRevision: loaded.productionResultRevision,
          validations: prepared.errors.map((e) => ({ code: e.code, passed: false, message: e.message })),
          warnings: [],
          missingInformation: prepared.errors.map((e) => ({ code: e.code, message: e.message })),
        };
      }
      if (!isExportPrepared(prepared)) {
        return {
          executable: false,
          providerCalled: false,
          productionResultArtifactId: loaded.productionResultArtifactId,
          productionResultRevision: loaded.productionResultRevision,
          validations: [{ code: "unexpected_status", passed: false, message: "Statut inattendu." }],
          warnings: [],
          missingInformation: [{ code: "unexpected_status", message: "Statut inattendu." }],
        };
      }

      return {
        executable: true,
        providerCalled: false,
        productionResultArtifactId: loaded.productionResultArtifactId,
        productionResultRevision: loaded.productionResultRevision,
        validations: prepared.validations.map((v) => ({ code: v.code, passed: v.passed, message: v.message })),
        warnings: prepared.warnings.map((w) => ({ code: w.code, message: w.message })),
        missingInformation: [],
      };
    },

    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) {
        return failedE("persistence_disabled", "Persistance Director désactivée.", 503);
      }
      if (input.confirmation !== true) {
        return failedE("confirmation_required", "Confirmation requise.", 400);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) {
        return failedE("not_found", "Projet introuvable.", 400);
      }

      const loaded = await loadExportContext(input.projectId);
      if (!loaded.ok) return failedE(loaded.code, loaded.message, 422);

      const fields = [
        input.projectId,
        loaded.qualityReportArtifactId,
        String(loaded.qualityReportRevision),
        loaded.productionResultArtifactId,
        String(loaded.productionResultRevision),
        input.destinationId ?? "download",
      ];
      const key = idempotencyKey("exp", fields);
      const fingerprint = fingerprintOf(fields);

      const begin = await deps.deliveryRuns.beginOrGetExportRun({
        id: id(),
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        mergePlanArtifactId: loaded.mergePlanArtifactId,
        mergePlanRevision: loaded.mergePlanRevision,
        productionResultArtifactId: loaded.productionResultArtifactId,
        productionResultRevision: loaded.productionResultRevision,
        idempotencyKey: key,
        commandFingerprint: fingerprint,
        correlationId: context.correlationId,
      });

      if (begin.status === "already_running") {
        return {
          status: "already_running",
          directorRunId: begin.directorRunId,
          publicMessage: "Une préparation d'export est déjà en cours.",
        };
      }
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        const activePr = await activeArtifact<ProductionResult>(
          deps.artifacts,
          input.projectId,
          "production_result",
        );
        if (artifact) {
          return {
            status: "existing",
            exportPackage: artifact.value as ExportPackage,
            productionResultArtifactId: activePr?.artifactId ?? loaded.productionResultArtifactId,
            productionResultRevision: activePr?.revision ?? loaded.productionResultRevision,
            directorRunId: begin.directorRunId,
          };
        }
      }

      const prepared = await deps.postProductionDirector.prepareExport(
        {
          productionResult: loaded.productionResult,
          mergePlan: loaded.mergePlan,
          quality: loaded.quality,
          humanReview: loaded.humanReview,
          finalAsset: loaded.finalAsset,
          destinationId: input.destinationId,
        },
        { correlationId: context.correlationId, actorId: context.createdBy ?? "shared-password-user", nowIso, nextId: id },
      );

      if (prepared.status === "failed") {
        await deps.deliveryRuns
          .failRun({
            directorRunId: begin.directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: prepared.errors[0]?.code ?? "export_failed",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failedE(
          prepared.errors[0]?.code ?? "export_failed",
          prepared.errors[0]?.message ?? "Préparation export impossible.",
          422,
          { directorRunId: begin.directorRunId },
        );
      }
      if (!isExportPrepared(prepared)) {
        await deps.deliveryRuns
          .failRun({
            directorRunId: begin.directorRunId,
            workspaceId: deps.workspaceId,
            expectedRevision: begin.revision,
            errorCode: "unexpected_status",
            status: "failed",
            correlationId: context.correlationId,
          })
          .catch(() => undefined);
        return failedE("unexpected_status", "Statut inattendu retourné par le director.", 422, {
          directorRunId: begin.directorRunId,
        });
      }

      const persisted = await deps.deliveryRuns.persistExportPackage({
        directorRunId: begin.directorRunId,
        workspaceId: deps.workspaceId,
        projectId: input.projectId,
        artifactId: prepared.exportPackage.id,
        productionResultArtifactId: loaded.productionResultArtifactId,
        productionResultRevision: loaded.productionResultRevision,
        exportPackage: prepared.exportPackage as unknown as Record<string, unknown>,
        schemaVersion: EXPORT_PACKAGE_SCHEMA_VERSION,
        destinationId: input.destinationId ?? "download",
        updatedProductionResult: prepared.productionResult as unknown as Record<string, unknown>,
        productionResultNewId: id(),
        correlationId: context.correlationId,
        createdBy: context.createdBy ?? "shared-password-user",
        actorType: "shared_password",
        actorId: context.createdBy ?? "shared-password-user",
        expectedRunRevision: begin.revision,
      });

      return {
        status: persisted.status === "existing" ? "existing" : "prepared",
        exportPackage: prepared.exportPackage,
        productionResultArtifactId: persisted.productionResultArtifactId,
        productionResultRevision: persisted.productionResultRevision,
        directorRunId: begin.directorRunId,
      };
    },
  };
}

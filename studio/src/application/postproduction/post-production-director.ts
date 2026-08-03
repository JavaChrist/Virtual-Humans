/**
 * PostProductionDirector — bounded prepare / merge / prepareExport (VHS-111).
 * Not a competing business Director; Production Director remains global owner.
 */

import type { BriefAspectRatio } from "@/domain/brief";
import type { ScenePackage } from "@/domain/prompt";
import {
  assertDeliveryTransition,
  migrateProductionResultToV11,
  withDeliveryUpdate,
  type ProductionDelivery,
  type ProductionResult,
} from "@/domain/production";
import type { StoryboardProject } from "@/domain/storyboard";
import {
  assertExportAllowed,
  buildExportManifest,
  buildMergePlan,
  createHumanReviewDecision,
  freezeExportPackage,
  type FinalQualityReport,
  type HumanReviewDecision,
  type MergePlan,
} from "@/domain/postproduction";
import type { ExportDestinationAdapter, MergeEngine } from "./ports";
import type { PostProductionResult } from "./result";
import { runPostProductionDryRun } from "./dry-run";

export type PostProductionContext = {
  correlationId: string;
  actorId: string;
  nowIso: () => string;
  nextId: () => string;
};

export type PreparePostProductionInput = {
  productionResult: ProductionResult;
  storyboard: StoryboardProject;
  scenePackages: ScenePackage[];
  aspectRatio: BriefAspectRatio;
  allowPartial?: boolean;
  preserveEmbeddedAudio?: boolean;
};

export type ExecuteMergeInput = {
  productionResult: ProductionResult;
  mergePlan: MergePlan;
  quality: FinalQualityReport;
};

export type PrepareExportInput = {
  productionResult: ProductionResult;
  mergePlan: MergePlan;
  quality: FinalQualityReport;
  /** Required when quality is needs_review. */
  humanReview?: HumanReviewDecision;
  /**
   * Final asset — only after a real merge completed.
   * Stub path must not invent one; prepareExport fails without it.
   */
  finalAsset?: import("@/domain/generation").GeneratedAsset;
  destinationId?: "download" | "aiccos";
};

export type RecordHumanReviewInput = {
  productionResult: ProductionResult;
  quality: FinalQualityReport;
  status: "approved" | "rejected";
  reviewedIssueCodes: string[];
  comment?: string;
};

export interface PostProductionDirector {
  prepare(
    input: PreparePostProductionInput,
    context: PostProductionContext
  ): Promise<PostProductionResult>;

  merge(
    input: ExecuteMergeInput,
    context: PostProductionContext
  ): Promise<PostProductionResult>;

  prepareExport(
    input: PrepareExportInput,
    context: PostProductionContext
  ): Promise<PostProductionResult>;

  recordHumanReview(
    input: RecordHumanReviewInput,
    context: PostProductionContext
  ): Promise<PostProductionResult>;
}

export type CreatePostProductionDirectorOptions = {
  mergeEngine: MergeEngine;
  destinations?: ExportDestinationAdapter[];
};

function patchDelivery(
  result: ProductionResult,
  nextStatus: ProductionDelivery["status"],
  at: string,
  extra: Partial<ProductionDelivery> = {}
): ProductionResult {
  const current = result.delivery ?? { status: "not_started" as const, updatedAt: at };
  assertDeliveryTransition(current.status, nextStatus);
  return withDeliveryUpdate(result, {
    ...current,
    ...extra,
    status: nextStatus,
    updatedAt: at,
  });
}

export function createPostProductionDirector(
  options: CreatePostProductionDirectorOptions
): PostProductionDirector {
  const { mergeEngine } = options;
  const destinations = new Map(
    (options.destinations ?? []).map((d) => [d.destinationId, d])
  );

  return {
    async prepare(input, context) {
      const at = context.nowIso();
      let productionResult = migrateProductionResultToV11(input.productionResult, at);

      const dry = runPostProductionDryRun({
        productionResult,
        storyboard: input.storyboard,
        scenePackages: input.scenePackages,
        aspectRatio: input.aspectRatio,
        mergeEngine,
        allowPartial: input.allowPartial,
        at,
      });

      const quality = dry.quality;

      if (quality.status === "rejected") {
        productionResult = patchDelivery(productionResult, "blocked", at, {
          blockingCodes: quality.blockingIssues.map((i) => i.code),
          qualityReportId: context.nextId(),
        });
        return {
          status: "failed",
          errors: quality.blockingIssues.map((i) => ({
            code: i.code,
            message: i.message,
          })),
          validations: dry.validations,
          warnings: dry.warnings,
        };
      }

      if (quality.status === "needs_review") {
        productionResult = patchDelivery(productionResult, "quality_review", at, {
          qualityReportId: context.nextId(),
        });
        return {
          status: "needs_review",
          quality,
          mergePlan: dry.mergePlan,
          productionResult,
          validations: dry.validations,
          warnings: dry.warnings,
          exportReady: false,
        };
      }

      if (!dry.mergePlan) {
        productionResult = patchDelivery(productionResult, "blocked", at);
        return {
          status: "failed",
          errors: dry.blockingReasons.map((m) => ({
            code: "invalid_plan",
            message: m,
          })),
          validations: dry.validations,
          warnings: dry.warnings,
        };
      }

      // Rebuild plan with real id
      const built = buildMergePlan({
        id: context.nextId(),
        productionResult,
        storyboard: input.storyboard,
        scenePackages: input.scenePackages,
        aspectRatio: input.aspectRatio,
        createdAt: at,
        nowIso: at,
        preserveEmbeddedAudio: input.preserveEmbeddedAudio,
        capabilities: mergeEngine.capabilities,
      });

      if (!built.ok) {
        productionResult = patchDelivery(productionResult, "blocked", at, {
          blockingCodes: built.errors.map((e) => e.code),
        });
        return {
          status: "failed",
          errors: built.errors,
          validations: dry.validations,
          warnings: dry.warnings,
        };
      }

      const hasOverlayBlock = built.warnings.some((w) =>
        w.startsWith("overlay_unsupported:")
      );
      if (hasOverlayBlock || !mergeEngine.capabilities.executionEnabled) {
        productionResult = patchDelivery(productionResult, "merge_ready", at, {
          mergePlanId: built.plan.id,
          qualityReportId: context.nextId(),
          blockingCodes: hasOverlayBlock
            ? ["unsupported_overlay"]
            : ["merge_execution_unavailable"],
        });
        return {
          status: "merge_unavailable",
          quality,
          mergePlan: built.plan,
          productionResult,
          reason: hasOverlayBlock
            ? "Overlays postproduction non exécutables par l'engine actuel."
            : "merge_adapter_not_configured",
          validations: dry.validations,
          warnings: [
            ...dry.warnings,
            ...built.warnings.map((w) => ({
              code: "merge_warning",
              message: w,
            })),
          ],
          exportReady: false as const,
        };
      }

      productionResult = patchDelivery(productionResult, "merge_ready", at, {
        mergePlanId: built.plan.id,
        qualityReportId: context.nextId(),
      });

      return {
        status: "prepared",
        quality,
        mergePlan: built.plan,
        productionResult,
        validations: dry.validations,
        warnings: dry.warnings,
        exportReady: false,
      };
    },

    async merge(input, context) {
      const at = context.nowIso();
      let productionResult = migrateProductionResultToV11(input.productionResult, at);

      if (input.quality.status === "rejected") {
        return {
          status: "failed",
          errors: [{ code: "quality_rejected", message: "Qualité refusée." }],
          validations: [],
          warnings: [],
        };
      }

      productionResult = patchDelivery(productionResult, "merging", at, {
        mergePlanId: input.mergePlan.id,
      });

      const validation = await mergeEngine.validate(input.mergePlan, {
        correlationId: context.correlationId,
        requestedAt: at,
      });

      if (!validation.valid || !mergeEngine.capabilities.executionEnabled) {
        productionResult = patchDelivery(productionResult, "failed", at, {
          blockingCodes: validation.issues.map((i) => i.code),
        });
        return {
          status: "merge_unavailable",
          quality: input.quality,
          mergePlan: input.mergePlan,
          productionResult,
          reason:
            validation.issues.find((i) => i.blocking)?.code ??
            "merge_execution_unavailable",
          validations: validation.issues.map((i) => ({
            code: i.code,
            passed: !i.blocking,
            message: i.message,
          })),
          warnings: validation.warnings.map((w) => ({
            code: w.code,
            message: w.message,
          })),
          exportReady: false as const,
        };
      }

      const mergeResult = await mergeEngine.execute(input.mergePlan, {
        correlationId: context.correlationId,
        requestedAt: at,
      });

      if (mergeResult.status !== "completed") {
        productionResult = patchDelivery(productionResult, "failed", at, {
          blockingCodes: [
            mergeResult.status === "failed"
              ? mergeResult.error.code
              : "merge_failed",
          ],
        });
        return {
          status: "merge_unavailable",
          quality: input.quality,
          mergePlan: input.mergePlan,
          productionResult,
          reason:
            mergeResult.status === "failed"
              ? mergeResult.error.code
              : mergeResult.status,
          validations: [],
          warnings: [],
          exportReady: false as const,
        };
      }

      // Real completed path (unreachable with stub)
      productionResult = patchDelivery(productionResult, "merged", at, {
        finalAssetId: mergeResult.asset.id,
        mergePlanId: input.mergePlan.id,
      });
      return {
        status: "prepared",
        quality: input.quality,
        mergePlan: input.mergePlan,
        productionResult,
        validations: [],
        warnings: [],
        exportReady: false,
      };
    },

    async prepareExport(input, context) {
      const at = context.nowIso();
      let productionResult = migrateProductionResultToV11(input.productionResult, at);

      if (!input.finalAsset) {
        return {
          status: "failed",
          errors: [
            {
              code: "merge_execution_unavailable",
              message:
                "Aucun asset final — merge stub non activé; pas d'asset fictif.",
            },
          ],
          validations: [],
          warnings: [],
        };
      }

      try {
        assertExportAllowed({
          quality: input.quality,
          humanReview: input.humanReview,
          finalAsset: input.finalAsset,
          nowIso: at,
        });
      } catch (e) {
        return {
          status: "failed",
          errors: [
            {
              code:
                e instanceof Error && "code" in e
                  ? String((e as { code: string }).code)
                  : "export_not_ready",
              message: e instanceof Error ? e.message : "Export non prêt.",
            },
          ],
          validations: [],
          warnings: [],
        };
      }

      const sceneAssets = input.mergePlan.timeline.map((t) => ({
        sceneId: t.sceneId,
        sceneOrder: t.order,
        assetId: t.assetId,
        mimeType: "video/mp4",
        durationSeconds: t.durationSeconds,
      }));

      const providers = productionResult.manifest.attempts.map((a) => ({
        providerId: a.providerId,
        modelId: a.modelId,
        stepId: a.stepId,
        attemptNumber: a.attemptNumber,
        kind: a.kind,
      }));

      const pkgId = context.nextId();
      const manifest = buildExportManifest({
        projectId: productionResult.projectId,
        productionRunId: productionResult.manifest.runId,
        generationPlanRevisionId: productionResult.generationPlanRevisionId,
        storyboardRevisionId: input.mergePlan.storyboardRevisionId,
        finalAssetId: input.finalAsset.id,
        sceneAssets,
        providers,
        costs: {
          estimated: productionResult.estimatedCost,
          committed: productionResult.committedCost,
          released: productionResult.releasedCost,
        },
        quality: input.quality,
        humanReview: input.humanReview,
        generatedAt: at,
      });

      const exportPackage = freezeExportPackage({
        id: pkgId,
        projectId: productionResult.projectId,
        productionResultRevisionId: productionResult.id,
        finalAsset: input.finalAsset,
        qualityReport: input.quality,
        humanReview: input.humanReview,
        manifest,
        createdAt: at,
      });

      productionResult = patchDelivery(productionResult, "export_ready", at, {
        exportPackageId: pkgId,
        finalAssetId: input.finalAsset.id,
      });

      const destId = input.destinationId ?? "download";
      const dest = destinations.get(destId);
      if (dest) {
        const v = await dest.validate(exportPackage, {
          correlationId: context.correlationId,
          requestedAt: at,
        });
        if (!v.valid && destId === "aiccos") {
          return {
            status: "export_prepared",
            exportPackage,
            productionResult,
            validations: v.issues.map((i) => ({
              code: i.code,
              passed: false,
              message: i.message,
            })),
            warnings: [
              {
                code: "destination_not_configured",
                message: "Destination AICCOS stub — envoi non effectué.",
              },
            ],
          };
        }
      }

      return {
        status: "export_prepared",
        exportPackage,
        productionResult,
        validations: [],
        warnings: [],
      };
    },

    async recordHumanReview(input, context) {
      const at = context.nowIso();
      let productionResult = migrateProductionResultToV11(input.productionResult, at);

      const technicalBlocking = input.quality.blockingIssues
        .filter((i) => i.blocking && i.layer === "technical")
        .map((i) => i.code);

      const humanReview = createHumanReviewDecision({
        id: context.nextId(),
        productionRunId: productionResult.manifest.runId,
        productionResultRevisionId: productionResult.id,
        productionResultRevision: productionResult.revision,
        status: input.status,
        decidedAt: at,
        decidedBy: context.actorId,
        reviewedIssueCodes: input.reviewedIssueCodes,
        comment: input.comment,
        remainingBlockingTechnicalCodes: technicalBlocking,
      });

      if (input.status === "approved") {
        productionResult = patchDelivery(productionResult, "merge_ready", at, {
          humanReviewId: humanReview.id,
        });
      } else {
        productionResult = patchDelivery(productionResult, "blocked", at, {
          humanReviewId: humanReview.id,
        });
      }

      return {
        status: "review_recorded",
        humanReview,
        productionResult,
      };
    },
  };
}

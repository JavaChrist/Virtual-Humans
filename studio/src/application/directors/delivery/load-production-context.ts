/**
 * Shared context loader for Phase 5 delivery directors (quality/merge/export) (VHS-125).
 * Loads (or builds, never persists) the terminal ProductionResult plus the
 * storyboard / scene packages / aspect ratio required by postproduction domain calls.
 */

import { randomUUID } from "node:crypto";
import type { ArtifactRepository } from "@/application/projects/ports";
import { VideoProjectBriefSchema, type BriefAspectRatio } from "@/domain/brief";
import { ScenePackageSetSchema, type ScenePackage } from "@/domain/prompt";
import {
  buildProductionResult,
  isTerminalRunStatus,
  PRODUCTION_RESULT_ARTIFACT_TYPE,
  type ProductionResult,
  type ProductionRun,
} from "@/domain/production";
import { createArtifactMetadata } from "@/domain/shared";
import { StoryboardProjectSchema, type StoryboardProject } from "@/domain/storyboard";

export type ProductionContextErrorCode =
  | "brief_missing"
  | "storyboard_missing"
  | "scene_package_set_missing"
  | "production_run_missing"
  | "production_run_not_terminal"
  | "production_result_invalid";

export type ProductionContextError = {
  ok: false;
  code: ProductionContextErrorCode;
  message: string;
};

export type ProductionContextOk = {
  ok: true;
  productionResult: ProductionResult;
  /** null when this is a freshly built ProductionResult not yet persisted. */
  productionResultArtifactId: string | null;
  /** 0 when this is a freshly built ProductionResult not yet persisted. */
  productionResultRevision: number;
  productionRunId: string;
  storyboard: StoryboardProject;
  storyboardArtifactId: string;
  storyboardRevision: number;
  scenePackages: ScenePackage[];
  aspectRatio: BriefAspectRatio;
};

export type LoadProductionContextResult = ProductionContextOk | ProductionContextError;

export type LoadProductionRunPort = {
  loadProductionRunById(runId: string): Promise<ProductionRun | null>;
  /** Latest terminal run for the project (completed/partial/failed/cancelled). */
  loadLatestTerminalProductionRun?(
    projectId: string,
  ): Promise<ProductionRun | null>;
};

export type LoadProductionContextDeps = {
  artifacts: ArtifactRepository;
  productionRuns: LoadProductionRunPort;
  nowIso?: () => string;
  idFactory?: () => string;
};

async function activeArtifact(
  artifacts: ArtifactRepository,
  projectId: string,
  type: "video_project_brief" | "storyboard_project" | "scene_package_set" | "production_result",
) {
  const current = await artifacts.getActive(projectId, type);
  if (!current) return null;
  const item = await artifacts.load(current.artifactId);
  if (!item) return null;
  return { artifactId: current.artifactId, revision: current.revision, value: item.value };
}

function toProductionResultStatus(run: ProductionRun): ProductionResult["status"] {
  if (
    run.status === "completed" ||
    run.status === "partial" ||
    run.status === "failed" ||
    run.status === "cancelled"
  ) {
    return run.status;
  }
  return "failed";
}

/**
 * Load the active ProductionResult when already persisted; otherwise build one
 * (in-memory only, never persisted here) from a terminal ProductionRun.
 * Callers that need durable persistence must call persistProductionResult explicitly.
 */
export async function loadProductionContext(input: {
  projectId: string;
  /** Required only when no production_result artifact is active yet. */
  productionRunId?: string;
  correlationId: string;
  createdBy: string;
  deps: LoadProductionContextDeps;
}): Promise<LoadProductionContextResult> {
  const nowIso = input.deps.nowIso ?? (() => new Date().toISOString());
  const idFactory = input.deps.idFactory ?? randomUUID;

  const [briefRaw, storyboardRaw, packageSetRaw, activeResult] = await Promise.all([
    activeArtifact(input.deps.artifacts, input.projectId, "video_project_brief"),
    activeArtifact(input.deps.artifacts, input.projectId, "storyboard_project"),
    activeArtifact(input.deps.artifacts, input.projectId, "scene_package_set"),
    activeArtifact(input.deps.artifacts, input.projectId, "production_result"),
  ]);

  const brief =
    briefRaw && VideoProjectBriefSchema.safeParse(briefRaw.value).success
      ? VideoProjectBriefSchema.parse(briefRaw.value)
      : null;
  if (!brief) {
    return { ok: false, code: "brief_missing", message: "Brief actif introuvable." };
  }

  const storyboard =
    storyboardRaw && StoryboardProjectSchema.safeParse(storyboardRaw.value).success
      ? StoryboardProjectSchema.parse(storyboardRaw.value)
      : null;
  if (!storyboard || !storyboardRaw) {
    return { ok: false, code: "storyboard_missing", message: "Storyboard actif introuvable." };
  }

  const packageSet =
    packageSetRaw && ScenePackageSetSchema.safeParse(packageSetRaw.value).success
      ? ScenePackageSetSchema.parse(packageSetRaw.value)
      : null;
  if (!packageSet) {
    return {
      ok: false,
      code: "scene_package_set_missing",
      message: "ScenePackageSet actif introuvable.",
    };
  }
  const scenePackages = [...packageSet.packages].sort((a, b) => a.sceneOrder - b.sceneOrder);

  if (activeResult?.value && typeof activeResult.value === "object") {
    const value = activeResult.value as ProductionResult;
    if (value.artifactType === PRODUCTION_RESULT_ARTIFACT_TYPE && Array.isArray(value.scenes)) {
      return {
        ok: true,
        productionResult: value,
        productionResultArtifactId: activeResult.artifactId,
        productionResultRevision: activeResult.revision,
        productionRunId: value.manifest.runId,
        storyboard,
        storyboardArtifactId: storyboardRaw.artifactId,
        storyboardRevision: storyboardRaw.revision,
        scenePackages,
        aspectRatio: brief.aspectRatio,
      };
    }
    return {
      ok: false,
      code: "production_result_invalid",
      message: "ProductionResult actif invalide.",
    };
  }

  let run: ProductionRun | null = null;
  if (input.productionRunId) {
    run = await input.deps.productionRuns.loadProductionRunById(input.productionRunId);
    if (!run || run.projectId !== input.projectId) {
      return { ok: false, code: "production_run_missing", message: "Run de production introuvable." };
    }
    if (!isTerminalRunStatus(run.status)) {
      return {
        ok: false,
        code: "production_run_not_terminal",
        message: `Run de production non terminal (statut: ${run.status}).`,
      };
    }
  } else {
    run =
      (await input.deps.productionRuns.loadLatestTerminalProductionRun?.(
        input.projectId,
      )) ?? null;
    if (!run) {
      return {
        ok: false,
        code: "production_run_missing",
        message: "Run de production introuvable — aucun ProductionResult persisté.",
      };
    }
  }

  const at = nowIso();
  const meta = createArtifactMetadata({
    id: idFactory(),
    projectId: input.projectId,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
    revision: 1,
    createdAt: at,
  });
  // Server-side QC/merge needs usable sources — never redact here.
  const productionResult = buildProductionResult({
    run,
    meta,
    completedAt: run.updatedAt,
    status: toProductionResultStatus(run),
    redactSources: false,
  });

  return {
    ok: true,
    productionResult,
    productionResultArtifactId: null,
    productionResultRevision: 0,
    productionRunId: run.id,
    storyboard,
    storyboardArtifactId: storyboardRaw.artifactId,
    storyboardRevision: storyboardRaw.revision,
    scenePackages,
    aspectRatio: brief.aspectRatio,
  };
}

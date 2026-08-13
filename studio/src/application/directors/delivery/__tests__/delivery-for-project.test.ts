/**
 * Unit tests for VHS-125 postproduction delivery services — in-memory fakes only,
 * no Supabase/DB calls, no real fal/OpenAI/AICCOS. Fake merge engine only.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { makeBrief } from "@/domain/marketing/__tests__/fixtures";
import {
  makePackages,
  makeProductionResultV1,
  makeStoryboard,
} from "@/domain/postproduction/__tests__/fixtures";
import type { ScenePackage } from "@/domain/prompt";
import { createArtifactMetadata } from "@/domain/shared";
import {
  PROMPT_RENDERER_VERSION,
  SCENE_PACKAGE_SET_ARTIFACT_TYPE,
  SCENE_PACKAGE_SET_SCHEMA_VERSION,
} from "@/domain/prompt";
import type {
  ActiveArtifactPointer,
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { ArtifactType } from "@/domain/project";
import { withDeliveryUpdate, type ProductionResult } from "@/domain/production";
import type { FinalQualityReport, HumanReviewDecision } from "@/domain/postproduction";
import { createPostProductionDirector } from "@/application/postproduction/post-production-director";
import {
  buildFakeInternalVideoAsset,
  createFakeMergeEngine,
} from "@/application/postproduction/fake-merge-engine";
import {
  buildSyntheticFakeMp4Bytes,
  createMemoryAssetContentPort,
  sha256Hex,
} from "@/application/postproduction/asset-content-port";
import {
  createDownloadExportAdapter,
  createUnavailableAiccosExportAdapter,
} from "@/application/postproduction/export-stubs";
import type { LoadProductionRunPort } from "../load-production-context";
import {
  createEvaluateProductionQualityForProject,
  createExecuteMergeForProject,
  createPrepareExportForProject,
  createPrepareMergeForProject,
  createRecordQualityReviewForProject,
} from "../delivery-for-project";
import { createDownloadFinalAssetForProject } from "../download-final-asset";
import type {
  BeginDeliveryRunResult,
  BeginExportRunInput,
  BeginMergeRunInput,
  BeginQualityRunInput,
  DeliveryDirectorRunPort,
  FailDeliveryRunInput,
  PersistExportPackageInput,
  PersistHumanReviewDecisionInput,
  PersistHumanReviewDecisionResult,
  PersistMergeOutcomeInput,
  PersistProductionResultInput,
  PersistQualityReportInput,
  PersistWithProductionResultResult,
  PersistArtifactResult,
} from "../ports";

const AT = "2026-08-03T12:00:00.000Z";
const WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeProject(): PersistedVideoProject {
  return {
    id: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: "P",
    status: "draft",
    activeRevision: 1,
    schemaVersion: "1.0.0",
    createdAt: AT,
    updatedAt: AT,
    archivedAt: null,
    correlationId: "corr-project",
  };
}

type ArtifactStore = Map<string, PersistedArtifact>;
type ActiveStore = Map<string, ActiveArtifactPointer>;

function activeKey(projectId: string, type: ArtifactType): string {
  return `${projectId}:${type}`;
}

function insertArtifact(
  store: ArtifactStore,
  active: ActiveStore,
  input: {
    id: string;
    projectId: string;
    artifactType: ArtifactType;
    value: unknown;
    schemaVersion: string;
    createdBy: string;
    correlationId: string;
  },
): number {
  let revision = 0;
  for (const a of store.values()) {
    if (a.projectId === input.projectId && a.artifactType === input.artifactType) {
      revision = Math.max(revision, a.revision);
    }
  }
  revision += 1;
  const artifact: PersistedArtifact = {
    id: input.id,
    workspaceId: WORKSPACE_ID,
    projectId: input.projectId,
    artifactType: input.artifactType,
    revision,
    schemaVersion: input.schemaVersion,
    parentRevisionId: null,
    value: input.value,
    createdAt: AT,
    createdBy: input.createdBy,
    correlationId: input.correlationId,
  };
  store.set(input.id, artifact);
  active.set(activeKey(input.projectId, input.artifactType), {
    projectId: input.projectId,
    artifactType: input.artifactType,
    artifactId: input.id,
    revision,
    updatedAt: AT,
    updatedBy: input.createdBy,
  });
  return revision;
}

function createFakeArtifactRepository(
  store: ArtifactStore,
  active: ActiveStore,
): ArtifactRepository & { appendCount: () => number } {
  let appends = 0;
  return {
    async append(artifact) {
      appends += 1;
      store.set(artifact.id, artifact);
    },
    async load(id) {
      return store.get(id) ?? null;
    },
    async loadByRevision(projectId, type, revision) {
      for (const a of store.values()) {
        if (a.projectId === projectId && a.artifactType === type && a.revision === revision) {
          return a;
        }
      }
      return null;
    },
    async getActive(projectId, type) {
      return active.get(activeKey(projectId, type)) ?? null;
    },
    async setActive(input) {
      const ptr: ActiveArtifactPointer = {
        projectId: input.projectId,
        artifactType: input.artifactType,
        artifactId: input.artifactId,
        revision: input.expectedRevision + 1,
        updatedAt: AT,
        updatedBy: input.updatedBy,
      };
      active.set(activeKey(input.projectId, input.artifactType), ptr);
      return ptr;
    },
    appendCount: () => appends,
  };
}

type RunRecord = { status: "pending" | "completed"; revision: number; outputArtifactId: string | null };
type ReviewRecord = PersistHumanReviewDecisionInput & { productionResultNewIdUsed: string };

/** Mirrors the SQL director-run pattern closely enough to exercise service logic. */
function createFakeDeliveryDirectorRunPort(
  store: ArtifactStore,
  active: ActiveStore,
): DeliveryDirectorRunPort & {
  runs: Map<string, RunRecord>;
  reviews: ReviewRecord[];
  failedRuns: FailDeliveryRunInput[];
} {
  const runs = new Map<string, RunRecord>();
  const byKey = new Map<string, string>();
  const reviews: ReviewRecord[] = [];
  const failedRuns: FailDeliveryRunInput[] = [];

  function beginOrGet(
    id: string,
    idempotencyKey: string,
  ): BeginDeliveryRunResult {
    const existingId = byKey.get(idempotencyKey);
    if (existingId) {
      const run = runs.get(existingId)!;
      if (run.status === "completed") {
        return {
          status: "existing",
          directorRunId: existingId,
          revision: run.revision,
          outputArtifactId: run.outputArtifactId!,
        };
      }
      return {
        status: "already_running",
        directorRunId: existingId,
        revision: run.revision,
        outputArtifactId: run.outputArtifactId,
      };
    }
    runs.set(id, { status: "pending", revision: 1, outputArtifactId: null });
    byKey.set(idempotencyKey, id);
    return { status: "created", directorRunId: id, revision: 1 };
  }

  return {
    runs,
    reviews,
    failedRuns,

    async persistProductionResult(input: PersistProductionResultInput): Promise<PersistArtifactResult> {
      const ptr = active.get(activeKey(input.projectId, "production_result"));
      if (ptr) {
        const existing = store.get(ptr.artifactId);
        const existingRunId = (existing?.value as { manifest?: { runId?: string } } | undefined)?.manifest
          ?.runId;
        if (existing && existingRunId === input.productionRunId) {
          return { status: "existing", artifactId: existing.id, revision: existing.revision };
        }
      }
      const revision = insertArtifact(store, active, {
        id: input.artifactId,
        projectId: input.projectId,
        artifactType: "production_result",
        value: input.result,
        schemaVersion: input.schemaVersion,
        createdBy: input.createdBy,
        correlationId: input.correlationId,
      });
      return { status: "created", artifactId: input.artifactId, revision };
    },

    async loadLatestHumanReview(projectId, qualityReportArtifactId, qualityReportRevision) {
      const found = [...reviews]
        .reverse()
        .find(
          (r) =>
            r.projectId === projectId &&
            r.qualityReportArtifactId === qualityReportArtifactId &&
            r.qualityReportRevision === qualityReportRevision,
        );
      if (!found) return null;
      const decision: HumanReviewDecision = {
        id: found.id,
        productionRunId: "run-1",
        productionResultRevisionId: found.productionResultArtifactId,
        productionResultRevision: found.productionResultRevision,
        status: found.decision,
        decidedAt: AT,
        decidedBy: found.actorId,
        reviewedIssueCodes: found.reviewedIssueCodes,
        comment: found.comment,
      };
      return decision;
    },

    async beginOrGetQualityRun(input: BeginQualityRunInput) {
      return beginOrGet(input.id, input.idempotencyKey);
    },

    async persistQualityReport(input: PersistQualityReportInput): Promise<PersistWithProductionResultResult> {
      const run = runs.get(input.directorRunId);
      if (!run) throw new Error("unknown director run");
      const qrRevision = insertArtifact(store, active, {
        id: input.artifactId,
        projectId: input.projectId,
        artifactType: "quality_report",
        value: input.report,
        schemaVersion: input.schemaVersion,
        createdBy: input.createdBy,
        correlationId: input.correlationId,
      });
      const prRevision = insertArtifact(store, active, {
        id: input.productionResultNewId,
        projectId: input.projectId,
        artifactType: "production_result",
        value: input.updatedProductionResult,
        schemaVersion: input.schemaVersion,
        createdBy: input.createdBy,
        correlationId: input.correlationId,
      });
      run.status = "completed";
      run.outputArtifactId = input.artifactId;
      run.revision += 1;
      return {
        status: "created",
        artifactId: input.artifactId,
        revision: qrRevision,
        productionResultArtifactId: input.productionResultNewId,
        productionResultRevision: prRevision,
      };
    },

    async persistHumanReviewDecision(
      input: PersistHumanReviewDecisionInput,
    ): Promise<PersistHumanReviewDecisionResult> {
      if (input.idempotencyKey) {
        const existing = reviews.find((r) => r.idempotencyKey === input.idempotencyKey);
        if (existing) {
          return {
            status: "existing",
            decisionId: existing.id,
            productionResultArtifactId: existing.productionResultNewIdUsed,
            productionResultRevision:
              active.get(activeKey(input.projectId, "production_result"))?.revision ?? 0,
          };
        }
      }
      const prRevision = insertArtifact(store, active, {
        id: input.productionResultNewId,
        projectId: input.projectId,
        artifactType: "production_result",
        value: input.updatedProductionResult,
        schemaVersion: "1.1.0",
        createdBy: input.actorId,
        correlationId: input.correlationId,
      });
      reviews.push({ ...input, productionResultNewIdUsed: input.productionResultNewId });
      return {
        status: "created",
        decisionId: input.id,
        productionResultArtifactId: input.productionResultNewId,
        productionResultRevision: prRevision,
      };
    },

    async beginOrGetMergeRun(input: BeginMergeRunInput) {
      return beginOrGet(input.id, input.idempotencyKey);
    },

    async persistMergeOutcome(input: PersistMergeOutcomeInput): Promise<PersistWithProductionResultResult> {
      const run = runs.get(input.directorRunId);
      if (!run) throw new Error("unknown director run");
      const mpRevision = insertArtifact(store, active, {
        id: input.artifactId,
        projectId: input.projectId,
        artifactType: "merge_plan",
        value: input.mergeOutcome,
        schemaVersion: input.schemaVersion,
        createdBy: input.createdBy,
        correlationId: input.correlationId,
      });
      const prRevision = insertArtifact(store, active, {
        id: input.productionResultNewId,
        projectId: input.projectId,
        artifactType: "production_result",
        value: input.updatedProductionResult,
        schemaVersion: input.schemaVersion,
        createdBy: input.createdBy,
        correlationId: input.correlationId,
      });
      run.status = "completed";
      run.outputArtifactId = input.artifactId;
      run.revision += 1;
      return {
        status: "created",
        artifactId: input.artifactId,
        revision: mpRevision,
        productionResultArtifactId: input.productionResultNewId,
        productionResultRevision: prRevision,
      };
    },

    async beginOrGetExportRun(input: BeginExportRunInput) {
      return beginOrGet(input.id, input.idempotencyKey);
    },

    async persistExportPackage(input: PersistExportPackageInput): Promise<PersistWithProductionResultResult> {
      const run = runs.get(input.directorRunId);
      if (!run) throw new Error("unknown director run");
      const epRevision = insertArtifact(store, active, {
        id: input.artifactId,
        projectId: input.projectId,
        artifactType: "export_package",
        value: input.exportPackage,
        schemaVersion: input.schemaVersion,
        createdBy: input.createdBy,
        correlationId: input.correlationId,
      });
      const prRevision = insertArtifact(store, active, {
        id: input.productionResultNewId,
        projectId: input.projectId,
        artifactType: "production_result",
        value: input.updatedProductionResult,
        schemaVersion: input.schemaVersion,
        createdBy: input.createdBy,
        correlationId: input.correlationId,
      });
      run.status = "completed";
      run.outputArtifactId = input.artifactId;
      run.revision += 1;
      return {
        status: "created",
        artifactId: input.artifactId,
        revision: epRevision,
        productionResultArtifactId: input.productionResultNewId,
        productionResultRevision: prRevision,
      };
    },

    async failRun(input: FailDeliveryRunInput) {
      failedRuns.push(input);
      const run = runs.get(input.directorRunId);
      if (run) run.status = "completed";
    },
  };
}

/**
 * `makePackages`/`makeMinimalPackage` predate the current EnvironmentBlock/CameraBlock/
 * LightingBlock/StyleBlock shapes and are cast unsafely — patch them here so the
 * artifact round-trips through `ScenePackageSetSchema.safeParse` inside
 * `loadProductionContext`, exactly as real persisted packages would.
 */
function toValidPackage(pkg: ScenePackage): ScenePackage {
  return {
    ...pkg,
    environment: { kind: "interior", description: "Studio", continuityKey: "loc-1", mood: "calm" },
    camera: { shotSize: "medium", angle: "eye_level", movement: "static", depthOfField: "medium", intent: "establish" },
    lighting: { source: "soft", quality: "diffuse", temperature: "neutral", contrast: "medium", intent: "natural" },
    style: {
      style: "photoreal",
      realism: "high",
      colorIntent: "brand palette",
      brandAlignment: "on-brand",
      paletteRoles: ["primary"],
    },
  };
}

function harness() {
  const store: ArtifactStore = new Map();
  const active: ActiveStore = new Map();

  const brief = makeBrief();
  const storyboard = makeStoryboard();
  const scenePackages = makePackages(false).map(toValidPackage);
  const productionResult = makeProductionResultV1({ projectId: PROJECT_ID });

  insertArtifact(store, active, {
    id: "brief-active",
    projectId: PROJECT_ID,
    artifactType: "video_project_brief",
    value: brief,
    schemaVersion: brief.schemaVersion,
    createdBy: "tester",
    correlationId: "corr-brief",
  });
  insertArtifact(store, active, {
    id: "storyboard-active",
    projectId: PROJECT_ID,
    artifactType: "storyboard_project",
    value: storyboard,
    schemaVersion: storyboard.schemaVersion,
    createdBy: "tester",
    correlationId: "corr-storyboard",
  });
  insertArtifact(store, active, {
    id: "packageset-active",
    projectId: PROJECT_ID,
    artifactType: "scene_package_set",
    value: {
      ...createArtifactMetadata({
        id: "packageset-active",
        projectId: PROJECT_ID,
        createdBy: "tester",
        correlationId: "corr-pkgset",
        createdAt: AT,
      }),
      artifactType: SCENE_PACKAGE_SET_ARTIFACT_TYPE,
      storyboardRevisionId: storyboard.id,
      rendererVersion: PROMPT_RENDERER_VERSION,
      packages: scenePackages,
    },
    schemaVersion: SCENE_PACKAGE_SET_SCHEMA_VERSION,
    createdBy: "tester",
    correlationId: "corr-pkgset",
  });
  insertArtifact(store, active, {
    id: "pr-active-1",
    projectId: PROJECT_ID,
    artifactType: "production_result",
    value: productionResult,
    schemaVersion: productionResult.schemaVersion,
    createdBy: "tester",
    correlationId: "corr-pr",
  });

  const artifacts = createFakeArtifactRepository(store, active);
  const deliveryRuns = createFakeDeliveryDirectorRunPort(store, active);

  const productionRuns: LoadProductionRunPort = {
    async loadProductionRunById() {
      return null;
    },
  };

  const fakeBytes = buildSyntheticFakeMp4Bytes("unit-delivery");
  const finalAsset = buildFakeInternalVideoAsset({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sizeBytes: fakeBytes.byteLength,
    checksum: sha256Hex(fakeBytes),
  });
  const mergeEngine = createFakeMergeEngine({ mode: "sync", asset: finalAsset });
  const assetContent = createMemoryAssetContentPort();

  const postProductionDirector = createPostProductionDirector({
    mergeEngine,
    destinations: [createDownloadExportAdapter(), createUnavailableAiccosExportAdapter()],
  });

  const env = { DIRECTOR_V2_ENABLED: "true", DIRECTOR_V2_PERSISTENCE_ENABLED: "true" };
  const nowIso = () => AT;
  let counter = 0;
  const idFactory = () => {
    counter += 1;
    return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
  };

  const projects: ProjectRepository = {
    async create() {},
    async load(id) {
      return id === PROJECT_ID ? makeProject() : null;
    },
    async saveStatus() {
      throw new Error("not used");
    },
  };

  const common = {
    workspaceId: WORKSPACE_ID,
    projects,
    artifacts,
    deliveryRuns,
    env,
    idFactory,
    nowIso,
  };

  const evaluateQuality = createEvaluateProductionQualityForProject({
    ...common,
    postProductionDirector,
    contextDeps: { artifacts, productionRuns, nowIso, idFactory },
  });
  const recordQualityReview = createRecordQualityReviewForProject({
    ...common,
    postProductionDirector,
  });
  const prepareMerge = createPrepareMergeForProject({
    ...common,
    mergeEngine,
    contextDeps: { artifacts, productionRuns, nowIso, idFactory },
  });
  const executeMerge = createExecuteMergeForProject({
    ...common,
    mergeEngine,
    assetContent,
    provideMergeContentBytes: (asset) =>
      asset.id === finalAsset.id ? fakeBytes : null,
  });
  const prepareExport = createPrepareExportForProject({ ...common, postProductionDirector });
  const downloadFinalAsset = createDownloadFinalAssetForProject({
    workspaceId: WORKSPACE_ID,
    projects,
    artifacts,
    assetContent,
    env,
    nowIso,
  });

  return {
    store,
    active,
    artifacts,
    deliveryRuns,
    evaluateQuality,
    recordQualityReview,
    prepareMerge,
    executeMerge,
    prepareExport,
    downloadFinalAsset,
    finalAsset,
    fakeBytes,
  };
}

const ctx = { correlationId: "corr-delivery-test", mode: "execute" as const, createdBy: "tester" };

// -----------------------------------------------------------------------------
// 1. Evaluate quality
// -----------------------------------------------------------------------------

test("QC dry-run: no writes, needs_review because visual/lip-sync checks are unknown (never pass)", async () => {
  const h = harness();
  const before = h.artifacts.appendCount();
  const dry = await h.evaluateQuality.dryRun({ projectId: PROJECT_ID }, ctx);
  assert.equal(dry.providerCalled, false);
  assert.equal(h.artifacts.appendCount(), before);
  assert.equal(dry.executable, true, JSON.stringify(dry));
  assert.equal(dry.quality?.status, "needs_review");
});

test("QC execute: persists quality_report, sets delivery to quality_review, humanReviewRequired true", async () => {
  const h = harness();
  const result = await h.evaluateQuality.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(result.status, "completed", JSON.stringify(result));
  if (result.status !== "completed" && result.status !== "existing") return;
  assert.equal(result.quality.status, "needs_review");
  assert.equal(result.humanReviewRequired, true);

  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  const prArtifact = prActive && (await h.artifacts.load(prActive.artifactId));
  const productionResult = prArtifact?.value as ProductionResult;
  assert.equal(productionResult.delivery?.status, "quality_review");

  const qrActive = await h.artifacts.getActive(PROJECT_ID, "quality_report");
  assert.ok(qrActive);
});

// -----------------------------------------------------------------------------
// 2. Record human review — append-only, stale, non-waivable
// -----------------------------------------------------------------------------

async function runQcToReview(h: ReturnType<typeof harness>) {
  const qc = await h.evaluateQuality.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(qc.status, "completed");
  if (qc.status !== "completed" && qc.status !== "existing") throw new Error("qc failed");
  return qc;
}

test("review: stale quality_report revision is rejected with 409", async () => {
  const h = harness();
  await runQcToReview(h);
  const qrActive = await h.artifacts.getActive(PROJECT_ID, "quality_report");
  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  assert.ok(qrActive && prActive);

  const result = await h.recordQualityReview.execute(
    {
      projectId: PROJECT_ID,
      decision: "approved",
      reviewedIssueCodes: [],
      expectedQualityReportRevision: qrActive!.revision + 1,
      expectedProductionResultRevision: prActive!.revision,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.code, "quality_report_stale");
    assert.equal(result.httpHint, 409);
  }
});

test("review: stale production_result revision is rejected with 409", async () => {
  const h = harness();
  await runQcToReview(h);
  const qrActive = await h.artifacts.getActive(PROJECT_ID, "quality_report");
  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  assert.ok(qrActive && prActive);

  const result = await h.recordQualityReview.execute(
    {
      projectId: PROJECT_ID,
      decision: "approved",
      reviewedIssueCodes: [],
      expectedQualityReportRevision: qrActive!.revision,
      expectedProductionResultRevision: prActive!.revision + 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.code, "production_result_stale");
    assert.equal(result.httpHint, 409);
  }
});

test("review: non-waivable technical blocking code cannot be approved (human_review_invalid, 422)", async () => {
  const h = harness();
  // Synthetic report: needs_review outcome but carries a non-waivable technical
  // blocking issue — evaluateFinalQuality never produces this combination itself
  // (any blocking issue forces "rejected"), so we seed it directly to exercise
  // createHumanReviewDecision's non-waivable guard inside recordHumanReview.
  const syntheticReport: FinalQualityReport = {
    status: "needs_review",
    technicalChecks: [],
    contractualChecks: [],
    editorialChecks: [],
    blockingIssues: [
      { code: "asset_absent", message: "Asset absent", blocking: true, layer: "technical" },
    ],
    warnings: [],
    reviewedAt: AT,
    validatorVersion: "final-quality.v1",
  };
  const productionResult = withDeliveryUpdate(makeProductionResultV1(), {
    status: "quality_review",
    updatedAt: AT,
  });
  insertArtifact(h.store, h.active, {
    id: "qr-synthetic",
    projectId: PROJECT_ID,
    artifactType: "quality_report",
    value: syntheticReport,
    schemaVersion: "1.0.0",
    createdBy: "tester",
    correlationId: "corr-synthetic",
  });
  insertArtifact(h.store, h.active, {
    id: "pr-synthetic",
    projectId: PROJECT_ID,
    artifactType: "production_result",
    value: productionResult,
    schemaVersion: "1.1.0",
    createdBy: "tester",
    correlationId: "corr-synthetic",
  });

  const qrActive = await h.artifacts.getActive(PROJECT_ID, "quality_report");
  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");

  const result = await h.recordQualityReview.execute(
    {
      projectId: PROJECT_ID,
      decision: "approved",
      reviewedIssueCodes: ["asset_absent"],
      expectedQualityReportRevision: qrActive!.revision,
      expectedProductionResultRevision: prActive!.revision,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.code, "human_review_invalid");
    assert.equal(result.httpHint, 422);
  }
});

test("review: rejected decision is append-only and blocks delivery", async () => {
  const h = harness();
  await runQcToReview(h);
  const qrActive = await h.artifacts.getActive(PROJECT_ID, "quality_report");
  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");

  const result = await h.recordQualityReview.execute(
    {
      projectId: PROJECT_ID,
      decision: "rejected",
      reviewedIssueCodes: ["human.illegible_invented_button_text"],
      comment: "Illegible invented button text.",
      expectedQualityReportRevision: qrActive!.revision,
      expectedProductionResultRevision: prActive!.revision,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "recorded", JSON.stringify(result));
  if (result.status !== "recorded" && result.status !== "existing") return;
  assert.equal(result.humanReview.status, "rejected");
  assert.equal(h.deliveryRuns.reviews.length, 1);

  const newPrActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  const newPr = (await h.artifacts.load(newPrActive!.artifactId))!.value as ProductionResult;
  assert.equal(newPr.delivery?.status, "blocked");
});

test("review: approved decision is append-only and advances delivery to merge_ready", async () => {
  const h = harness();
  await runQcToReview(h);
  const qrActive = await h.artifacts.getActive(PROJECT_ID, "quality_report");
  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");

  const result = await h.recordQualityReview.execute(
    {
      projectId: PROJECT_ID,
      decision: "approved",
      reviewedIssueCodes: [],
      expectedQualityReportRevision: qrActive!.revision,
      expectedProductionResultRevision: prActive!.revision,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(result.status, "recorded", JSON.stringify(result));
  if (result.status !== "recorded" && result.status !== "existing") return;
  assert.equal(result.humanReview.status, "approved");
  assert.equal(h.deliveryRuns.reviews.length, 1, "decision recorded exactly once — append-only");

  const newPrActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  const newPr = (await h.artifacts.load(newPrActive!.artifactId))!.value as ProductionResult;
  assert.equal(newPr.delivery?.status, "merge_ready");
});

// -----------------------------------------------------------------------------
// 3-4. Prepare + execute merge (fake sync)
// -----------------------------------------------------------------------------

async function runToMergeReady(h: ReturnType<typeof harness>) {
  await runQcToReview(h);
  const qrActive = await h.artifacts.getActive(PROJECT_ID, "quality_report");
  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  const review = await h.recordQualityReview.execute(
    {
      projectId: PROJECT_ID,
      decision: "approved",
      reviewedIssueCodes: [],
      expectedQualityReportRevision: qrActive!.revision,
      expectedProductionResultRevision: prActive!.revision,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(review.status, "recorded");
}

test("merge: prepare dry-run then execute completes with fake sync engine, delivery merged", async () => {
  const h = harness();
  await runToMergeReady(h);

  const prepDry = await h.prepareMerge.dryRun({ projectId: PROJECT_ID }, ctx);
  assert.equal(prepDry.providerCalled, false);
  assert.equal(prepDry.executable, true, JSON.stringify(prepDry));
  assert.equal(prepDry.mergeStatus, "prepared");

  const prep = await h.prepareMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(prep.status, "prepared", JSON.stringify(prep));

  const execDry = await h.executeMerge.dryRun({ projectId: PROJECT_ID }, ctx);
  assert.equal(execDry.providerCalled, false);
  assert.equal(execDry.executable, true, JSON.stringify(execDry));

  const exec = await h.executeMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(exec.status, "completed", JSON.stringify(exec));
  if (exec.status !== "completed" && exec.status !== "existing") return;
  assert.equal(exec.finalAsset.id, h.finalAsset.id);
  assert.equal(exec.finalAsset.source.kind, "internal");

  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  const pr = (await h.artifacts.load(prActive!.artifactId))!.value as ProductionResult;
  assert.equal(pr.delivery?.status, "merged");
});

test("merge execute: fails cleanly (no fabricated asset) when fake engine has no asset injected", async () => {
  const h = harness();
  await runToMergeReady(h);
  await h.prepareMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);

  // Swap in a fake engine with no injected asset to prove execute never invents one.
  const bareEngine = createFakeMergeEngine({ mode: "sync" });
  const bareExecuteMerge = createExecuteMergeForProject({
    workspaceId: WORKSPACE_ID,
    projects: {
      async create() {},
      async load(id) {
        return id === PROJECT_ID ? makeProject() : null;
      },
      async saveStatus() {
        throw new Error("not used");
      },
    },
    artifacts: h.artifacts,
    deliveryRuns: h.deliveryRuns,
    env: { DIRECTOR_V2_ENABLED: "true", DIRECTOR_V2_PERSISTENCE_ENABLED: "true" },
    nowIso: () => AT,
    idFactory: randomUUID,
    mergeEngine: bareEngine,
  });

  const result = await bareExecuteMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(result.status, "failed");
  if (result.status === "failed") {
    assert.equal(result.code, "merge_adapter_not_configured");
  }
});

// -----------------------------------------------------------------------------
// 5. Prepare export
// -----------------------------------------------------------------------------

async function runToMerged(h: ReturnType<typeof harness>) {
  await runToMergeReady(h);
  await h.prepareMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  const exec = await h.executeMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(exec.status, "completed");
}

test("export: prepare fails with merge_not_completed before merge has finished", async () => {
  const h = harness();
  await runToMergeReady(h);
  await h.prepareMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);

  const dry = await h.prepareExport.dryRun({ projectId: PROJECT_ID }, ctx);
  assert.equal(dry.executable, false);
  assert.ok(dry.validations.some((v) => v.code === "merge_not_completed"));

  const result = await h.prepareExport.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(result.status, "failed");
  if (result.status === "failed") assert.equal(result.code, "merge_not_completed");
});

test("export: prepared package has no signed/external URL — internal asset source only", async () => {
  const h = harness();
  await runToMerged(h);

  const dry = await h.prepareExport.dryRun({ projectId: PROJECT_ID }, ctx);
  assert.equal(dry.executable, true, JSON.stringify(dry));

  const result = await h.prepareExport.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  assert.equal(result.status, "prepared", JSON.stringify(result));
  if (result.status !== "prepared" && result.status !== "existing") return;
  assert.equal(result.exportPackage.finalAsset.source.kind, "internal");
  assert.equal(JSON.stringify(result.exportPackage).includes("https://"), false);

  const prActive = await h.artifacts.getActive(PROJECT_ID, "production_result");
  const pr = (await h.artifacts.load(prActive!.artifactId))!.value as ProductionResult;
  assert.equal(pr.delivery?.status, "export_ready");
});

test("download: real media bytes match fake content stored at merge", async () => {
  const h = harness();
  await runToMerged(h);
  await h.prepareExport.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);

  const dl = await h.downloadFinalAsset.execute({ projectId: PROJECT_ID });
  assert.equal(dl.status, "ok", JSON.stringify(dl));
  if (dl.status !== "ok") return;
  assert.deepEqual(Buffer.from(dl.bytes), Buffer.from(h.fakeBytes));
  assert.equal(dl.headers["Content-Type"], "video/mp4");
  assert.match(dl.headers["Content-Disposition"], /^attachment;/);
  assert.equal(dl.headers["Cache-Control"], "private, no-store");
  assert.equal(dl.headers["X-Content-Type-Options"], "nosniff");
});

// -----------------------------------------------------------------------------
// 6. Idempotence (director-run port contract, in-memory)
// -----------------------------------------------------------------------------

test("idempotence: beginOrGetMergeRun returns existing + same output on identical retry", async () => {
  const h = harness();
  await runToMergeReady(h);
  await h.prepareMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);
  await h.executeMerge.execute({ projectId: PROJECT_ID, confirmation: true }, ctx);

  const qrActive = (await h.artifacts.getActive(PROJECT_ID, "quality_report"))!;
  const mpActive = (await h.artifacts.getActive(PROJECT_ID, "merge_plan"))!;

  const beginInput: BeginMergeRunInput = {
    id: "retry-run-id",
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    qualityReportArtifactId: qrActive.artifactId,
    qualityReportRevision: qrActive.revision,
    productionResultArtifactId: mpActive.artifactId,
    productionResultRevision: mpActive.revision,
    idempotencyKey: "same-key-retry",
    commandFingerprint: "fp",
    correlationId: "corr-retry",
  };
  const first = await h.deliveryRuns.beginOrGetMergeRun({ ...beginInput, id: "run-a" });
  assert.equal(first.status, "created");

  // Simulate the run completing with an output artifact.
  await h.deliveryRuns.persistMergeOutcome({
    directorRunId: "run-a",
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    artifactId: "mp-retry-output",
    productionResultArtifactId: mpActive.artifactId,
    productionResultRevision: mpActive.revision,
    mergeOutcome: { status: "completed" },
    schemaVersion: "1.0.0",
    mergeStatus: "completed",
    updatedProductionResult: (await h.artifacts.load((await h.artifacts.getActive(PROJECT_ID, "production_result"))!.artifactId))!
      .value as Record<string, unknown>,
    productionResultNewId: "pr-retry-output",
    correlationId: "corr-retry",
    createdBy: "tester",
    actorType: "shared_password",
    actorId: "tester",
    expectedRunRevision: 1,
  });

  const retry = await h.deliveryRuns.beginOrGetMergeRun({ ...beginInput, id: "run-b" });
  assert.equal(retry.status, "existing");
  if (retry.status === "existing") {
    assert.equal(retry.outputArtifactId, "mp-retry-output");
  }
});

test("idempotence: persistHumanReviewDecision does not duplicate append-only rows on retried idempotencyKey", async () => {
  const h = harness();
  await runQcToReview(h);
  const qrActive = (await h.artifacts.getActive(PROJECT_ID, "quality_report"))!;
  const prActive = (await h.artifacts.getActive(PROJECT_ID, "production_result"))!;

  const input: PersistHumanReviewDecisionInput = {
    id: "decision-1",
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    qualityReportArtifactId: qrActive.artifactId,
    qualityReportRevision: qrActive.revision,
    productionResultArtifactId: prActive.artifactId,
    productionResultRevision: prActive.revision,
    decision: "approved",
    reviewedIssueCodes: [],
    idempotencyKey: "retry-review-key",
    correlationId: "corr-retry-review",
    actorType: "shared_password",
    actorId: "tester",
    updatedProductionResult: (await h.artifacts.load(prActive.artifactId))!.value as Record<
      string,
      unknown
    >,
    productionResultNewId: "pr-review-output",
    expectedProductionResultRevision: prActive.revision,
  };

  const a = await h.deliveryRuns.persistHumanReviewDecision(input);
  assert.equal(a.status, "created");
  const b = await h.deliveryRuns.persistHumanReviewDecision(input);
  assert.equal(b.status, "existing");
  assert.equal(b.decisionId, a.decisionId);
  assert.equal(h.deliveryRuns.reviews.length, 1, "append-only store must not gain a duplicate row");
});

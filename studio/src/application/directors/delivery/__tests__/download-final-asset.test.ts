/**
 * Unit tests — real final media download (VHS-125 fix). No network, no fal/AICCOS.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type {
  ActiveArtifactPointer,
  ArtifactRepository,
  PersistedArtifact,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";
import type { ArtifactType } from "@/domain/project";
import type { ExportPackage, FinalQualityReport, MergePlan } from "@/domain/postproduction";
import { FINAL_QUALITY_VALIDATOR_VERSION } from "@/domain/postproduction";
import type { ProductionResult } from "@/domain/production";
import {
  buildSyntheticFakeMp4Bytes,
  createMemoryAssetContentPort,
  createUnconfiguredAssetContentPort,
  sha256Hex,
  SYNTHETIC_FAKE_MP4_MARKER,
} from "@/application/postproduction/asset-content-port";
import { buildFakeInternalVideoAsset } from "@/application/postproduction/fake-merge-engine";
import { createDownloadFinalAssetForProject } from "../download-final-asset";
import { buildSafeDownloadFilename } from "../safe-download-filename";
import type { MergeOutcomeRecord } from "../delivery-for-project";

const AT = "2026-08-03T15:00:00.000Z";
const WS = "ws-dl";
const PROJECT = "proj-dl";

function makeProject(overrides: Partial<PersistedVideoProject> = {}): PersistedVideoProject {
  return {
    id: PROJECT,
    workspaceId: WS,
    name: "DL",
    status: "draft",
    activeRevision: 1,
    schemaVersion: "1.0.0",
    createdAt: AT,
    updatedAt: AT,
    archivedAt: null,
    correlationId: "corr-dl",
    ...overrides,
  };
}

type Store = Map<string, PersistedArtifact>;
type Active = Map<string, ActiveArtifactPointer>;

function activeKey(projectId: string, type: ArtifactType) {
  return `${projectId}:${type}`;
}

function makeRepos(
  store: Store,
  active: Active,
  project = makeProject(),
): { projects: ProjectRepository; artifacts: ArtifactRepository } {
  return {
    projects: {
      async create() {
        /* unused */
      },
      async load(id) {
        return id === project.id ? project : null;
      },
      async saveStatus() {
        throw new Error("unused");
      },
    },
    artifacts: {
      async append() {
        /* unused */
      },
      async load(id) {
        return store.get(id) ?? null;
      },
      async loadByRevision() {
        return null;
      },
      async getActive(projectId, artifactType) {
        return active.get(activeKey(projectId, artifactType)) ?? null;
      },
      async setActive() {
        throw new Error("unused");
      },
    },
  };
}

function putArtifact(
  store: Store,
  active: Active,
  type: ArtifactType,
  value: unknown,
  id = randomUUID(),
  revision = 1,
) {
  const row: PersistedArtifact = {
    id,
    workspaceId: WS,
    projectId: PROJECT,
    artifactType: type,
    revision,
    schemaVersion: "1.0.0",
    parentRevisionId: null,
    value,
    createdAt: AT,
    createdBy: "tester",
    correlationId: "corr-dl",
  };
  store.set(id, row);
  active.set(activeKey(PROJECT, type), {
    projectId: PROJECT,
    artifactType: type,
    artifactId: id,
    revision,
    updatedAt: AT,
    updatedBy: "tester",
  });
  return id;
}

function makeQuality(status: FinalQualityReport["status"] = "accepted"): FinalQualityReport {
  return {
    status,
    technicalChecks: [{ code: "mime", passed: true, outcome: "pass", layer: "technical" }],
    contractualChecks: [{ code: "coverage", passed: true, outcome: "pass", layer: "contractual" }],
    editorialChecks: [{ code: "tone", passed: true, outcome: "pass", layer: "editorial" }],
    blockingIssues: [],
    warnings: [],
    reviewedAt: AT,
    validatorVersion: FINAL_QUALITY_VALIDATOR_VERSION,
  };
}

function minimalPlan(): MergePlan {
  return {
    id: "mp-1",
    projectId: PROJECT,
    productionRunId: "run-1",
    productionResultRevisionId: "pr-1",
    storyboardRevisionId: "sb-1",
    schemaVersion: "1.0.0",
    output: { kind: "video", container: "mp4", aspectRatio: "9:16" },
    timeline: [],
    audio: { tracks: [], preventClipping: true, preserveEmbeddedAudio: true },
    transitions: [],
    overlays: [],
    estimatedDurationSeconds: 0,
    policyVersion: "merge-policy.v1",
    createdAt: AT,
  };
}

function seedReadyExport(input: {
  store: Store;
  active: Active;
  assetId: string;
  bytes: Uint8Array;
  content: ReturnType<typeof createMemoryAssetContentPort>;
  qualityStatus?: FinalQualityReport["status"];
  humanReview?: ExportPackage["humanReview"];
  deliveryStatus?: "export_ready" | "merged" | "not_started";
  exportPkgId?: string;
  sizeBytesOverride?: number;
  skipContentPut?: boolean;
}) {
  const asset = buildFakeInternalVideoAsset({
    id: input.assetId,
    sizeBytes: input.sizeBytesOverride ?? input.bytes.byteLength,
    checksum: sha256Hex(input.bytes),
  });
  const quality = makeQuality(input.qualityStatus ?? "accepted");
  putArtifact(input.store, input.active, "quality_report", quality);

  const merge: MergeOutcomeRecord = {
    status: "completed",
    plan: minimalPlan(),
    finalAsset: asset,
  };
  putArtifact(input.store, input.active, "merge_plan", merge);

  const exportId = input.exportPkgId ?? randomUUID();
  const pkg: ExportPackage = {
    id: exportId,
    projectId: PROJECT,
    productionResultRevisionId: "pr-1",
    finalAsset: asset,
    qualityReport: quality,
    humanReview: input.humanReview,
    manifest: {
      schemaVersion: "1.0.0",
      projectId: PROJECT,
      productionRunId: "run-1",
      generationPlanRevisionId: "gp-1",
      storyboardRevisionId: "sb-1",
      finalAssetId: asset.id,
      sceneAssets: [],
      providers: [],
      costs: {
        estimatedAmountMinor: 0,
        committedAmountMinor: 0,
        releasedAmountMinor: 0,
        currency: "USD",
      },
      quality: {
        status: quality.status,
        validatorVersion: quality.validatorVersion,
        blockingCount: 0,
        warningCount: 0,
        humanReviewStatus:
          input.humanReview?.status === "approved" ||
          input.humanReview?.status === "rejected"
            ? input.humanReview.status
            : undefined,
      },
      generatedAt: AT,
    },
    createdAt: AT,
  };
  putArtifact(input.store, input.active, "export_package", pkg);

  const pr = {
    id: "pr-1",
    projectId: PROJECT,
    createdBy: "tester",
    correlationId: "corr",
    createdAt: AT,
    revision: 3,
    artifactType: "production_result",
    schemaVersion: "1.1.0",
    generationPlanRevisionId: "gp-1",
    status: "completed",
    scenes: [],
    estimatedCost: { amountMinor: 0, currency: "USD" },
    committedCost: { amountMinor: 0, currency: "USD" },
    releasedCost: { amountMinor: 0, currency: "USD" },
    currency: "USD",
    startedAt: AT,
    completedAt: AT,
    manifest: {
      planRevisionId: "gp-1",
      runId: "run-1",
      policyVersion: "p",
      scenes: [],
      attempts: [],
      generatedAt: AT,
    },
    warnings: [],
    delivery: {
      status: input.deliveryStatus ?? "export_ready",
      updatedAt: AT,
      exportPackageId: exportId,
      finalAssetId: asset.id,
      mergePlanId: "mp-1",
      qualityReportId: "qr-1",
    },
  } as ProductionResult;
  putArtifact(input.store, input.active, "production_result", pr);

  if (!input.skipContentPut) {
    void input.content.put({
      assetId: asset.id,
      workspaceId: WS,
      projectId: PROJECT,
      mimeType: asset.mimeType,
      bytes: input.bytes,
      storagePath: asset.source.kind === "internal" ? asset.source.storagePath : undefined,
    });
  }
  return { asset, pkg };
}

test("safe filename strips traversal and matches MIME", () => {
  const name = buildSafeDownloadFilename({
    projectId: "../evil/proj",
    assetId: "..\\asset",
    mimeType: "video/mp4",
  });
  assert.equal(name.includes(".."), false);
  assert.equal(name.includes("/"), false);
  assert.equal(name.includes("\\"), false);
  assert.match(name, /\.mp4$/);
});

test("download success — real bytes, headers, provenance", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("unit-success");
  const assetId = randomUUID();
  seedReadyExport({ store, active, assetId, bytes, content });
  const repos = makeRepos(store, active);

  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });

  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(bytes));
  assert.ok(Buffer.from(result.bytes).includes(Buffer.from(SYNTHETIC_FAKE_MP4_MARKER)));
  assert.equal(result.mimeType, "video/mp4");
  assert.equal(result.headers["Content-Type"], "video/mp4");
  assert.match(result.headers["Content-Disposition"], /^attachment; filename="/);
  assert.equal(result.headers["Content-Length"], String(bytes.byteLength));
  assert.equal(result.headers["Cache-Control"], "private, no-store");
  assert.equal(result.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(result.assetId, assetId);
  assert.equal(result.checksumSha256, sha256Hex(bytes));
});

test("download refuses — content backend unconfigured (no fabrication)", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("unconf");
  seedReadyExport({ store, active, assetId: randomUUID(), bytes, content });
  const repos = makeRepos(store, active);
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: createUnconfiguredAssetContentPort(),
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.code, "asset_content_unavailable");
  assert.equal(result.httpHint, 503);
});

test("download refuses — content missing", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("missing");
  seedReadyExport({
    store,
    active,
    assetId: randomUUID(),
    bytes,
    content,
    skipContentPut: true,
  });
  const repos = makeRepos(store, active);
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.code, "content_missing");
});

test("download refuses — size mismatch", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("size");
  seedReadyExport({
    store,
    active,
    assetId: randomUUID(),
    bytes,
    content,
    sizeBytesOverride: bytes.byteLength + 99,
  });
  const repos = makeRepos(store, active);
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.code, "size_mismatch");
});

test("download refuses — invalid MIME", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("mime");
  seedReadyExport({ store, active, assetId: randomUUID(), bytes, content });
  const ep = active.get(activeKey(PROJECT, "export_package"))!;
  const loaded = store.get(ep.artifactId)!;
  (loaded.value as ExportPackage).finalAsset.mimeType = "application/x-msdownload";
  const repos = makeRepos(store, active);
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.code, "invalid_mime");
});

test("download refuses — other workspace project", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("ws");
  seedReadyExport({ store, active, assetId: randomUUID(), bytes, content });
  const repos = makeRepos(store, active, makeProject({ workspaceId: "other-ws" }));
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.code, "not_found");
});

test("download refuses — merge not completed", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("merge");
  seedReadyExport({ store, active, assetId: randomUUID(), bytes, content });
  const mp = active.get(activeKey(PROJECT, "merge_plan"))!;
  const row = store.get(mp.artifactId)!;
  (row.value as MergeOutcomeRecord).status = "prepared";
  delete (row.value as MergeOutcomeRecord).finalAsset;
  const repos = makeRepos(store, active);
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.equal(result.code, "merge_not_completed");
});

test("download refuses — needs_review without approval", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("review");
  seedReadyExport({
    store,
    active,
    assetId: randomUUID(),
    bytes,
    content,
    qualityStatus: "needs_review",
  });
  const repos = makeRepos(store, active);
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  assert.ok(result.code === "needs_review" || result.code === "export_not_ready");
});

test("error payloads never leak paths or secrets", async () => {
  const store: Store = new Map();
  const active: Active = new Map();
  const content = createMemoryAssetContentPort();
  const bytes = buildSyntheticFakeMp4Bytes("sec");
  seedReadyExport({
    store,
    active,
    assetId: randomUUID(),
    bytes,
    content,
    skipContentPut: true,
  });
  const repos = makeRepos(store, active);
  const download = createDownloadFinalAssetForProject({
    workspaceId: WS,
    projects: repos.projects,
    artifacts: repos.artifacts,
    assetContent: content,
    env: {
      DIRECTOR_V2_ENABLED: "1",
      DIRECTOR_V2_PERSISTENCE_ENABLED: "1",
      DIRECTOR_V2_E2E_FAKE_MODE: "1",
      DIRECTOR_V2_E2E_HARNESS: "1",
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
    nowIso: () => AT,
  });
  const result = await download.execute({ projectId: PROJECT });
  assert.equal(result.status, "failed");
  if (result.status !== "failed") return;
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("sk-"), false);
  assert.equal(serialized.includes("service_role"), false);
  assert.equal(serialized.includes("C:\\\\"), false);
  assert.equal(serialized.includes("https://"), false);
});

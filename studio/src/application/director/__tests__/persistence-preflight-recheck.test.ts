/**
 * Phase 188 — adversarial recheck harness (no business-code change).
 * persistenceEnabled !== executionAuthorized
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { buildIsolatedPersistenceEnv } from "../persistence-production-enablement-preflight";
import {
  DIRECTOR_CAPABILITY_DISABLED_CODE,
  DIRECTOR_ROUTE_CATALOG,
  DIRECTOR_ROUTES_CLASSIFIED,
  assertDirectorRoutesFullyClassified,
  authorizeDirectorAction,
  classifyDirectorAction,
  isLocalMotionReviewHarness,
} from "../director-action-policy";
import { DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE } from "../director-project-quota";
import { createAnalyzeMarketingForProject } from "@/application/directors/marketing/analyze-for-project";
import { createAnalyzeCreativeForProject } from "@/application/directors/creative/analyze-for-project";
import { createWriteScriptForProject } from "@/application/directors/script/analyze-for-project";
import { createAnalyzeArtForProject } from "@/application/directors/art/analyze-for-project";
import { createAnalyzeStoryboardForProject } from "@/application/directors/storyboard/analyze-for-project";
import { createBuildScenePackagesForProject } from "@/application/directors/prompt/build-for-project";
import { createRouteGenerationPlanForProject } from "@/application/directors/routing/route-for-project";
import { createApproveArtifactForProject } from "@/application/directors/routing/approve-for-project";
import { createStartProductionForProject } from "@/application/directors/production/start-for-project";
import { createDownloadFinalAssetForProject } from "@/application/directors/delivery/download-final-asset";
import {
  createExecuteMergeForProject,
  createPrepareExportForProject,
  createPrepareMergeForProject,
  createEvaluateProductionQualityForProject,
  createRecordQualityReviewForProject,
} from "@/application/directors/delivery/delivery-for-project";
import { canUseDurableAssetContent } from "@/infrastructure/config/asset-content-backend";
import { phase11EMergeExportFlagsAuditView } from "@/application/production/phase-11e-merge-export-allowlist";
import type {
  ArtifactRepository,
  PersistedVideoProject,
  ProjectRepository,
} from "@/application/projects/ports";

const here = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(here, "..", "..", "..", "..");

export const ADVERSARIAL_POLICY_CASES = [
  { id: "marketing_execute", routeId: "marketing", method: "POST", mode: "execute" },
  { id: "marketing_retry", routeId: "marketing_retry", method: "POST" },
  { id: "creative_execute", routeId: "creative", method: "POST", mode: "execute" },
  { id: "script_execute", routeId: "script", method: "POST", mode: "execute" },
  { id: "art_execute", routeId: "art", method: "POST", mode: "execute" },
  { id: "art_retry", routeId: "art_retry", method: "POST" },
  { id: "storyboard_execute", routeId: "storyboard", method: "POST", mode: "execute" },
  { id: "prompt_execute_ready", routeId: "prompts", method: "POST", mode: "execute" },
  { id: "routing_execute_ready", routeId: "routing", method: "POST", mode: "execute" },
  { id: "routing_approve_plan", routeId: "approvals", method: "POST", mode: "approve_generation_plan" },
  { id: "unknown_mode", routeId: "prompts", method: "POST", mode: "explode" },
  { id: "unknown_route", routeId: "lipsync", method: "POST", mode: "execute" },
  { id: "production_start", routeId: "production", method: "POST", mode: "execute" },
  { id: "production_unknown", routeId: "production", method: "POST", mode: "fork" },
  { id: "merge_prepare", routeId: "merge", method: "POST", mode: "prepare" },
  { id: "merge_execute", routeId: "merge", method: "POST", mode: "execute" },
  { id: "export_execute", routeId: "export", method: "POST", mode: "execute" },
  { id: "export_download", routeId: "export_download", method: "GET", mode: "download" },
  { id: "quality_execute", routeId: "quality", method: "POST", mode: "execute" },
  { id: "quality_review", routeId: "quality_review", method: "POST", mode: "review" },
  { id: "motion_review", routeId: "motion_review", method: "POST", mode: "review" },
] as const;

export const ADVERSARIAL_EXECUTION_CASES_RUN = ADVERSARIAL_POLICY_CASES.length;

const isolated = buildIsolatedPersistenceEnv();
const ctx = { correlationId: "corr-188-recheck", mode: "execute" as const };

function project(id = "hist-ready"): PersistedVideoProject {
  return {
    id,
    workspaceId: "ws-1",
    name: "Historical ready",
    status: "draft",
    activeRevision: 4,
    schemaVersion: "1.0.0",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    archivedAt: null,
    correlationId: "corr-hist",
  };
}

function repos(): { projects: ProjectRepository; artifacts: ArtifactRepository } {
  return {
    projects: {
      async create() {},
      async load(id) {
        return id === "hist-ready" || id === "p1" ? project(id) : null;
      },
      async saveStatus() {
        throw new Error("sentinel:lifecycle");
      },
    },
    artifacts: {
      async append() {
        throw new Error("sentinel:artifact");
      },
      async load() {
        return null;
      },
      async loadByRevision() {
        return null;
      },
      async getActive() {
        return null;
      },
      async setActive() {
        throw new Error("sentinel:setActive");
      },
    },
  };
}

type SentinelName =
  | "budget"
  | "run"
  | "job"
  | "attempt"
  | "enqueue"
  | "provider"
  | "storageGet"
  | "storagePut"
  | "signedUrl"
  | "artifact"
  | "review"
  | "activate"
  | "publish";

function sentinels(): Record<SentinelName, number> & {
  bump: (name: SentinelName) => never;
} {
  const counts: Record<SentinelName, number> = {
    budget: 0,
    run: 0,
    job: 0,
    attempt: 0,
    enqueue: 0,
    provider: 0,
    storageGet: 0,
    storagePut: 0,
    signedUrl: 0,
    artifact: 0,
    review: 0,
    activate: 0,
    publish: 0,
  };
  return {
    ...counts,
    bump(name: SentinelName): never {
      counts[name] += 1;
      this[name] = counts[name];
      throw new Error(`sentinel:${name}`);
    },
  };
}

test("recheck — catalogue 25/0 et modes inconnus refusés", () => {
  const audit = assertDirectorRoutesFullyClassified();
  assert.equal(DIRECTOR_ROUTES_CLASSIFIED, 25);
  assert.equal(DIRECTOR_ROUTE_CATALOG.length, 25);
  assert.equal(audit.unclassified, 0);
  assert.equal(classifyDirectorAction("prompts", "POST", "explode"), null);
  assert.equal(classifyDirectorAction("unknown", "POST", "execute"), null);
  assert.equal(DIRECTOR_PROJECT_QUOTA_MAX_ACTIVE, 50);
});

test("recheck — matrice adversariale policy, zéro autorisation", () => {
  let passed = 0;
  for (const row of ADVERSARIAL_POLICY_CASES) {
    const d = authorizeDirectorAction(
      {
        routeId: row.routeId,
        method: row.method,
        mode: "mode" in row ? row.mode : undefined,
      },
      isolated,
    );
    assert.equal(d.allowed, false, row.id);
    if (d.allowed) continue;
    assert.ok(d.status === 503 || d.status === 404, row.id);
    assert.doesNotMatch(d.publicMessage, /DIRECTOR_|VHS11|OpenAI|fal|flag/i);
    passed += 1;
  }
  assert.equal(passed, ADVERSARIAL_EXECUTION_CASES_RUN);
});

test("recheck — NODE_ENV=test / credentials / merge_ready n’ouvrent rien", () => {
  const hostile = buildIsolatedPersistenceEnv({
    NODE_ENV: "test",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key",
    VERCEL: "1",
    VERCEL_ENV: "production",
  });
  assert.equal(
    authorizeDirectorAction(
      { routeId: "motion_review", method: "POST", mode: "review" },
      hostile,
    ).allowed,
    false,
  );
  assert.equal(isLocalMotionReviewHarness({ NODE_ENV: "test" }), false);
  assert.equal(
    isLocalMotionReviewHarness({
      NODE_ENV: "test",
      MOTION_TRANSFER_FAKE_HARNESS: "1",
      VERCEL: "1",
    }),
    false,
  );
  assert.equal(canUseDurableAssetContent(hostile), false);
  assert.equal(phase11EMergeExportFlagsAuditView(hostile).mergeExportAuthorized, false);
});

test("recheck — Directors texte refusent avant begin/budget", async () => {
  const s = sentinels();
  const unusedRuns = {
    async beginOrGet() {
      s.bump("run");
    },
    async persistMarketingPlan() {
      s.bump("artifact");
    },
    async persistCreativeConcept() {
      s.bump("artifact");
    },
    async persistVideoScript() {
      s.bump("artifact");
    },
    async persistVisualDirection() {
      s.bump("artifact");
    },
    async persistStoryboard() {
      s.bump("artifact");
    },
    async failRun() {},
    async reserveBudget() {
      s.bump("budget");
    },
    async loadActiveMarketingPlan() {
      return null;
    },
    async loadActiveCreativeConcept() {
      return null;
    },
    async loadActiveVideoScript() {
      return null;
    },
    async loadActiveVisualDirection() {
      return null;
    },
    async loadActiveStoryboard() {
      return null;
    },
    async loadRetryableFailedRun() {
      return null;
    },
  };
  const analyzer = {
    async analyze() {
      s.bump("provider");
    },
  };
  const { projects, artifacts } = repos();
  const common = {
    workspaceId: "ws-1",
    projects,
    artifacts,
    directorRuns: unusedRuns as never,
    analyzer: analyzer as never,
    env: isolated,
  };

  const marketing = createAnalyzeMarketingForProject(common);
  const m = await marketing.execute(
    { projectId: "hist-ready", expectedBriefRevision: 1 },
    ctx,
  );
  assert.equal(m.status, "failed");
  if (m.status === "failed") assert.equal(m.httpHint, 503);

  const retry = await marketing.executeRetry(
    {
      projectId: "hist-ready",
      previousRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      retryRequestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedBriefRevision: 1,
    },
    ctx,
  );
  assert.equal(retry.status, "failed");

  const creative = createAnalyzeCreativeForProject(common);
  const c = await creative.execute(
    { projectId: "hist-ready", expectedMarketingPlanRevision: 1 },
    ctx,
  );
  assert.equal(c.status, "failed");

  const script = createWriteScriptForProject(common);
  const sc = await script.execute(
    { projectId: "hist-ready", expectedCreativeConceptRevision: 1 },
    ctx,
  );
  assert.equal(sc.status, "failed");

  const art = createAnalyzeArtForProject(common);
  const a = await art.execute(
    { projectId: "hist-ready", expectedVideoScriptRevision: 1 },
    ctx,
  );
  assert.equal(a.status, "failed");
  const ar = await art.executeRetry(
    {
      projectId: "hist-ready",
      previousRunId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      retryRequestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      expectedVideoScriptRevision: 1,
    },
    ctx,
  );
  assert.equal(ar.status, "failed");

  const story = createAnalyzeStoryboardForProject(common);
  const st = await story.execute(
    { projectId: "hist-ready", expectedVisualDirectionRevision: 1 },
    ctx,
  );
  assert.equal(st.status, "failed");

  assert.equal(s.budget, 0);
  assert.equal(s.run, 0);
  assert.equal(s.provider, 0);
  assert.equal(s.artifact, 0);
});

test("recheck — prompt/routing/production/merge/QC/HR/download sentinelles à zéro", async () => {
  const s = sentinels();
  const { projects, artifacts } = repos();
  const unused = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined;
        throw new Error(`sentinel:dep:${String(prop)}`);
      },
    },
  );

  const prompt = createBuildScenePackagesForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    directorRuns: {
      async beginOrGet() {
        s.bump("run");
      },
      async persistScenePackageSet() {
        s.bump("artifact");
      },
      async failRun() {},
      async loadActiveScenePackageSet() {
        return null;
      },
    } as never,
    env: isolated,
  });
  const pr = await prompt.execute(
    { projectId: "hist-ready", expectedStoryboardRevision: 1 },
    ctx,
  );
  assert.equal(pr.status, "failed");

  const route = createRouteGenerationPlanForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    directorRuns: unused as never,
    budget: unused as never,
    buildRegistry: () => {
      throw new Error("sentinel:registry");
    },
    env: isolated,
  });
  const rt = await route.execute(
    {
      projectId: "hist-ready",
      expectedScenePackageSetRevision: 1,
      expectedRegistrySnapshotVersion: "v",
    },
    ctx,
  );
  assert.equal(rt.status, "failed");

  const approve = createApproveArtifactForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    approvals: {
      async persistApproval() {
        s.bump("review");
      },
    } as never,
    env: isolated,
  });
  const ap = await approve.execute(
    {
      projectId: "hist-ready",
      artifactType: "generation_plan",
      artifactId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      revision: 1,
      decision: "approved",
      expectedProjectRevision: 4,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(ap.status, "failed");

  const start = createStartProductionForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    directorRuns: unused as never,
    budget: unused as never,
    productionDirector: unused as never,
    jobQueue: {
      async enqueue() {
        s.bump("enqueue");
      },
    } as never,
    registry: unused as never,
    productionPorts: {
      budget: {
        async reserve() {
          s.bump("budget");
        },
      },
      runStore: {
        async save() {
          s.bump("run");
        },
      },
    } as never,
    env: isolated,
  });
  const st = await start.execute(
    {
      projectId: "hist-ready",
      expectedGenerationPlanRevision: 1,
      confirmation: true,
    },
    ctx,
  );
  assert.equal(st.status, "failed");

  const mergePrep = createPrepareMergeForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused as never,
    mergeEngine: unused as never,
    contextDeps: unused as never,
    env: isolated,
  });
  const mp = await mergePrep.execute(
    { projectId: "hist-ready", confirmation: true },
    ctx,
  );
  assert.equal(mp.status, "failed");

  const merge = createExecuteMergeForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused as never,
    mergeEngine: unused as never,
    env: isolated,
  });
  const mg = await merge.execute({ projectId: "hist-ready", confirmation: true }, ctx);
  assert.equal(mg.status, "failed");

  const exp = createPrepareExportForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused as never,
    postProductionDirector: unused as never,
    env: isolated,
  });
  const ex = await exp.execute(
    { projectId: "hist-ready", confirmation: true, destinationId: "download" },
    ctx,
  );
  assert.equal(ex.status, "failed");

  const qc = createEvaluateProductionQualityForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused as never,
    postProductionDirector: unused as never,
    contextDeps: unused as never,
    env: isolated,
  });
  const q = await qc.execute({ projectId: "hist-ready", confirmation: true }, ctx);
  assert.equal(q.status, "failed");

  const hr = createRecordQualityReviewForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    deliveryRuns: unused as never,
    postProductionDirector: unused as never,
    env: isolated,
  });
  const h = await hr.execute(
    {
      projectId: "hist-ready",
      confirmation: true,
      decision: "approved",
      reviewedIssueCodes: [],
      expectedQualityReportRevision: 1,
      expectedProductionResultRevision: 1,
    },
    ctx,
  );
  assert.equal(h.status, "failed");

  const dl = createDownloadFinalAssetForProject({
    workspaceId: "ws-1",
    projects,
    artifacts,
    assetContent: {
      configured: true,
      async put() {
        s.bump("storagePut");
      },
      async get() {
        s.bump("storageGet");
      },
    } as never,
    env: isolated,
  });
  const d = await dl.execute({ projectId: "hist-ready" });
  assert.equal(d.status, "failed");
  if (d.status === "failed") {
    assert.equal(d.httpHint, 404);
    assert.equal(d.code, DIRECTOR_CAPABILITY_DISABLED_CODE);
  }

  assert.equal(s.budget, 0);
  assert.equal(s.run, 0);
  assert.equal(s.enqueue, 0);
  assert.equal(s.artifact, 0);
  assert.equal(s.review, 0);
  assert.equal(s.storageGet, 0);
  assert.equal(s.storagePut, 0);
});

test("recheck — routes HTTP execute : policy ou gate *_ai_disabled", () => {
  const textRoutes = [
    "src/app/api/director/projects/[projectId]/marketing/route.ts",
    "src/app/api/director/projects/[projectId]/marketing/retry/route.ts",
    "src/app/api/director/projects/[projectId]/creative/route.ts",
    "src/app/api/director/projects/[projectId]/script/route.ts",
    "src/app/api/director/projects/[projectId]/art/route.ts",
    "src/app/api/director/projects/[projectId]/art/retry/route.ts",
    "src/app/api/director/projects/[projectId]/storyboard/route.ts",
  ];
  const centralRoutes = [
    "src/app/api/director/projects/[projectId]/prompts/route.ts",
    "src/app/api/director/projects/[projectId]/routing/route.ts",
    "src/app/api/director/projects/[projectId]/production/route.ts",
    "src/app/api/director/projects/[projectId]/merge/route.ts",
    "src/app/api/director/projects/[projectId]/export/route.ts",
    "src/app/api/director/projects/[projectId]/export/download/route.ts",
    "src/app/api/director/projects/[projectId]/quality/route.ts",
    "src/app/api/director/projects/[projectId]/quality/review/route.ts",
    "src/app/api/director/projects/[projectId]/approvals/route.ts",
    "src/app/api/director/projects/[projectId]/motion/review/route.ts",
  ];
  for (const file of centralRoutes) {
    const src = readFileSync(join(studioRoot, file), "utf8");
    assert.match(src, /authorizeDirectorAction/, file);
  }
  for (const file of textRoutes) {
    const src = readFileSync(join(studioRoot, file), "utf8");
    assert.doesNotMatch(src, /authorizeDirectorAction/, file);
  }
  const services = [
    "src/application/directors/marketing/analyze-for-project.ts",
    "src/application/directors/creative/analyze-for-project.ts",
    "src/application/directors/script/analyze-for-project.ts",
    "src/application/directors/art/analyze-for-project.ts",
    "src/application/directors/storyboard/analyze-for-project.ts",
  ];
  for (const file of services) {
    const src = readFileSync(join(studioRoot, file), "utf8");
    assert.match(src, /_ai_disabled|canExecute(Marketing|Creative|Script|Art|Storyboard)Ai/, file);
    const gateAt = src.search(/_ai_disabled|canExecute(Marketing|Creative|Script|Art|Storyboard)Ai/);
    const beginAt = src.indexOf("beginOrGet");
    assert.ok(gateAt >= 0 && (beginAt < 0 || gateAt < beginAt), file);
  }
});

test("recheck 189 — Playwright persistence-only refuse le skip durable", () => {
  const src = readFileSync(
    join(studioRoot, "e2e/specs/director-persistence-only.spec.ts"),
    "utf8",
  );
  assert.doesNotMatch(src, /durable path skipped/);
  assert.match(src, /PERSISTENCE_DURABLE_E2E_SKIPPED=1/);
  assert.match(src, /PERSISTENCE_DURABLE_E2E_SKIPPED=0/);
});

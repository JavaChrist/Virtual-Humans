/**
 * Server wiring for Director V2 persistence (VHS-116 / VHS-117B).
 * Never import from client components.
 */

import { createAnalyzeMarketingForProject } from "@/application/directors/marketing/analyze-for-project";
import type { MarketingAnalyzerPort } from "@/application/directors/marketing";
import { createAnalyzeCreativeForProject } from "@/application/directors/creative/analyze-for-project";
import type { CreativeAnalyzerPort } from "@/application/directors/creative/analyzer-port";
import { createWriteScriptForProject } from "@/application/directors/script/analyze-for-project";
import type { ScriptAnalyzerPort } from "@/application/directors/script/analyzer-port";
import { createAnalyzeArtForProject } from "@/application/directors/art/analyze-for-project";
import type { ArtAnalyzerPort } from "@/application/directors/art/analyzer-port";
import { createAnalyzeStoryboardForProject } from "@/application/directors/storyboard/analyze-for-project";
import type { StoryboardAnalyzerPort } from "@/application/directors/storyboard/analyzer-port";
import {
  createBuildScenePackagesForProject,
  createDeterministicPromptAnalyzer,
} from "@/application/directors/prompt/build-for-project";
import type { PromptAnalyzerPort } from "@/application/directors/prompt/analyzer-port";
import { createRouteGenerationPlanForProject } from "@/application/directors/routing/route-for-project";
import { createApproveArtifactForProject } from "@/application/directors/routing/approve-for-project";
import { createStartProductionForProject } from "@/application/directors/production/start-for-project";
import {
  createEvaluateProductionQualityForProject,
  createExecuteMergeForProject,
  createPrepareExportForProject,
  createPrepareMergeForProject,
  createRecordQualityReviewForProject,
} from "@/application/directors/delivery/delivery-for-project";
import type { LoadProductionRunPort } from "@/application/directors/delivery/load-production-context";
import {
  buildFakeInternalVideoAsset,
  buildSyntheticFakeMp4Bytes,
  createFakeMergeEngine,
  createMemoryAssetContentPort,
  createUnconfiguredAssetContentPort,
  createPostProductionDirector,
  createDownloadExportAdapter,
  createUnavailableAiccosExportAdapter,
  sha256Hex,
  type AssetContentBackend,
  type MergeEngine,
} from "@/application/postproduction";
import { canUseProcessLocalFakeAssetContent } from "@/infrastructure/config/local-fake-delivery";
import { createDownloadFinalAssetForProject } from "@/application/directors/delivery/download-final-asset";
import { createReviseProjectBrief } from "@/application/directors/brief/revise-for-project";
import type { CapabilityRegistrySnapshot } from "@/domain/routing/capabilities";
import type { GenerationPlan } from "@/domain/routing/router";
import type { ScenePackage } from "@/domain/prompt";
import { ScenePackageSetSchema } from "@/domain/prompt";
import { GENERATION_PLAN_ARTIFACT_TYPE } from "@/domain/routing/router";
import type { ArtifactType } from "@/domain/project";
import { createCreateDirectorProject } from "@/application/projects/create-director-project";
import { createGetDirectorProject } from "@/application/projects/get-director-project";
import { createListDirectorProjects } from "@/application/projects/list-director-projects";
import {
  createGenerationEngine,
  createProviderAdapterRegistry,
  type GenerationEngine,
  type ProviderAdapterRegistry,
} from "@/application/generation";
import type { ProviderAdapter } from "@/domain/generation";
import { createProductionDirector, type ProductionDirector } from "@/application/production/production-director";
import type { ProductionPorts } from "@/application/production/ports";
import { createAcceptingQualityPort } from "@/application/production/accepting-quality";
import { parseOpenAIArtConfig, parseOpenAICreativeConfig, parseOpenAIMarketingConfig, parseOpenAIScriptConfig, parseOpenAIStoryboardConfig } from "@/infrastructure/ai/openai/config";
import { createFetchOpenAIResponsesClient } from "@/infrastructure/ai/openai/responses-client";
import { createOpenAIMarketingAnalyzerAdapter } from "@/infrastructure/ai/openai/marketing/adapter";
import { createOpenAICreativeAnalyzerAdapter } from "@/infrastructure/ai/openai/creative";
import { createOpenAIScriptAnalyzerAdapter } from "@/infrastructure/ai/openai/script";
import { createOpenAIArtAnalyzerAdapter } from "@/infrastructure/ai/openai/art";
import { createOpenAIStoryboardAnalyzerAdapter } from "@/infrastructure/ai/openai/storyboard";
import { createEnvAiTokenPricing } from "@/infrastructure/ai/openai/marketing/pricing";
import {
  canExecuteArtAi,
  canExecuteCreativeAi,
  canExecuteMarketingAi,
  canExecuteScriptAi,
  canExecuteStoryboardAi,
  getFeatureFlags,
} from "@/infrastructure/config/feature-flags";
import { createUniversalFakeAdapter } from "@/infrastructure/providers/fake-universal-adapter";
import { createProductionWorkerFromDeps } from "@/infrastructure/worker/factory";
import { adaptProductionJobQueue } from "@/infrastructure/worker/queue-adapter";
import { DEFAULT_WORKER_POLICY } from "@/application/worker/policy";
import type { ProductionWorker } from "@/application/worker/production-worker";
import { isDirectorE2eFakeMode } from "@/infrastructure/config/e2e-fake-mode";
import { buildE2eSyntheticCapabilityRegistry } from "@/infrastructure/e2e/e2e-capability-registry";
import { createE2eFakeDirectorAnalyzers } from "@/infrastructure/e2e/fake-director-analyzers";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { createSupabaseArtifactRepository } from "./repositories/artifact-repository";
import { createSupabaseProjectRepository } from "./repositories/project-repository";
import { createSupabaseMarketingDirectorRunPort } from "./repositories/director-run-repository";
import { createSupabaseCreativeDirectorRunPort } from "./repositories/creative-director-run-repository";
import { createSupabaseScriptDirectorRunPort } from "./repositories/script-director-run-repository";
import { createSupabaseArtDirectorRunPort } from "./repositories/art-director-run-repository";
import { createSupabaseStoryboardDirectorRunPort } from "./repositories/storyboard-director-run-repository";
import { createSupabasePromptDirectorRunPort } from "./repositories/prompt-director-run-repository";
import {
  createSupabaseArtifactApprovalPort,
  createSupabaseRoutingBudgetPort,
  createSupabaseRoutingDirectorRunPort,
} from "./repositories/routing-director-run-repository";
import { createSupabaseProductionDirectorRunPort } from "./repositories/production-director-repository";
import { createSupabaseDeliveryDirectorRunPort } from "./repositories/delivery-director-repository";
import { createSupabaseBriefRevisePort } from "./repositories/brief-revision-repository";
import { createSupabaseProductionRunStore } from "./repositories/production-run-store";
import { createSupabaseBudgetReservationPort } from "./ledger/budget-reservation-port";
import { createSupabaseProductionIdempotencyPort } from "./idempotency/production-idempotency-port";
import { createSupabaseProductionEventPort } from "./outbox/production-event-port";
import { createSupabaseProductionJobQueue } from "./queue/production-job-queue";
import { getV2SupabaseFromEnv, type V2DbClient } from "./supabase-server";

/**
 * Process-scoped memory content store for fake merge downloads.
 * createDirectorPersistenceStack() is per-request — a fresh Map each time
 * would lose bytes between merge execute and export download.
 *
 * GATED (Phase 9): local Supabase / E2E harness only — never Vercel, never
 * remote Supabase, never production without DIRECTOR_V2_E2E_HARNESS.
 * Not multi-instance safe.
 */
let sharedFakeMergeAssetContent: ReturnType<typeof createMemoryAssetContentPort> | null =
  null;

function getSharedFakeMergeAssetContent() {
  if (!sharedFakeMergeAssetContent) {
    sharedFakeMergeAssetContent = createMemoryAssetContentPort();
  }
  return sharedFakeMergeAssetContent;
}

/** Test-only — clears process-local fake merge bytes between suites. */
export function resetSharedFakeMergeAssetContentForTests(): void {
  sharedFakeMergeAssetContent = null;
}

function resolveDefaultAssetContent(
  env: Record<string, string | undefined>,
): AssetContentBackend {
  if (!canUseProcessLocalFakeAssetContent(env)) {
    return createUnconfiguredAssetContentPort();
  }
  return getSharedFakeMergeAssetContent();
}

/** Default /director production path — FAKE adapters only (VHS-124). */
export function createDirectorFakeProviderAdapters(): ProviderAdapter[] {
  return [
    createUniversalFakeAdapter("fal"),
    createUniversalFakeAdapter("openai"),
    createUniversalFakeAdapter("elevenlabs"),
  ];
}

/**
 * Real provider adapters are forbidden on the /director production path.
 * Callers that need real adapters must use a different stack explicitly.
 */
export function assertDirectorProductionUsesFakes(mode?: "fake" | "real"): void {
  if (mode === "real") {
    throw new Error(
      "Real provider adapters (fal/OpenAI/ElevenLabs) are forbidden on the /director production path. Use fake adapters only (VHS-124).",
    );
  }
}

/** Production analyzer — real OpenAI client only when paid marketing flags allow. */
function createProductionMarketingAnalyzer(
  env: Record<string, string | undefined>
): MarketingAnalyzerPort {
  const config = parseOpenAIMarketingConfig(env);
  if (!canExecuteMarketingAi(env) || !config.apiKey) {
    return {
      async analyze() {
        throw new Error("Marketing AI disabled or not configured.");
      },
    };
  }
  return createOpenAIMarketingAnalyzerAdapter({
    client: createFetchOpenAIResponsesClient({ apiKey: config.apiKey }),
    config,
    env,
    pricing: createEnvAiTokenPricing(env),
  });
}

function createProductionCreativeAnalyzer(env: Record<string, string | undefined>): CreativeAnalyzerPort {
  const config = parseOpenAICreativeConfig(env);
  if (!canExecuteCreativeAi(env) || !config.apiKey) {
    return { async analyze() { throw new Error("Creative AI disabled or not configured."); } };
  }
  return createOpenAICreativeAnalyzerAdapter({
    client: createFetchOpenAIResponsesClient({ apiKey: config.apiKey }),
    config, env, pricing: createEnvAiTokenPricing(env),
  });
}

function createProductionScriptAnalyzer(env: Record<string, string | undefined>): ScriptAnalyzerPort {
  const config = parseOpenAIScriptConfig(env);
  if (!canExecuteScriptAi(env) || !config.apiKey) {
    return { async analyze() { throw new Error("Script AI disabled or not configured."); } };
  }
  return createOpenAIScriptAnalyzerAdapter({
    client: createFetchOpenAIResponsesClient({ apiKey: config.apiKey }),
    config, env, pricing: createEnvAiTokenPricing(env),
  });
}

function createProductionArtAnalyzer(env: Record<string, string | undefined>): ArtAnalyzerPort {
  const config = parseOpenAIArtConfig(env);
  if (!canExecuteArtAi(env) || !config.apiKey) {
    return { async analyze() { throw new Error("Art AI disabled or not configured."); } };
  }
  return createOpenAIArtAnalyzerAdapter({
    client: createFetchOpenAIResponsesClient({ apiKey: config.apiKey }),
    config, env, pricing: createEnvAiTokenPricing(env),
  });
}

function createProductionStoryboardAnalyzer(env: Record<string, string | undefined>): StoryboardAnalyzerPort {
  const config = parseOpenAIStoryboardConfig(env);
  if (!canExecuteStoryboardAi(env) || !config.apiKey) {
    return { async analyze() { throw new Error("Storyboard AI disabled or not configured."); } };
  }
  return createOpenAIStoryboardAnalyzerAdapter({
    client: createFetchOpenAIResponsesClient({ apiKey: config.apiKey }),
    config, env, pricing: createEnvAiTokenPricing(env),
  });
}

export function createDirectorPersistenceStack(deps?: {
  client?: V2DbClient;
  workspaceId?: string;
  nowIso?: () => string;
  /** Test injection only — never a silent fake in production callers. */
  marketingAnalyzer?: MarketingAnalyzerPort;
  creativeAnalyzer?: CreativeAnalyzerPort;
  scriptAnalyzer?: ScriptAnalyzerPort;
  artAnalyzer?: ArtAnalyzerPort;
  storyboardAnalyzer?: StoryboardAnalyzerPort;
  promptAnalyzer?: PromptAnalyzerPort;
  /** Test injection — defaults to studio legacy pricing catalogue (no network). */
  buildRegistry?: (options: {
    createdAt: string;
    registryVersion: string;
  }) => CapabilityRegistrySnapshot;
  /** Test injection — override provider adapters (must remain fakes in /director). */
  providerAdapters?: ProviderAdapter[];
  /** Test injection — full generation engine override. */
  generationEngine?: GenerationEngine;
  /** Forbidden: requesting real adapters on /director path. */
  providerMode?: "fake" | "real";
  env?: Record<string, string | undefined>;
  /** Test injection — Phase 5 delivery uses a fake merge engine only (VHS-125). */
  mergeEngine?: MergeEngine;
  /**
   * Recoverable asset bytes backend. Default: in-memory port for fake merge local path.
   * Pass createUnconfiguredAssetContentPort() to assert download fails without fabrication.
   */
  assetContent?: AssetContentBackend;
  /** Override content provider for completed merge assets (tests). */
  provideMergeContentBytes?: (asset: import("@/domain/generation").GeneratedAsset) => Uint8Array | null | undefined;
}) {
  assertDirectorProductionUsesFakes(deps?.providerMode);
  const env = deps?.env ?? (process.env as Record<string, string | undefined>);
  const e2eFake =
    isDirectorE2eFakeMode(env) &&
    !deps?.marketingAnalyzer &&
    !deps?.creativeAnalyzer &&
    !deps?.scriptAnalyzer &&
    !deps?.artAnalyzer &&
    !deps?.storyboardAnalyzer
      ? createE2eFakeDirectorAnalyzers({
          failStage:
            env.DIRECTOR_V2_E2E_FAKE_FAIL === "marketing" ||
            env.DIRECTOR_V2_E2E_FAKE_FAIL === "creative" ||
            env.DIRECTOR_V2_E2E_FAKE_FAIL === "script" ||
            env.DIRECTOR_V2_E2E_FAKE_FAIL === "art" ||
            env.DIRECTOR_V2_E2E_FAKE_FAIL === "storyboard"
              ? env.DIRECTOR_V2_E2E_FAKE_FAIL
              : undefined,
        })
      : null;
  const base =
    deps?.client && deps.workspaceId
      ? { client: deps.client, workspaceId: deps.workspaceId }
      : getV2SupabaseFromEnv();
  const { client, workspaceId } = base;
  const projects = createSupabaseProjectRepository({ client, workspaceId });
  const artifacts = createSupabaseArtifactRepository({ client, workspaceId });
  const createPort = createSupabaseCreateProjectWithBriefPort({ client });
  const directorRuns = createSupabaseMarketingDirectorRunPort({
    client,
    workspaceId,
  });
  const creativeDirectorRuns = createSupabaseCreativeDirectorRunPort({ client, workspaceId });
  const scriptDirectorRuns = createSupabaseScriptDirectorRunPort({ client, workspaceId });
  const artDirectorRuns = createSupabaseArtDirectorRunPort({ client, workspaceId });
  const storyboardDirectorRuns = createSupabaseStoryboardDirectorRunPort({ client, workspaceId });
  const promptDirectorRuns = createSupabasePromptDirectorRunPort({ client, workspaceId });
  const routingDirectorRuns = createSupabaseRoutingDirectorRunPort({ client, workspaceId });
  const routingBudget = createSupabaseRoutingBudgetPort({ client });
  const artifactApprovals = createSupabaseArtifactApprovalPort({ client });
  const productionDirectorRuns = createSupabaseProductionDirectorRunPort({ client, workspaceId });
  const deliveryDirectorRuns = createSupabaseDeliveryDirectorRunPort({ client, workspaceId });
  const briefRevisions = createSupabaseBriefRevisePort({ client, workspaceId });
  const analyzer =
    deps?.marketingAnalyzer ??
    e2eFake?.marketingAnalyzer ??
    createProductionMarketingAnalyzer(env);
  const creativeAnalyzer =
    deps?.creativeAnalyzer ??
    e2eFake?.creativeAnalyzer ??
    createProductionCreativeAnalyzer(env);
  const scriptAnalyzer =
    deps?.scriptAnalyzer ??
    e2eFake?.scriptAnalyzer ??
    createProductionScriptAnalyzer(env);
  const artAnalyzer =
    deps?.artAnalyzer ?? e2eFake?.artAnalyzer ?? createProductionArtAnalyzer(env);
  const storyboardAnalyzer =
    deps?.storyboardAnalyzer ??
    e2eFake?.storyboardAnalyzer ??
    createProductionStoryboardAnalyzer(env);
  const promptAnalyzer = deps?.promptAnalyzer ?? createDeterministicPromptAnalyzer();

  // --- Production stack (VHS-124) — fake providers only ---
  const planCache = new Map<string, GenerationPlan>();
  const packageCache = new Map<string, ScenePackage[]>();

  async function hydratePlan(plan: GenerationPlan, packages: ScenePackage[]) {
    planCache.set(plan.id, plan);
    packageCache.set(plan.id, packages);
  }

  async function hydratePlanById(planRevisionId: string) {
    const cachedPackages = packageCache.get(planRevisionId);
    if (planCache.has(planRevisionId) && cachedPackages && cachedPackages.length > 0) {
      return;
    }
    const artifact = await artifacts.load(planRevisionId);
    if (!artifact || artifact.artifactType !== "generation_plan") return;
    const plan = artifact.value as GenerationPlan;
    if (plan?.artifactType !== GENERATION_PLAN_ARTIFACT_TYPE) return;
    planCache.set(plan.id, plan);
    planCache.set(planRevisionId, plan);

    const pkgIds = plan.scenePackageRevisionIds ?? [];
    let packages: ScenePackage[] = [];
    if (pkgIds.length > 0) {
      const pkgArtifact = await artifacts.load(pkgIds[0]!);
      if (pkgArtifact) {
        const parsed = ScenePackageSetSchema.safeParse(pkgArtifact.value);
        if (parsed.success) {
          packages = [...parsed.data.packages].sort((a, b) => a.sceneOrder - b.sceneOrder);
        }
      }
    }
    if (packages.length === 0) {
      const active = await artifacts.getActive(artifact.projectId, "scene_package_set");
      if (active) {
        const pkgArtifact = await artifacts.load(active.artifactId);
        if (pkgArtifact) {
          const parsed = ScenePackageSetSchema.safeParse(pkgArtifact.value);
          if (parsed.success) {
            packages = [...parsed.data.packages].sort((a, b) => a.sceneOrder - b.sceneOrder);
          }
        }
      }
    }
    packageCache.set(plan.id, packages);
    packageCache.set(planRevisionId, packages);
  }

  const providerAdapters = deps?.providerAdapters ?? createDirectorFakeProviderAdapters();
  const registry: ProviderAdapterRegistry = createProviderAdapterRegistry(providerAdapters);
  const generationEngine =
    deps?.generationEngine ?? createGenerationEngine({ registry });

  const runStore = createSupabaseProductionRunStore({
    client,
    workspaceId,
    resolvePlanArtifactId: async (planRevisionId) => {
      const cached = planCache.get(planRevisionId);
      if (cached) {
        const active = await artifacts.getActive(
          cached.projectId,
          "generation_plan",
        );
        if (active) {
          return { artifactId: active.artifactId, revision: active.revision };
        }
        // plan.id is the artifact uuid when persisted via routing
        return { artifactId: planRevisionId, revision: cached.revision ?? 1 };
      }
      const artifact = await artifacts.load(planRevisionId);
      if (!artifact) throw new Error("Plan artifact introuvable.");
      return { artifactId: artifact.id, revision: artifact.revision };
    },
  });

  const budgetReservation = createSupabaseBudgetReservationPort({
    client,
    workspaceId,
    resolveProjectIdForRun: async (runId) => {
      const { data } = await client
        .from("production_runs")
        .select("project_id")
        .eq("id", runId)
        .maybeSingle();
      if (!data?.project_id) throw new Error("run project missing");
      return data.project_id as string;
    },
  });

  const idempotency = createSupabaseProductionIdempotencyPort({
    client,
    workspaceId,
    resolveProjectId: async (key) => {
      // Keys are typically `projectId:...` (see buildIdempotencyKey).
      const maybeUuid = key.split(":")[0] ?? "";
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          maybeUuid,
        )
      ) {
        return maybeUuid;
      }
      const { data } = await client
        .from("video_projects")
        .select("id")
        .eq("workspace_id", workspaceId)
        .limit(1)
        .maybeSingle();
      if (!data?.id) throw new Error("project missing");
      return data.id as string;
    },
  });

  const events = createSupabaseProductionEventPort({ client, workspaceId });
  const productionPorts: ProductionPorts = {
    runStore,
    budget: budgetReservation,
    idempotency,
    quality: createAcceptingQualityPort(),
    events,
    eventPublishFailurePolicy: "fail_soft",
  };

  const baseDirector = createProductionDirector({
    engine: generationEngine,
    ports: productionPorts,
    resolvePlan: (id) => planCache.get(id) ?? null,
    resolveScenePackages: (id) => packageCache.get(id) ?? [],
  });

  const productionDirector: ProductionDirector = {
    start: (input, ctx) => baseDirector.start(input, ctx),
    advance: async (runId, ctx) => {
      const run = await runStore.load(runId);
      if (run) await hydratePlanById(run.generationPlanRevisionId);
      return baseDirector.advance(runId, ctx);
    },
    requestCancellation: (runId, ctx) => baseDirector.requestCancellation(runId, ctx),
    planEnqueueCommands: async (runId, ctx) => {
      const run = await runStore.load(runId);
      if (run) await hydratePlanById(run.generationPlanRevisionId);
      return baseDirector.planEnqueueCommands(runId, ctx);
    },
    processClaimedJob: async (job, lease, ctx) => {
      await hydratePlanById(job.payload.planRevisionId);
      return baseDirector.processClaimedJob(job, lease, ctx);
    },
  };

  const jobQueueRaw = createSupabaseProductionJobQueue({ client, workspaceId });
  const jobQueue = adaptProductionJobQueue(jobQueueRaw);

  async function clearStaleSafe(projectId: string, artifactType: string) {
    try {
      await briefRevisions.clearStale({ workspaceId, projectId, artifactType });
    } catch {
      // Non-fatal: fresh persist still wins; stale may linger until next clear.
    }
  }

  /** Clears stale flag after a successful director persist of that artifact type. */
  function withClearStaleOnSuccess<T>(service: T, artifactType: ArtifactType): T {
    const svc = service as {
      execute: (
        input: { projectId: string },
        context: unknown,
      ) => Promise<{ status: string }>;
    };
    const originalExecute = svc.execute.bind(svc);
    svc.execute = async (input, context) => {
      const result = await originalExecute(input, context);
      if (result.status === "completed" || result.status === "existing") {
        await clearStaleSafe(input.projectId, artifactType);
      }
      return result;
    };
    return service;
  }

  const startProduction = createStartProductionForProject({
    workspaceId,
    projects,
    artifacts,
    directorRuns: productionDirectorRuns,
    budget: routingBudget,
    productionDirector,
    jobQueue,
    registry,
    productionPorts,
    hydratePlan,
    listStaleTypes: async (projectId) => {
      const rows = await briefRevisions.listStale({ workspaceId, projectId });
      return rows.map((r) => r.artifactType);
    },
    env,
    nowIso: deps?.nowIso,
  });

  const reviseBrief = createReviseProjectBrief({
    workspaceId,
    projects,
    artifacts,
    briefRevisions,
    env,
    nowIso: deps?.nowIso,
  });

  // --- Phase 5 delivery stack (VHS-125) — fake merge engine only, no real fal/AICCOS ---
  const productionRunsPort: LoadProductionRunPort = {
    loadProductionRunById: (runId) => productionDirectorRuns.loadProductionRunById(runId),
    loadLatestTerminalProductionRun: (projectId) =>
      productionDirectorRuns.loadLatestTerminalProductionRun(projectId),
  };
  /** Synthetic fake media bytes — clearly marked, tiny, deterministic; never a real provider result. */
  const fakeMergeContentBytes = buildSyntheticFakeMp4Bytes("director-local");
  const fakeMergeAssetId = "a125a125-a125-4125-8125-a125a125a125";
  const fakeMergeAsset = buildFakeInternalVideoAsset({
    id: fakeMergeAssetId,
    sizeBytes: fakeMergeContentBytes.byteLength,
    checksum: sha256Hex(fakeMergeContentBytes),
  });
  const localFakeContentAllowed = canUseProcessLocalFakeAssetContent(env);
  const assetContent: AssetContentBackend =
    deps?.assetContent ?? resolveDefaultAssetContent(env);
  const deliveryMergeEngine: MergeEngine =
    deps?.mergeEngine ??
    createFakeMergeEngine({
      mode: "sync",
      asset: fakeMergeAsset,
    });
  const postProductionDirector = createPostProductionDirector({
    mergeEngine: deliveryMergeEngine,
    destinations: [createDownloadExportAdapter(), createUnavailableAiccosExportAdapter()],
  });
  const contextDeps = { artifacts, productionRuns: productionRunsPort, nowIso: deps?.nowIso };

  const evaluateQuality = createEvaluateProductionQualityForProject({
    workspaceId,
    projects,
    artifacts,
    deliveryRuns: deliveryDirectorRuns,
    postProductionDirector,
    contextDeps,
    env,
    nowIso: deps?.nowIso,
  });
  const recordQualityReview = createRecordQualityReviewForProject({
    workspaceId,
    projects,
    artifacts,
    deliveryRuns: deliveryDirectorRuns,
    postProductionDirector,
    env,
    nowIso: deps?.nowIso,
  });
  const prepareMerge = createPrepareMergeForProject({
    workspaceId,
    projects,
    artifacts,
    deliveryRuns: deliveryDirectorRuns,
    mergeEngine: deliveryMergeEngine,
    contextDeps,
    env,
    nowIso: deps?.nowIso,
  });
  const defaultProvideMergeBytes = (asset: {
    id: string;
    source: { kind: string; storagePath?: string };
  }) => {
    if (!localFakeContentAllowed) return null;
    if (asset.id === fakeMergeAssetId) return fakeMergeContentBytes;
    if (
      asset.source.kind === "internal" &&
      typeof asset.source.storagePath === "string" &&
      asset.source.storagePath.startsWith("fake-merge/")
    ) {
      return fakeMergeContentBytes;
    }
    return null;
  };
  const executeMerge = createExecuteMergeForProject({
    workspaceId,
    projects,
    artifacts,
    deliveryRuns: deliveryDirectorRuns,
    mergeEngine: deliveryMergeEngine,
    assetContent,
    provideMergeContentBytes:
      deps?.provideMergeContentBytes ??
      (deps?.mergeEngine ? undefined : defaultProvideMergeBytes),
    env,
    nowIso: deps?.nowIso,
  });
  const prepareExport = createPrepareExportForProject({
    workspaceId,
    projects,
    artifacts,
    deliveryRuns: deliveryDirectorRuns,
    postProductionDirector,
    env,
    nowIso: deps?.nowIso,
  });
  const downloadFinalAsset = createDownloadFinalAssetForProject({
    workspaceId,
    projects,
    artifacts,
    assetContent,
    env,
    nowIso: deps?.nowIso,
  });

  function createWorker(workerId = "director-worker-local"): ProductionWorker {
    const flags = getFeatureFlags(env);
    const e2eWorkerPolicy = isDirectorE2eFakeMode(env)
      ? {
          claimLimit: 10,
          maximumJobsPerRun: 20,
          maximumProviderCallsPerRun: 20,
          maximumRunDurationMs: 60_000,
        }
      : {};
    return createProductionWorkerFromDeps({
      policy: { ...DEFAULT_WORKER_POLICY, ...e2eWorkerPolicy, workerId },
      flags,
      queue: jobQueue,
      director: productionDirector,
      engine: generationEngine,
      ports: productionPorts,
    });
  }

  return {
    workspaceId,
    client,
    projects,
    artifacts,
    directorRuns,
    creativeDirectorRuns,
    scriptDirectorRuns,
    artDirectorRuns,
    storyboardDirectorRuns,
    promptDirectorRuns,
    productionPorts,
    productionDirector,
    generationEngine,
    providerRegistry: registry,
    createProject: createCreateDirectorProject({
      port: createPort,
      nowIso: deps?.nowIso ?? (() => new Date().toISOString()),
    }),
    getProject: createGetDirectorProject({ projects, artifacts }),
    listProjects: createListDirectorProjects({ projects, artifacts }),
    analyzeMarketing: withClearStaleOnSuccess(
      createAnalyzeMarketingForProject({
        workspaceId,
        projects,
        artifacts,
        directorRuns,
        analyzer,
        pricing: createEnvAiTokenPricing(env),
        env,
      }),
      "marketing_plan",
    ),
    analyzeCreative: withClearStaleOnSuccess(
      createAnalyzeCreativeForProject({
        workspaceId, projects, artifacts, directorRuns: creativeDirectorRuns,
        analyzer: creativeAnalyzer, pricing: createEnvAiTokenPricing(env), env,
      }),
      "creative_concept",
    ),
    writeScript: withClearStaleOnSuccess(
      createWriteScriptForProject({
        workspaceId, projects, artifacts, directorRuns: scriptDirectorRuns,
        analyzer: scriptAnalyzer, pricing: createEnvAiTokenPricing(env), env,
      }),
      "video_script",
    ),
    analyzeArt: withClearStaleOnSuccess(
      createAnalyzeArtForProject({
        workspaceId, projects, artifacts, directorRuns: artDirectorRuns,
        analyzer: artAnalyzer, pricing: createEnvAiTokenPricing(env), env,
      }),
      "visual_direction",
    ),
    analyzeStoryboard: withClearStaleOnSuccess(
      createAnalyzeStoryboardForProject({
        workspaceId, projects, artifacts, directorRuns: storyboardDirectorRuns,
        analyzer: storyboardAnalyzer, pricing: createEnvAiTokenPricing(env), env,
      }),
      "storyboard_project",
    ),
    buildScenePackages: withClearStaleOnSuccess(
      createBuildScenePackagesForProject({
        workspaceId,
        projects,
        artifacts,
        directorRuns: promptDirectorRuns,
        analyzer: promptAnalyzer,
        env,
      }),
      "scene_package_set",
    ),
    routeGenerationPlan: withClearStaleOnSuccess(
      createRouteGenerationPlanForProject({
        workspaceId,
        projects,
        artifacts,
        directorRuns: routingDirectorRuns,
        budget: routingBudget,
        buildRegistry:
          deps?.buildRegistry ??
          (isDirectorE2eFakeMode(env)
            ? (options) => buildE2eSyntheticCapabilityRegistry(options)
            : undefined),
        env,
        nowIso: deps?.nowIso,
      }),
      "generation_plan",
    ),
    approveArtifact: createApproveArtifactForProject({
      workspaceId,
      projects,
      artifacts,
      approvals: artifactApprovals,
      env,
    }),
    reviseBrief,
    listStale: (projectId: string) =>
      briefRevisions.listStale({ workspaceId, projectId }),
    startProduction,
    evaluateQuality,
    recordQualityReview,
    prepareMerge,
    executeMerge,
    prepareExport,
    downloadFinalAsset,
    assetContent,
    createWorker,
  };
}

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
import { createCreateDirectorProject } from "@/application/projects/create-director-project";
import { createGetDirectorProject } from "@/application/projects/get-director-project";
import { createListDirectorProjects } from "@/application/projects/list-director-projects";
import { parseOpenAIArtConfig, parseOpenAICreativeConfig, parseOpenAIMarketingConfig, parseOpenAIScriptConfig, parseOpenAIStoryboardConfig } from "@/infrastructure/ai/openai/config";
import { createFetchOpenAIResponsesClient } from "@/infrastructure/ai/openai/responses-client";
import { createOpenAIMarketingAnalyzerAdapter } from "@/infrastructure/ai/openai/marketing/adapter";
import { createOpenAICreativeAnalyzerAdapter } from "@/infrastructure/ai/openai/creative";
import { createOpenAIScriptAnalyzerAdapter } from "@/infrastructure/ai/openai/script";
import { createOpenAIArtAnalyzerAdapter } from "@/infrastructure/ai/openai/art";
import { createOpenAIStoryboardAnalyzerAdapter } from "@/infrastructure/ai/openai/storyboard";
import { createEnvAiTokenPricing } from "@/infrastructure/ai/openai/marketing/pricing";
import { canExecuteArtAi, canExecuteCreativeAi, canExecuteMarketingAi, canExecuteScriptAi, canExecuteStoryboardAi } from "@/infrastructure/config/feature-flags";
import { createSupabaseCreateProjectWithBriefPort } from "./repositories/create-project-with-brief";
import { createSupabaseArtifactRepository } from "./repositories/artifact-repository";
import { createSupabaseProjectRepository } from "./repositories/project-repository";
import { createSupabaseMarketingDirectorRunPort } from "./repositories/director-run-repository";
import { createSupabaseCreativeDirectorRunPort } from "./repositories/creative-director-run-repository";
import { createSupabaseScriptDirectorRunPort } from "./repositories/script-director-run-repository";
import { createSupabaseArtDirectorRunPort } from "./repositories/art-director-run-repository";
import { createSupabaseStoryboardDirectorRunPort } from "./repositories/storyboard-director-run-repository";
import { createSupabasePromptDirectorRunPort } from "./repositories/prompt-director-run-repository";
import { getV2SupabaseFromEnv, type V2DbClient } from "./supabase-server";

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
  env?: Record<string, string | undefined>;
}) {
  const env = deps?.env ?? (process.env as Record<string, string | undefined>);
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
  const analyzer =
    deps?.marketingAnalyzer ?? createProductionMarketingAnalyzer(env);
  const creativeAnalyzer = deps?.creativeAnalyzer ?? createProductionCreativeAnalyzer(env);
  const scriptAnalyzer = deps?.scriptAnalyzer ?? createProductionScriptAnalyzer(env);
  const artAnalyzer = deps?.artAnalyzer ?? createProductionArtAnalyzer(env);
  const storyboardAnalyzer = deps?.storyboardAnalyzer ?? createProductionStoryboardAnalyzer(env);
  const promptAnalyzer = deps?.promptAnalyzer ?? createDeterministicPromptAnalyzer();

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
    createProject: createCreateDirectorProject({
      port: createPort,
      nowIso: deps?.nowIso ?? (() => new Date().toISOString()),
    }),
    getProject: createGetDirectorProject({ projects, artifacts }),
    listProjects: createListDirectorProjects({ projects, artifacts }),
    analyzeMarketing: createAnalyzeMarketingForProject({
      workspaceId,
      projects,
      artifacts,
      directorRuns,
      analyzer,
      pricing: createEnvAiTokenPricing(env),
      env,
    }),
    analyzeCreative: createAnalyzeCreativeForProject({
      workspaceId, projects, artifacts, directorRuns: creativeDirectorRuns,
      analyzer: creativeAnalyzer, pricing: createEnvAiTokenPricing(env), env,
    }),
    writeScript: createWriteScriptForProject({
      workspaceId, projects, artifacts, directorRuns: scriptDirectorRuns,
      analyzer: scriptAnalyzer, pricing: createEnvAiTokenPricing(env), env,
    }),
    analyzeArt: createAnalyzeArtForProject({
      workspaceId, projects, artifacts, directorRuns: artDirectorRuns,
      analyzer: artAnalyzer, pricing: createEnvAiTokenPricing(env), env,
    }),
    analyzeStoryboard: createAnalyzeStoryboardForProject({
      workspaceId, projects, artifacts, directorRuns: storyboardDirectorRuns,
      analyzer: storyboardAnalyzer, pricing: createEnvAiTokenPricing(env), env,
    }),
    buildScenePackages: createBuildScenePackagesForProject({
      workspaceId,
      projects,
      artifacts,
      directorRuns: promptDirectorRuns,
      analyzer: promptAnalyzer,
      env,
    }),
  };
}

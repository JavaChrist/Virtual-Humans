/**
 * VHS-121B persisted Storyboard Director. Sources are exclusively active server artifacts.
 */
import { createHash, randomUUID } from "node:crypto";
import { VideoProjectBriefSchema } from "@/domain/brief";
import { CreativeConceptSchema } from "@/domain/creative";
import { MarketingPlanSchema } from "@/domain/marketing";
import { VideoScriptSchema } from "@/domain/script";
import { VisualDirectionSchema } from "@/domain/art";
import {
  STORYBOARD_PROJECT_SCHEMA_VERSION,
  StoryboardProjectSchema,
  type StoryboardProject,
} from "@/domain/storyboard";
import type { ArtifactRepository, ProjectRepository } from "@/application/projects/ports";
import { canExecuteStoryboardAi, canUseDirectorV2Persistence } from "@/infrastructure/config/feature-flags";
import {
  e2eFakeOpenAiConfig,
  isDirectorE2eFakeMode,
  textDirectorExecutionAvailable,
} from "@/infrastructure/e2e/e2e-text-director-gate";
import { DEFAULT_OPENAI_STORYBOARD_MODEL, parseOpenAIStoryboardConfig } from "@/infrastructure/ai/openai/config";
import { runOpenAIStoryboardDryRun, STORYBOARD_ANALYZER_PROMPT_VERSION, STORYBOARD_CANDIDATE_SCHEMA_VERSION } from "@/infrastructure/ai/openai/storyboard";
import type { AiTokenPricingPort } from "@/infrastructure/ai/openai/marketing/pricing";
import { httpStatusForMarketingFailure } from "@/application/directors/marketing/failures";
import {
  meteringCostStatusForFail,
  meteringKnownCostMinor,
  meteringUsageRecord,
} from "@/application/directors/shared/analyzer-metering";
import { createStoryboardDirector } from "./storyboard-director";
import type { StoryboardAnalyzerPort } from "./analyzer-port";
import type { DirectorRunContext } from "./result";

type Warning = { code: string; message: string };
export type StoryboardProjectView = {
  revision: number;
  status: "ready" | "absent";
  title?: string;
  sceneCount?: number;
  totalDurationSeconds?: number;
  scenes?: Array<{ id: string; order: number; purpose: string; durationSeconds: number }>;
  warnings: Warning[];
};
export type StoryboardProjectInput = {
  projectId: string;
  expectedVisualDirectionRevision?: number;
  expectedVideoScriptRevision?: number;
  expectedCreativeConceptRevision?: number;
  expectedMarketingPlanRevision?: number;
};
export type StoryboardProjectDryRunResult = {
  executable: boolean;
  providerCalled: false;
  executionAvailable: boolean;
  briefRevision: number;
  briefArtifactId: string;
  marketingPlanRevision: number;
  marketingPlanArtifactId: string;
  creativeConceptRevision: number;
  creativeConceptArtifactId: string;
  videoScriptRevision: number;
  videoScriptArtifactId: string;
  visualDirectionRevision: number;
  visualDirectionArtifactId: string;
  provider: "openai";
  model: string;
  reasoningEffort: string;
  maxOutputTokens: number;
  promptVersion: string;
  schemaVersion: string;
  /** `promptVersion:schemaVersion` embedded in Storyboard idempotency identity. */
  idempotencyKeyVersion: string;
  /** True when `DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT` is set (budget reauth identity). */
  idempotencySaltPresent: boolean;
  /** OpenAI strict projection: must be 0 before provider. */
  structuredSchemaOneOfCount: number;
  /** `anyOf-compatible` when spokenContent unions are OpenAI-safe. */
  structuredSchemaProjection: "anyOf-compatible" | "invalid";
  /** Smoke gate: redacted provider error metadata capture is wired. */
  providerErrorMetadataCapture: "ready";
  continuitySemantics: "mandatory-projected-tokens";
  requiredContinuityRuleCount: number;
  preferredContinuityRuleCount: number;
  advisoryContinuityTokenCount: number;
  mandatoryContinuityTokenCount: number;
  mandatoryContinuityUniqueTokenCount: number;
  mandatoryContinuityScopeCount: number;
  mandatoryContinuityCoverage: "complete" | "incomplete";
  mandatoryContinuityTokensFingerprint: string;
  /** @deprecated use mandatoryContinuity* */
  requiredContinuityTokenCount: number;
  /** @deprecated use mandatoryContinuityScopeCount */
  requiredContinuityScopeCount: number;
  /** @deprecated use mandatoryContinuityCoverage */
  requiredContinuityCoverage: "complete" | "incomplete";
  /** @deprecated use mandatoryContinuityTokensFingerprint */
  requiredContinuityTokensFingerprint: string;
  /** @deprecated transitional — prefer mandatoryContinuity* */
  requiredLocationKeyCount: number;
  /** @deprecated transitional */
  requiredLocationKeyCoverage: "complete" | "incomplete";
  pricingConfigured: boolean;
  estimatedCostMinor?: number;
  currency?: string;
  validations: Array<{ code: string; passed: boolean; message: string }>;
  warnings: Warning[];
  missingInformation: Array<{ code: string; message: string; field?: string }>;
  existingStoryboard?: StoryboardProjectView;
};
export type StoryboardProjectResult =
  | { status: "completed" | "existing"; storyboard: StoryboardProjectView; directorRunId: string }
  | { status: "already_running"; directorRunId: string; publicMessage: string }
  | { status: "needs_input"; missingInformation: Array<{ code: string; message: string; field?: string }>; warnings: Warning[]; directorRunId?: string }
  | {
      status: "failed";
      code: string;
      publicMessage: string;
      retryable: boolean;
      httpHint: 400 | 402 | 409 | 422 | 429 | 500 | 502 | 503 | 504;
      retryAfterSeconds?: number;
      provider?: "openai";
      /** Provider HTTP status when known (distinct from route httpHint). */
      httpStatus?: number;
      directorRunId?: string;
      providerMetadata?: import("@/application/directors/marketing/failures").MarketingProviderFailureMetadata;
    };

export type StoryboardDirectorRunPort = {
  beginOrGet(input: {
    id: string; workspaceId: string; projectId: string;
    visualDirectionArtifactId: string; visualDirectionRevision: number;
    videoScriptArtifactId: string; videoScriptRevision: number;
    creativeConceptArtifactId: string; creativeConceptRevision: number;
    marketingPlanArtifactId: string; marketingPlanRevision: number;
    briefArtifactId: string; briefRevision: number;
    modelId: string; promptVersion: string; schemaVersion: string;
    idempotencyKey: string; commandFingerprint: string; correlationId: string;
    estimatedCostMinor?: number; currency?: string;
  }): Promise<{ status: "created"; directorRunId: string; revision: number } | { status: "existing"; directorRunId: string; revision: number; outputArtifactId: string } | { status: "already_running"; directorRunId: string; revision: number }>;
  reserveBudget(input: { reservationId: string; workspaceId: string; projectId: string; directorRunId: string; attemptId: string; amountMinor: number; currency: string; correlationId: string; ledgerIdempotencyKey: string }): Promise<void>;
  persistStoryboardProject(input: {
    workspaceId: string; projectId: string; directorRunId: string; artifactId: string;
    visualDirectionArtifactId: string; visualDirectionRevision: number;
    videoScriptArtifactId: string; videoScriptRevision: number;
    creativeConceptArtifactId: string; creativeConceptRevision: number;
    marketingPlanArtifactId: string; marketingPlanRevision: number;
    briefArtifactId: string; briefRevision: number;
    storyboard: Record<string, unknown>; schemaVersion: string; correlationId: string;
    reservationId?: string; actualCostMinor?: number; costStatus: string;
    usage?: Record<string, unknown>; expectedRunRevision: number; ledgerIdempotencyKey?: string;
  }): Promise<{ status: "created" | "existing"; artifactId: string; revision: number }>;
  failRun(input: { directorRunId: string; workspaceId: string; expectedRevision: number; errorCode: string; status: "failed" | "needs_input" | "cancelled"; reservationId?: string; correlationId: string; usage?: Record<string, unknown>; actualCostMinor?: number; costStatus?: string }): Promise<void>;
  loadActiveStoryboardProject(projectId: string): Promise<{ revision: number; value: unknown } | null>;
};
export type AnalyzeStoryboardForProjectDeps = {
  workspaceId: string; projects: ProjectRepository; artifacts: ArtifactRepository;
  directorRuns: StoryboardDirectorRunPort; analyzer: StoryboardAnalyzerPort;
  pricing?: AiTokenPricingPort; env?: Record<string, string | undefined>; idFactory?: () => string;
};
export type AnalyzeStoryboardForProject = { dryRun(input: StoryboardProjectInput, context: DirectorRunContext): Promise<StoryboardProjectDryRunResult>; execute(input: StoryboardProjectInput, context: DirectorRunContext): Promise<StoryboardProjectResult> };

function view(sb: StoryboardProject, revision: number, warnings: Warning[] = []): StoryboardProjectView {
  return {
    revision, status: "ready", title: sb.title,
    sceneCount: sb.scenes.length,
    totalDurationSeconds: sb.timing.totalSceneDurationSeconds,
    scenes: sb.scenes.map((s) => ({ id: s.id, order: s.order, purpose: s.purpose, durationSeconds: s.durationSeconds })),
    warnings,
  };
}
function stored(value: unknown, revision: number) {
  const parsed = StoryboardProjectSchema.safeParse(value);
  return parsed.success ? view(parsed.data, revision) : undefined;
}
async function active<T>(artifacts: ArtifactRepository, projectId: string, type: "video_project_brief" | "marketing_plan" | "creative_concept" | "video_script" | "visual_direction", schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }) {
  const current = await artifacts.getActive(projectId, type);
  if (!current) return null;
  const item = await artifacts.load(current.artifactId);
  if (!item) return null;
  const parsed = schema.safeParse(item.value);
  return parsed.success ? { value: parsed.data, artifactId: current.artifactId, revision: current.revision } : null;
}
function failed(code: string, publicMessage: string, httpHint: StoryboardProjectResult extends infer T ? T extends { httpHint: infer H } ? H : never : never, extra: Partial<Extract<StoryboardProjectResult, { status: "failed" }>> = {}) {
  return { status: "failed" as const, code, publicMessage, httpHint, retryable: false, ...extra };
}
function empty(partial: Partial<StoryboardProjectDryRunResult> & Pick<StoryboardProjectDryRunResult, "validations" | "missingInformation">): StoryboardProjectDryRunResult {
  return {
    executable: false, providerCalled: false, executionAvailable: false,
    briefRevision: 0, briefArtifactId: "", marketingPlanRevision: 0, marketingPlanArtifactId: "",
    creativeConceptRevision: 0, creativeConceptArtifactId: "", videoScriptRevision: 0, videoScriptArtifactId: "",
    visualDirectionRevision: 0, visualDirectionArtifactId: "",
    provider: "openai",
    model: DEFAULT_OPENAI_STORYBOARD_MODEL,
    reasoningEffort: "unknown",
    maxOutputTokens: 0,
    promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
    schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
    idempotencyKeyVersion: `${STORYBOARD_ANALYZER_PROMPT_VERSION}:${STORYBOARD_CANDIDATE_SCHEMA_VERSION}`,
    idempotencySaltPresent: false,
    structuredSchemaOneOfCount: 0,
    structuredSchemaProjection: "anyOf-compatible",
    providerErrorMetadataCapture: "ready",
    continuitySemantics: "mandatory-projected-tokens",
    requiredContinuityRuleCount: 0,
    preferredContinuityRuleCount: 0,
    advisoryContinuityTokenCount: 0,
    mandatoryContinuityTokenCount: 0,
    mandatoryContinuityUniqueTokenCount: 0,
    mandatoryContinuityScopeCount: 0,
    mandatoryContinuityCoverage: "incomplete",
    mandatoryContinuityTokensFingerprint: "",
    requiredContinuityTokenCount: 0,
    requiredContinuityScopeCount: 0,
    requiredContinuityCoverage: "incomplete",
    requiredContinuityTokensFingerprint: "",
    requiredLocationKeyCount: 0,
    requiredLocationKeyCoverage: "incomplete",
    pricingConfigured: false, warnings: [], ...partial,
  };
}

/** Build Storyboard idempotency key fields; optional salt enables reauth without prompt bump. */
export function storyboardIdempotencyFields(input: {
  projectId: string;
  briefArtifactId: string;
  briefRevision: number;
  marketingPlanArtifactId: string;
  marketingPlanRevision: number;
  creativeConceptArtifactId: string;
  creativeConceptRevision: number;
  videoScriptArtifactId: string;
  videoScriptRevision: number;
  visualDirectionArtifactId: string;
  visualDirectionRevision: number;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  idempotencySalt?: string;
}): { fields: string[]; keyRaw: string; key: string; fingerprint: string } {
  const fields = [
    input.projectId,
    input.briefArtifactId,
    String(input.briefRevision),
    input.marketingPlanArtifactId,
    String(input.marketingPlanRevision),
    input.creativeConceptArtifactId,
    String(input.creativeConceptRevision),
    input.videoScriptArtifactId,
    String(input.videoScriptRevision),
    input.visualDirectionArtifactId,
    String(input.visualDirectionRevision),
    input.model,
    input.promptVersion,
    input.schemaVersion,
  ];
  const salt = input.idempotencySalt?.trim() ?? "";
  const keyFields = salt ? [...fields, `reauth:${salt}`] : fields;
  const keyRaw = ["stb", ...keyFields].join(":");
  const key =
    keyRaw.length <= 200
      ? keyRaw
      : createHash("sha256").update(keyRaw).digest("hex");
  const fingerprint = createHash("sha256").update(fields.join("|")).digest("hex");
  return { fields: keyFields, keyRaw, key, fingerprint };
}

export function createAnalyzeStoryboardForProject(deps: AnalyzeStoryboardForProjectDeps): AnalyzeStoryboardForProject {
  const env = deps.env ?? (process.env as Record<string, string | undefined>), id = deps.idFactory ?? randomUUID;
  async function sources(projectId: string) {
    return Promise.all([
      active(deps.artifacts, projectId, "video_project_brief", VideoProjectBriefSchema),
      active(deps.artifacts, projectId, "marketing_plan", MarketingPlanSchema),
      active(deps.artifacts, projectId, "creative_concept", CreativeConceptSchema),
      active(deps.artifacts, projectId, "video_script", VideoScriptSchema),
      active(deps.artifacts, projectId, "visual_direction", VisualDirectionSchema),
    ]);
  }
  async function dry(input: StoryboardProjectInput): Promise<StoryboardProjectDryRunResult> {
    if (!canUseDirectorV2Persistence(env)) return empty({ validations: [{ code: "persistence", passed: false, message: "Persistance Director désactivée." }], missingInformation: [] });
    const project = await deps.projects.load(input.projectId);
    if (!project || project.workspaceId !== deps.workspaceId) return empty({ validations: [{ code: "project", passed: false, message: "Projet introuvable." }], missingInformation: [{ code: "project_missing", message: "Projet introuvable." }] });
    const [brief, plan, concept, script, visual] = await sources(input.projectId);
    if (!brief || !plan || !concept || !script || !visual) {
      const missing = !brief ? "brief" : !plan ? "marketing_plan" : !concept ? "creative_concept" : !script ? "video_script" : "visual_direction";
      return empty({
        briefRevision: brief?.revision ?? 0, briefArtifactId: brief?.artifactId ?? "",
        marketingPlanRevision: plan?.revision ?? 0, marketingPlanArtifactId: plan?.artifactId ?? "",
        creativeConceptRevision: concept?.revision ?? 0, creativeConceptArtifactId: concept?.artifactId ?? "",
        videoScriptRevision: script?.revision ?? 0, videoScriptArtifactId: script?.artifactId ?? "",
        visualDirectionRevision: visual?.revision ?? 0, visualDirectionArtifactId: visual?.artifactId ?? "",
        validations: [{ code: missing, passed: false, message: `Pré-requis actif introuvable (${missing}).` }],
        missingInformation: [{ code: `${missing}_missing`, message: "Pré-requis actif introuvable." }],
      });
    }
    const ai = runOpenAIStoryboardDryRun(brief.value, plan.value, concept.value, script.value, visual.value, { env, pricing: deps.pricing });
    const existing = await deps.directorRuns.loadActiveStoryboardProject(input.projectId);
    const price = deps.pricing?.getPriceBook(ai.model);
    const estimated = price ? Math.floor(((ai.approximateInputTokens ?? 0) * price.inputPerMillionMinor) / 1_000_000) + Math.floor((ai.maxOutputTokens * price.outputPerMillionMinor) / 1_000_000) : undefined;
    const e2e = isDirectorE2eFakeMode(env);
    const domainExecutable = e2e ? true : ai.executable;
    const validations = e2e
      ? ai.validations.filter(
          (v) =>
            !/clé|api.?key|openai|price book|flag/i.test(`${v.code} ${v.message}`),
        )
      : ai.validations;
    const e2eCfg = e2e ? e2eFakeOpenAiConfig() : null;
    return {
      executable: domainExecutable, providerCalled: false, executionAvailable: textDirectorExecutionAvailable({
        env, domainExecutable, paidPathAvailable: canExecuteStoryboardAi(env), pricingConfigured: ai.pricingConfigured,
      }),
      briefRevision: brief.revision, briefArtifactId: brief.artifactId,
      marketingPlanRevision: plan.revision, marketingPlanArtifactId: plan.artifactId,
      creativeConceptRevision: concept.revision, creativeConceptArtifactId: concept.artifactId,
      videoScriptRevision: script.revision, videoScriptArtifactId: script.artifactId,
      visualDirectionRevision: visual.revision, visualDirectionArtifactId: visual.artifactId,
      provider: "openai",
      model: e2eCfg?.model ?? ai.model,
      reasoningEffort: e2eCfg?.reasoningEffort ?? ai.reasoningEffort,
      maxOutputTokens: e2eCfg?.maxOutputTokens ?? ai.maxOutputTokens,
      promptVersion: ai.promptVersion,
      schemaVersion: ai.schemaVersion,
      idempotencyKeyVersion: `${ai.promptVersion}:${ai.schemaVersion}`,
      idempotencySaltPresent: Boolean((env.DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT ?? "").trim()),
      structuredSchemaOneOfCount: ai.structuredSchemaOneOfCount,
      structuredSchemaProjection: ai.structuredSchemaProjection,
      providerErrorMetadataCapture: ai.providerErrorMetadataCapture,
      continuitySemantics: ai.continuitySemantics,
      requiredContinuityRuleCount: ai.requiredContinuityRuleCount,
      preferredContinuityRuleCount: ai.preferredContinuityRuleCount,
      advisoryContinuityTokenCount: ai.advisoryContinuityTokenCount,
      mandatoryContinuityTokenCount: ai.mandatoryContinuityTokenCount,
      mandatoryContinuityUniqueTokenCount: ai.mandatoryContinuityUniqueTokenCount,
      mandatoryContinuityScopeCount: ai.mandatoryContinuityScopeCount,
      mandatoryContinuityCoverage: ai.mandatoryContinuityCoverage,
      mandatoryContinuityTokensFingerprint: ai.mandatoryContinuityTokensFingerprint,
      requiredContinuityTokenCount: ai.mandatoryContinuityTokenCount,
      requiredContinuityScopeCount: ai.mandatoryContinuityScopeCount,
      requiredContinuityCoverage: ai.mandatoryContinuityCoverage,
      requiredContinuityTokensFingerprint: ai.mandatoryContinuityTokensFingerprint,
      requiredLocationKeyCount: ai.requiredLocationKeyCount,
      requiredLocationKeyCoverage: ai.requiredLocationKeyCoverage,
      pricingConfigured: e2e ? true : ai.pricingConfigured, estimatedCostMinor: estimated, currency: price?.currency,
      validations, warnings: ai.warnings,
      missingInformation: validations.filter((v) => !v.passed).map((v) => ({ code: v.code, message: v.message })),
      existingStoryboard: existing ? stored(existing.value, existing.revision) : undefined,
    };
  }
  return {
    dryRun: async (input) => dry(input),
    async execute(input, context) {
      if (!canUseDirectorV2Persistence(env)) return failed("persistence_disabled", "Persistance Director désactivée.", 503);
      const e2e = isDirectorE2eFakeMode(env);
      if (!e2e && !canExecuteStoryboardAi(env)) return failed("storyboard_ai_disabled", "Storyboard IA désactivé.", 503);
      let config;
      if (e2e) { config = e2eFakeOpenAiConfig(); }
      else {
        try { config = parseOpenAIStoryboardConfig(env); } catch { return failed("invalid_config", "Configuration Storyboard IA invalide.", 503); }
        if (!config.apiKeyPresent) return failed("openai_not_configured", "OpenAI n'est pas configuré.", 503);
      }
      const project = await deps.projects.load(input.projectId);
      if (!project || project.workspaceId !== deps.workspaceId) return failed("not_found", "Projet introuvable.", 400);
      const [brief, plan, concept, script, visual] = await sources(input.projectId);
      if (!brief) return failed("brief_missing", "Brief actif introuvable.", 422);
      if (!plan) return failed("marketing_plan_missing", "Marketing Plan actif introuvable.", 422);
      if (!concept) return failed("creative_concept_missing", "Creative Concept actif introuvable.", 422);
      if (!script) return failed("video_script_missing", "Script actif introuvable.", 422);
      if (!visual) return failed("visual_direction_missing", "Direction art active introuvable.", 422);
      if (input.expectedVisualDirectionRevision != null && input.expectedVisualDirectionRevision !== visual.revision) return failed("visual_direction_revision_conflict", "La Direction art a changé depuis la vérification.", 409);
      if (input.expectedVideoScriptRevision != null && input.expectedVideoScriptRevision !== script.revision) return failed("video_script_revision_conflict", "Le Script a changé depuis la vérification.", 409);
      if (input.expectedCreativeConceptRevision != null && input.expectedCreativeConceptRevision !== concept.revision) return failed("creative_concept_revision_conflict", "Le Creative Concept a changé depuis la vérification.", 409);
      if (input.expectedMarketingPlanRevision != null && input.expectedMarketingPlanRevision !== plan.revision) return failed("marketing_plan_revision_conflict", "Le Marketing Plan a changé depuis la vérification.", 409);
      const check = await dry(input);
      if (!check.executable) return { status: "needs_input", missingInformation: check.missingInformation, warnings: check.warnings };
      const estimated = Math.max(1, check.estimatedCostMinor ?? 1), currency = check.currency ?? "USD";
      const { key, fingerprint } = storyboardIdempotencyFields({
        projectId: input.projectId,
        briefArtifactId: brief.artifactId,
        briefRevision: brief.revision,
        marketingPlanArtifactId: plan.artifactId,
        marketingPlanRevision: plan.revision,
        creativeConceptArtifactId: concept.artifactId,
        creativeConceptRevision: concept.revision,
        videoScriptArtifactId: script.artifactId,
        videoScriptRevision: script.revision,
        visualDirectionArtifactId: visual.artifactId,
        visualDirectionRevision: visual.revision,
        model: config.model,
        promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION,
        schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
        idempotencySalt: env.DIRECTOR_STORYBOARD_IDEMPOTENCY_SALT,
      });
      const begin = await deps.directorRuns.beginOrGet({
        id: id(), workspaceId: deps.workspaceId, projectId: input.projectId,
        visualDirectionArtifactId: visual.artifactId, visualDirectionRevision: visual.revision,
        videoScriptArtifactId: script.artifactId, videoScriptRevision: script.revision,
        creativeConceptArtifactId: concept.artifactId, creativeConceptRevision: concept.revision,
        marketingPlanArtifactId: plan.artifactId, marketingPlanRevision: plan.revision,
        briefArtifactId: brief.artifactId, briefRevision: brief.revision,
        modelId: config.model, promptVersion: STORYBOARD_ANALYZER_PROMPT_VERSION, schemaVersion: STORYBOARD_CANDIDATE_SCHEMA_VERSION,
        idempotencyKey: key, commandFingerprint: fingerprint, correlationId: context.correlationId,
        estimatedCostMinor: estimated, currency,
      });
      if (begin.status === "already_running") return { status: "already_running", directorRunId: begin.directorRunId, publicMessage: "Un storyboard est déjà en cours." };
      if (begin.status === "existing") {
        const artifact = await deps.artifacts.load(begin.outputArtifactId);
        const prior = artifact && stored(artifact.value, artifact.revision);
        if (prior) return { status: "existing", storyboard: prior, directorRunId: begin.directorRunId };
      }
      const runId = begin.directorRunId, reservationId = id();
      try {
        await deps.directorRuns.reserveBudget({ reservationId, workspaceId: deps.workspaceId, projectId: input.projectId, directorRunId: runId, attemptId: "storyboard-1", amountMinor: estimated, currency, correlationId: context.correlationId, ledgerIdempotencyKey: `dir-reserve-${runId}` });
      } catch {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision, errorCode: "budget_exceeded", status: "failed", correlationId: context.correlationId }).catch(() => undefined);
        return failed("budget_exceeded", "Réservation budget impossible.", 402, { directorRunId: runId });
      }
      const run = await createStoryboardDirector({ analyzer: deps.analyzer }).run(
        { brief: brief.value, marketingPlan: plan.value, creativeConcept: concept.value, videoScript: script.value, visualDirection: visual.value },
        { ...context, mode: "execute", planId: id(), createdBy: "shared-password-user" },
      );
      const meteringUsage = meteringUsageRecord(run.metering);
      const meteringKnownCost = meteringKnownCostMinor(run.metering);
      const failMetering = {
        usage: meteringUsage,
        actualCostMinor: meteringKnownCost,
        costStatus: meteringCostStatusForFail(run.metering),
      };
      if (run.status === "needs_input") {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: "needs_input", status: "needs_input", reservationId, correlationId: context.correlationId, ...failMetering });
        return { status: "needs_input", missingInformation: run.missingInformation, warnings: run.warnings, directorRunId: runId };
      }
      if (run.status === "provider_failed") {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: run.failure.code, status: "failed", reservationId, correlationId: context.correlationId, ...failMetering });
        const mapped = httpStatusForMarketingFailure(run.failure.code);
        return failed(run.failure.code, run.failure.publicMessage, mapped === 202 ? 500 : mapped, {
          retryable: run.failure.retryable,
          retryAfterSeconds: run.failure.retryAfterSeconds,
          provider: run.failure.provider,
          httpStatus: run.failure.httpStatus,
          directorRunId: runId,
          providerMetadata: run.failure.providerMetadata,
        });
      }
      if (run.status === "invalid") {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: "invalid_candidate", status: "failed", reservationId, correlationId: context.correlationId, ...failMetering });
        return failed("invalid_candidate", run.errors[0]?.message ?? "Storyboard invalide.", 422, { directorRunId: runId });
      }
      try {
        const actualCostMinor = meteringKnownCost ?? estimated;
        const persisted = await deps.directorRuns.persistStoryboardProject({
          workspaceId: deps.workspaceId, projectId: input.projectId, directorRunId: runId, artifactId: run.storyboard.id,
          visualDirectionArtifactId: visual.artifactId, visualDirectionRevision: visual.revision,
          videoScriptArtifactId: script.artifactId, videoScriptRevision: script.revision,
          creativeConceptArtifactId: concept.artifactId, creativeConceptRevision: concept.revision,
          marketingPlanArtifactId: plan.artifactId, marketingPlanRevision: plan.revision,
          briefArtifactId: brief.artifactId, briefRevision: brief.revision,
          storyboard: run.storyboard as unknown as Record<string, unknown>,
          schemaVersion: STORYBOARD_PROJECT_SCHEMA_VERSION, correlationId: context.correlationId,
          reservationId, actualCostMinor, costStatus: e2e || check.pricingConfigured || meteringKnownCost != null ? "committed" : "provisional",
          usage: meteringUsage,
          expectedRunRevision: begin.revision + 1, ledgerIdempotencyKey: `dir-commit-${runId}`,
        });
        return { status: persisted.status === "existing" ? "existing" : "completed", storyboard: view(run.storyboard, persisted.revision, run.warnings), directorRunId: runId };
      } catch {
        await deps.directorRuns.failRun({ directorRunId: runId, workspaceId: deps.workspaceId, expectedRevision: begin.revision + 1, errorCode: "persist_failed", status: "failed", reservationId, correlationId: context.correlationId }).catch(() => undefined);
        return failed("persist_failed", "La persistance du storyboard a échoué.", 503, { directorRunId: runId });
      }
    },
  };
}
